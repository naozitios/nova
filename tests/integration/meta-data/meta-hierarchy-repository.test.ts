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

    // -----------------------------------------------------------------------
    // Test 4: upsertAdSets idempotency
    // -----------------------------------------------------------------------
    it("upsertAdSets upserts valid rows and is idempotent on re-upsert", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-adsets-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const adSet = {
        id: "adset_900100000000000001",
        campaign_id: "camp_900100000000000001",
        name: "Test AdSet v1",
        effective_status: "ACTIVE",
      };

      // First upsert
      const r1 = await repo.upsertAdSets({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        adSets: [adSet],
      });
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      expect(r1.data.upserted).toBe(1);
      expect(r1.data.quarantined).toBe(0);

      // Verify exactly 1 row
      const { count: c1 } = await client
        .from("meta_ad_sets")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_ad_set_id", adSet.id);
      expect(c1).toBe(1);

      // Re-upsert same meta_ad_set_id with changed name
      const r2 = await repo.upsertAdSets({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        adSets: [{ ...adSet, name: "Test AdSet v2" }],
      });
      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      expect(r2.data.upserted).toBe(1);

      // Still exactly 1 row, name updated
      const { count: c2 } = await client
        .from("meta_ad_sets")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_ad_set_id", adSet.id);
      expect(c2).toBe(1);

      const { data: row } = await client
        .from("meta_ad_sets")
        .select("name")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_ad_set_id", adSet.id)
        .single();
      expect(row!.name).toBe("Test AdSet v2");
    });

    // -----------------------------------------------------------------------
    // Test 5: upsertAdSets quarantines row missing id
    // -----------------------------------------------------------------------
    it("upsertAdSets quarantines row missing id", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-adsets-q-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      // adSet without id field
      const badAdSet = { name: "No ID AdSet", campaign_id: "some-campaign" };
      const result = await repo.upsertAdSets({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        adSets: [badAdSet],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.upserted).toBe(0);
      expect(result.data.quarantined).toBe(1);

      // Verify quarantine record — provider_id is '' when id is missing
      const { data: qr, error: qErr } = await client
        .from("meta_quarantined_records")
        .select("*")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("source_table", "meta_ad_sets")
        .eq("provider_id", "")
        .limit(1)
        .maybeSingle();
      expect(qErr).toBeNull();
      expect(qr).toBeDefined();
      expect(qr!.source_table).toBe("meta_ad_sets");
    });

    // -----------------------------------------------------------------------
    // Test 6: upsertCreatives idempotency
    // -----------------------------------------------------------------------
    it("upsertCreatives upserts valid rows and is idempotent on re-upsert", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-creatives-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const creative = {
        id: "creative_900200000000000001",
        name: "Test Creative v1",
        title: "Ad Title",
      };

      const r1 = await repo.upsertCreatives({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        creatives: [creative],
      });
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      expect(r1.data.upserted).toBe(1);
      expect(r1.data.quarantined).toBe(0);

      const { count: c1 } = await client
        .from("meta_creatives")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_creative_id", creative.id);
      expect(c1).toBe(1);

      // Re-upsert same creative id with changed name
      const r2 = await repo.upsertCreatives({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId: runResult.data.id,
        creatives: [{ ...creative, name: "Test Creative v2" }],
      });
      expect(r2.ok).toBe(true);
      if (!r2.ok) return;
      expect(r2.data.upserted).toBe(1);

      const { count: c2 } = await client
        .from("meta_creatives")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_creative_id", creative.id);
      expect(c2).toBe(1);

      const { data: row } = await client
        .from("meta_creatives")
        .select("name")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_creative_id", creative.id)
        .single();
      expect(row!.name).toBe("Test Creative v2");
    });

    // -----------------------------------------------------------------------
    // Test 7: claimSyncRun acquires unclaimed, rejects concurrent claim
    // -----------------------------------------------------------------------
    it("claimSyncRun acquires unclaimed run, rejects concurrent claim", async () => {
      const runId = crypto.randomUUID();

      // Seed a sync run
      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-claim-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const createdRunId = runResult.data.id;

      // First claim — should succeed
      const c1 = await repo.claimSyncRun(createdRunId, "worker-alpha", 60_000);
      expect(c1.ok).toBe(true);
      if (!c1.ok) return;
      expect(c1.data).not.toBeNull();
      expect(c1.data!.status).toBe("running");

      // Second claim with different worker while lease active — should return null
      const c2 = await repo.claimSyncRun(createdRunId, "worker-bravo", 60_000);
      expect(c2.ok).toBe(true);
      if (!c2.ok) return;
      expect(c2.data).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Test 8: getCompletedCheckpointKeys returns only completed partitions
    // -----------------------------------------------------------------------
    it("getCompletedCheckpointKeys returns only completed partition keys", async () => {
      const runId = crypto.randomUUID();

      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-ckpt-keys-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const createdRunId = runResult.data.id;

      // Seed two checkpoints: one completed, one retry_pending
      await repo.advanceCheckpoint({
        workspaceId: TEST_WORKSPACE,
        runId: createdRunId,
        partitionKey: "campaigns",
        status: "completed",
        cursor: null,
      });
      await repo.advanceCheckpoint({
        workspaceId: TEST_WORKSPACE,
        runId: createdRunId,
        partitionKey: "ad_sets",
        status: "retry_pending",
        cursor: null,
      });

      const result = await repo.getCompletedCheckpointKeys(createdRunId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toEqual(["campaigns"]);
    });

    // -----------------------------------------------------------------------
    // Test 9: quarantineRecords inserts directly
    // -----------------------------------------------------------------------
    it("quarantineRecords inserts the given records into quarantine table", async () => {
      const client = getClient();
      const runId = crypto.randomUUID();

      const runResult = await repo.createSyncRun({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        mode: "initial_backfill",
        idempotencyKey: `test-quarantine-records-${runId}`,
      });
      expect(runResult.ok).toBe(true);
      if (!runResult.ok) return;

      const result = await repo.quarantineRecords({
        workspaceId: TEST_WORKSPACE,
        runId: runResult.data.id,
        objectType: "meta_campaigns",
        records: [
          {
            externalId: "ext_1",
            payload: { id: "ext_1", name: "Bad Campaign" },
            reason: "Validation failed",
          },
          {
            externalId: "ext_2",
            payload: { id: "ext_2", name: "Bad Campaign 2" },
            reason: "Missing required field",
          },
        ],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.quarantined).toBe(2);

      // Verify rows visible in quarantine table
      const { count } = await client
        .from("meta_quarantined_records")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("run_id", runResult.data.id)
        .eq("source_table", "meta_campaigns");
      expect(count).toBe(2);
    });
  },
);
