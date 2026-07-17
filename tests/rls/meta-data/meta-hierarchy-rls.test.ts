import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  run,
  supabaseUrl,
  supabaseAnonKey,
  WORKSPACE_A,
  WORKSPACE_B,
  initServiceClient,
  getServiceClient,
  createAuthUser,
  authedClient,
  seedWorkspaces,
  cleanupUsers,
} from "../business-context/remediation-isolation-fixtures";

// ---------------------------------------------------------------------------
// 008B Task 1 — Meta hierarchy RLS tests
// Workspace member can read seeded meta_campaigns row through authenticated
// client, cannot insert; cross-workspace read denied.
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — Meta Hierarchy (workspace isolation)", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  // -----------------------------------------------------------------------
  // meta_campaigns — authenticated read allowed for same-workspace member
  // -----------------------------------------------------------------------
  describe("meta_campaigns — same-workspace read allowed", () => {
    it("workspace member can SELECT seeded meta_campaigns row", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const campaignId = crypto.randomUUID();
      await svc.from("meta_campaigns").delete().eq("workspace_id", WORKSPACE_A);
      const { error: seedError } = await svc.from("meta_campaigns").upsert({
        id: campaignId,
        workspace_id: WORKSPACE_A,
        meta_ad_account_id: "act-123456",
        meta_campaign_id: "campaign-123",
        name: "Test Campaign",
        raw_metadata_json: { id: "123", name: "Test Campaign" },
        meta_sync_run_id: crypto.randomUUID(),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
      expect(seedError).toBeNull();

      const ownerA = await createAuthUser(`meta-campaign-read-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert({
        workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner",
      });

      const client = authedClient(ownerA.jwt);
      const { data, error } = await client
        .from("meta_campaigns")
        .select("*")
        .eq("id", campaignId);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // meta_campaigns — insert denied for all workspace roles
  // -----------------------------------------------------------------------
  describe("meta_campaigns — insert denied", () => {
    it("owner/editor/viewer cannot INSERT meta_campaigns rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const users = await Promise.all([
        createAuthUser(`meta-campaign-ins-o-${Date.now()}@test.example`),
        createAuthUser(`meta-campaign-ins-e-${Date.now()}@test.example`),
        createAuthUser(`meta-campaign-ins-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );

      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("meta_campaigns").insert({
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          meta_ad_account_id: "act-999999",
          raw_metadata_json: { id: "999", name: "Unauthorized Campaign" },
          meta_sync_run_id: crypto.randomUUID(),
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        });
        expect(error).not.toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // meta_campaigns — cross-workspace read denied
  // -----------------------------------------------------------------------
  describe("meta_campaigns — cross-workspace read denied", () => {
    it("user in workspace B cannot read workspace A meta_campaigns", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const campaignId = crypto.randomUUID();
      await svc.from("meta_campaigns").delete().eq("workspace_id", WORKSPACE_A);
      await svc.from("meta_campaigns").upsert({
        id: campaignId,
        workspace_id: WORKSPACE_A,
        meta_ad_account_id: "act-111111",
        raw_metadata_json: { id: "111", name: "Secret Campaign" },
        meta_sync_run_id: crypto.randomUUID(),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });

      const ownerB = await createAuthUser(`meta-campaign-xws-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert({
        workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner",
      });

      const client = authedClient(ownerB.jwt);
      const { data, error } = await client
        .from("meta_campaigns")
        .select("*")
        .eq("id", campaignId);

      const isEmpty = !data || data.length === 0;
      expect(isEmpty || error !== null).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Unauthenticated access denied
  // -----------------------------------------------------------------------
  describe("meta_campaigns — unauthenticated access denied", () => {
    it("unauthenticated client cannot read meta_campaigns", async () => {
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { data, error } = await unauthClient
        .from("meta_campaigns")
        .select("*")
        .limit(1);

      const isEmpty = !data || data.length === 0;
      expect(isEmpty || error !== null).toBe(true);
    });

    it("unauthenticated client cannot insert meta_campaigns", async () => {
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { error } = await unauthClient.from("meta_campaigns").insert({
        id: crypto.randomUUID(),
        workspace_id: WORKSPACE_A,
        meta_ad_account_id: "act-000000",
        raw_metadata_json: {},
        meta_sync_run_id: crypto.randomUUID(),
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
      expect(error).not.toBeNull();
    });
  });
});
