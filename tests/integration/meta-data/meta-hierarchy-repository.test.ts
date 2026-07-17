import { describe, expect, it, beforeAll } from "vitest";
import {
  canRun,
  getClient,
  TEST_WORKSPACE,
} from "../business-context/supabase-helpers";
import { SupabaseMetaRepository } from "@/infrastructure/meta/supabase-meta.repository";

// ---------------------------------------------------------------------------
// 008B Task 5 — Meta hierarchy repository integration tests
//
// Proves against live Supabase:
//   1. createSyncRun + advanceCheckpoint persists completed campaigns partition
//   2. upsertCampaigns with same workspace/account/meta_campaign_id updates
//      existing row, no duplicate
//   3. upsertAds with missing adset parent quarantines invalid ad
//
// Uses service-role client for seed/inspect/clean. Does not reset DB.
// ---------------------------------------------------------------------------

const TEST_AD_ACCOUNT = "act_12345678";

let repo: SupabaseMetaRepository;

beforeAll(() => {
  if (!canRun) return;
  const client = getClient();
  repo = new SupabaseMetaRepository(client);
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeCampaign(overrides: Record<string, unknown> = {}) {
  return {
    id: "1200300000000000000",
    name: "Test Campaign",
    objective: "OUTCOME_TRAFFIC",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    buying_type: "AUCTION",
    start_time: "2026-01-01T00:00:00+0000",
    stop_time: null,
    created_time: "2026-01-01T00:00:00+0000",
    updated_time: "2026-01-01T00:00:00+0000",
    ...overrides,
  };
}

function makeAd(overrides: Record<string, unknown> = {}) {
  return {
    id: "1200300000000000001",
    campaign_id: "1200300000000000000",
    adset_id: "nonexistent-adset-id",
    name: "Test Ad",
    effective_status: "ACTIVE",
    configured_status: "ACTIVE",
    created_time: "2026-01-01T00:00:00+0000",
    updated_time: "2026-01-01T00:00:00+0000",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)(
  "SupabaseMetaRepository — hierarchy sync",
  () => {
    // -----------------------------------------------------------------------
    // Test 1: createSyncRun + advanceCheckpoint
    // -----------------------------------------------------------------------
    it("creates a sync run and advances a completed campaigns checkpoint", async () => {
      const runId = crypto.randomUUID();

      // createSyncRun
      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const run = runResult.data;
      expect(run.id).toBeDefined();
      expect(run.workspaceId).toBe(TEST_WORKSPACE);
      expect(run.metaAdAccountId).toBe(TEST_AD_ACCOUNT);
      expect(run.mode).toBe("initial_backfill");

      // advanceCheckpoint — completed campaigns partition
      const checkpointResult = await repo.advanceCheckpoint({
        workspaceId: TEST_WORKSPACE,
        runId: run.id,
        partitionKey: "campaigns",
        status: "completed",
        cursor: null,
      });
      expect(checkpointResult.ok).toBe(true);
      if (!checkpointResult.ok) return;

      const checkpoint = checkpointResult.data;
      expect(checkpoint.partitionKey).toBe("campaigns");
      expect(checkpoint.status).toBe("completed");
    });

    // -----------------------------------------------------------------------
    // Test 2: upsertCampaigns idempotency
    // -----------------------------------------------------------------------
    it("upsertCampaigns with same key updates existing row, no duplicate", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      // Seed a sync run first (FK requirement)
      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-upsert-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const campaign = makeCampaign({ name: "Version 1" });

      // First upsert
      const result1 = await repo.upsertCampaigns({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        campaigns: [campaign],
      });
      expect(result1.ok).toBe(true);

      // Verify exactly 1 row
      const { count: count1 } = await client
        .from("meta_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_campaign_id", campaign.id);
      expect(count1).toBe(1);

      // Upsert again with changed name
      const updatedCampaign = makeCampaign({ name: "Version 2" });
      const result2 = await repo.upsertCampaigns({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        campaigns: [updatedCampaign],
      });
      expect(result2.ok).toBe(true);

      // Still exactly 1 row
      const { count: count2 } = await client
        .from("meta_campaigns")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_campaign_id", campaign.id);
      expect(count2).toBe(1);

      // Name updated
      const { data: row } = await client
        .from("meta_campaigns")
        .select("name")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_campaign_id", campaign.id)
        .single();
      expect(row!.name).toBe("Version 2");
    });

    // -----------------------------------------------------------------------
    // Test 3: upsertAds quarantines invalid ad (missing adset parent)
    // -----------------------------------------------------------------------
    it("upsertAds with missing adset parent quarantines invalid ad", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      // Seed a sync run
      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-quarantine-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      // Upsert ad referencing nonexistent adset
      const ad = makeAd({ adset_id: "nonexistent-adset-id" });
      const result = await repo.upsertAds({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        ads: [ad],
      });
      // upsertAds should succeed (quarantine is not a failure)
      expect(result.ok).toBe(true);

      // Verify ad was NOT inserted into meta_ads
      const { count: adCount } = await client
        .from("meta_ads")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_ad_id", ad.id);
      expect(adCount).toBe(0);

      // Verify quarantine record exists
      const { data: quarantine, error: qError } = await client
        .from("meta_quarantined_records")
        .select("*")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("source_table", "meta_ads")
        .eq("provider_id", ad.id)
        .single();

      expect(qError).toBeNull();
      expect(quarantine).toBeDefined();
      expect(quarantine!.source_table).toBe("meta_ads");
      expect(quarantine!.provider_id).toBe(ad.id);
      expect(quarantine!.validation_errors).toBeDefined();
    });
  },
);
