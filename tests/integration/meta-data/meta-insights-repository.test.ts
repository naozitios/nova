import { describe, expect, it, beforeAll } from "vitest";
import {
  canRun,
  getClient,
  TEST_WORKSPACE,
} from "../business-context/supabase-helpers";
import { SupabaseMetaRepository } from "@/infrastructure/meta/supabase-meta.repository";

// ---------------------------------------------------------------------------
// 008C Task 5 — Meta insights repository integration tests
//
// Proves against live Supabase:
//   1. upsertDailyInsights duplicate upsert updates row, not duplicate
//   2. Missing date_start quarantines record, does not insert into insights
//   3. getDataFreshness returns latest successful date + missing window/gap counts
//   4. listDailyInsights returns stored rows in date order, preserves actions/action_values
//
// Uses service-role client for seed/inspect/clean. Does not reset DB.
// ---------------------------------------------------------------------------

const TEST_AD_ACCOUNT = "act_87654321";

let repo: SupabaseMetaRepository;
let client: ReturnType<typeof getClient>;

beforeAll(() => {
  if (!canRun) return;
  client = getClient();
  repo = new SupabaseMetaRepository(client);
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeInsight(overrides: Record<string, unknown> = {}) {
  return {
    metaCampaignId: "1200300000000000000",
    metaAdSetId: "1200300000000000001",
    metaAdId: "1200300000000000002",
    dateStart: "2026-07-01",
    dateStop: "2026-07-01",
    spend: 42.5,
    impressions: 1200,
    reach: 900,
    clicks: 85,
    actions: [{ action_type: "purchase", value: "3" }],
    actionValues: [{ action_type: "purchase", value: "120.00" }],
    attributionSetting: "7d_click",
    dataCompletenessState: "complete",
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)(
  "SupabaseMetaRepository — daily insights",
  () => {
    // -----------------------------------------------------------------------
    // Test 1: upsertDailyInsights duplicate upsert updates row, not duplicate
    // -----------------------------------------------------------------------
    it("upserts daily insights — duplicate upsert updates row, not duplicate", async () => {
      const runId = crypto.randomUUID();
      const insight = makeInsight();

      // First upsert
      const result1 = await repo.upsertDailyInsights({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId,
        apiVersion: "v21.0",
        accountTimezone: "America/New_York",
        currency: "USD",
        insights: [insight],
      });
      expect(result1.ok, JSON.stringify(result1)).toBe(true);

      // Verify exactly 1 row
      const { count: count1 } = await client!
        .from("meta_insights_daily")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("date_start", insight.dateStart)
        .eq("meta_ad_id", insight.metaAdId);
      expect(count1).toBe(1);

      // Upsert again with changed spend
      const result2 = await repo.upsertDailyInsights({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId,
        apiVersion: "v21.0",
        accountTimezone: "America/New_York",
        currency: "USD",
        insights: [{ ...insight, spend: 99.99 }],
      });
      expect(result2.ok).toBe(true);

      // Still exactly 1 row
      const { count: count2 } = await client!
        .from("meta_insights_daily")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("date_start", insight.dateStart)
        .eq("meta_ad_id", insight.metaAdId);
      expect(count2).toBe(1);

      // Spend updated
      const { data: row } = await client!
        .from("meta_insights_daily")
        .select("spend")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("date_start", insight.dateStart)
        .eq("meta_ad_id", insight.metaAdId)
        .single();
      expect(row!.spend).toBe(99.99);
    });

    // -----------------------------------------------------------------------
    // Test 2: missing date_start quarantines record
    // -----------------------------------------------------------------------
    it("quarantines record with missing date_start, does not insert into meta_insights_daily", async () => {
      const runId = crypto.randomUUID();
      const insight = makeInsight({
        metaAdId: `missing-date-${crypto.randomUUID()}`,
        dateStart: undefined,
      });

      const result = await repo.upsertDailyInsights({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId,
        apiVersion: "v21.0",
        accountTimezone: "America/New_York",
        currency: "USD",
        insights: [insight],
      });
      // quarantine is not a failure
      expect(result.ok).toBe(true);

      // Verify NOT inserted into meta_insights_daily
      const { count: insightCount } = await client!
        .from("meta_insights_daily")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("meta_ad_account_id", TEST_AD_ACCOUNT)
        .eq("meta_ad_id", insight.metaAdId);
      expect(insightCount).toBe(0);

      // Verify quarantine record exists
      const { data: quarantine, error: qError } = await client!
        .from("meta_quarantined_records")
        .select("*")
        .eq("workspace_id", TEST_WORKSPACE)
        .eq("source_table", "meta_insights_daily")
        .eq("provider_id", insight.metaAdId)
        .single();

      expect(qError).toBeNull();
      expect(quarantine).toBeDefined();
      expect(quarantine!.source_table).toBe("meta_insights_daily");
      expect(quarantine!.validation_errors).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // Test 3: getDataFreshness returns latest date + missing window/gap counts
    // -----------------------------------------------------------------------
    it("getDataFreshness returns latest successful date and gap/missing counts", async () => {
      const runId = crypto.randomUUID();

      // Seed 3 consecutive days of insights
      const dates = ["2026-07-10", "2026-07-11", "2026-07-12"];
      for (const dateStart of dates) {
        const result = await repo.upsertDailyInsights({
          workspaceId: TEST_WORKSPACE,
          metaAdAccountId: TEST_AD_ACCOUNT,
          runId,
          apiVersion: "v21.0",
          accountTimezone: "America/New_York",
          currency: "USD",
          insights: [
            makeInsight({
              dateStart,
              dateStop: dateStart,
              metaAdId: `seed-ad-${dateStart}`,
            }),
          ],
        });
        expect(result.ok, JSON.stringify(result)).toBe(true);
      }

      // Query freshness — full window includes all seeded dates
      const freshness = await repo.getDataFreshness({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        since: "2026-07-10",
        until: "2026-07-12",
      });
      expect(freshness.ok, JSON.stringify(freshness)).toBe(true);
      if (!freshness.ok) return;

      expect(freshness.data.latestDate).toBe("2026-07-12");
      expect(freshness.data.missingWindowCount).toBe(0);
      expect(freshness.data.gapCount).toBe(0);

      // Query freshness — window extends beyond seeded range
      const freshnessExtended = await repo.getDataFreshness({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        since: "2026-07-08",
        until: "2026-07-15",
      });
      expect(freshnessExtended.ok).toBe(true);
      if (!freshnessExtended.ok) return;

      expect(freshnessExtended.data.latestDate).toBe("2026-07-12");
      // Gap from 2026-07-08 to 2026-07-09 (2 days) + 2026-07-13 to 2026-07-15 (3 days) = 5 missing days
      expect(freshnessExtended.data.missingWindowCount).toBe(5);
      // One gap block before 07-10, one gap block after 07-12 = 2 gaps
      expect(freshnessExtended.data.gapCount).toBe(2);
    });

    // -----------------------------------------------------------------------
    // Test 4: listDailyInsights returns rows in date order, preserves actions
    // -----------------------------------------------------------------------
    it("listDailyInsights returns stored rows in date order and preserves actions/action_values", async () => {
      const runId = crypto.randomUUID();
      const actions = [
        { action_type: "purchase", value: "2" },
        { action_type: "add_to_cart", value: "5" },
      ];
      const actionValues = [{ action_type: "purchase", value: "85.50" }];

      const insights = [
        makeInsight({
          dateStart: "2026-07-20",
          dateStop: "2026-07-20",
          metaAdId: "list-ad-1",
          spend: 10,
          actions,
          actionValues,
        }),
        makeInsight({
          dateStart: "2026-07-19",
          dateStop: "2026-07-19",
          metaAdId: "list-ad-2",
          spend: 20,
        }),
        makeInsight({
          dateStart: "2026-07-21",
          dateStop: "2026-07-21",
          metaAdId: "list-ad-3",
          spend: 30,
        }),
      ];

      const result = await repo.upsertDailyInsights({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        runId,
        apiVersion: "v21.0",
        accountTimezone: "America/New_York",
        currency: "USD",
        insights,
      });
      expect(result.ok, JSON.stringify(result)).toBe(true);

      const listed = await repo.listDailyInsights({
        workspaceId: TEST_WORKSPACE,
        metaAdAccountId: TEST_AD_ACCOUNT,
        since: "2026-07-19",
        until: "2026-07-21",
      });
      expect(listed.ok, JSON.stringify(listed)).toBe(true);
      if (!listed.ok) return;

      // Should return 3 rows in ascending date order
      expect(listed.data.length).toBe(3);
      expect(listed.data[0].dateStart).toBe("2026-07-19");
      expect(listed.data[1].dateStart).toBe("2026-07-20");
      expect(listed.data[2].dateStart).toBe("2026-07-21");

      // Preserve raw actions/action_values on the first insight
      const row0720 = listed.data.find((r) => r.dateStart === "2026-07-20");
      expect(row0720).toBeDefined();
      expect(row0720!.actions).toEqual(actions);
      expect(row0720!.actionValues).toEqual(actionValues);
    });
  },
);
