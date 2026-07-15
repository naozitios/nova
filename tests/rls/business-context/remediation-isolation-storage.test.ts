import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  run,
  supabaseUrl,
  supabaseAnonKey,
  WORKSPACE_A,
  WORKSPACE_B,
  BUSINESS_A,
  initServiceClient,
  getServiceClient,
  createAuthUser,
  authedClient,
  seedWorkspaces,
  seedBusinesses,
  cleanupUsers,
  type TableName,
} from "./remediation-isolation-fixtures";

// ---------------------------------------------------------------------------
// Storage path isolation + service role visibility
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — Storage & Service Role", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  // -----------------------------------------------------------------------
  // Storage path isolation
  // -----------------------------------------------------------------------
  describe("Storage: business-context-sources", () => {
    it("prevents cross-workspace file access", async () => {
      const wsA = crypto.randomUUID();
      const wsB = crypto.randomUUID();
      const bizA = crypto.randomUUID();
      const svc = getServiceClient();

      await svc.from("workspaces").upsert([
        { id: wsA, name: `WS-A-${wsA.slice(0,8)}` },
        { id: wsB, name: `WS-B-${wsB.slice(0,8)}` },
      ]);
      await svc.from("businesses").upsert({
        id: bizA, workspace_id: wsA, name: `Biz-${bizA.slice(0,8)}`, status: "active",
      });

      const ownerA = await createAuthUser(`rls-storage-ownerA-${Date.now()}@test.example`);
      const ownerB = await createAuthUser(`rls-storage-ownerB-${Date.now()}@test.example`);

      await svc.from("workspace_members").upsert([
        { workspace_id: wsA, user_id: ownerA.id, role: "owner" },
        { workspace_id: wsB, user_id: ownerB.id, role: "owner" },
      ]);

      const uploadPath = `${wsA}/${bizA}/uploads/test-intent/test.pdf`;

      const clientA = authedClient(ownerA.jwt);
      const { error: uploadErr } = await clientA.storage
        .from("business-context-sources")
        .upload(uploadPath, new Uint8Array([1, 2, 3]), { contentType: "application/pdf", upsert: true });
      expect(uploadErr).toBeNull();

      const { data: dataA, error: errorA } = await clientA.storage
        .from("business-context-sources")
        .list(`${wsA}/${bizA}/uploads/test-intent`);
      expect(errorA).toBeNull();
      expect(dataA).toBeDefined();
      expect(dataA!.length).toBeGreaterThanOrEqual(1);

      const clientB = authedClient(ownerB.jwt);
      const { data: dataB, error: errorB } = await clientB.storage
        .from("business-context-sources")
        .list(`${wsA}/${bizA}/uploads/test-intent`);
      // Storage list returns empty data (not error) when RLS blocks access
      const isEmptyOrError = !dataB || dataB.length === 0 || errorB !== null;
      expect(isEmptyOrError).toBe(true);

      await svc.storage.from("business-context-sources").remove([uploadPath]);
    });
  });

  // -----------------------------------------------------------------------
  // Service role can see all rows
  // -----------------------------------------------------------------------
  describe("Service role visibility", () => {
    it("can read all rows across all tables", async () => {
      const serviceClient = getServiceClient();
      const tables: TableName[] = [
        "context_upload_intents",
        "context_idempotency_records",
        "business_context_meta_connections",
        "business_context_meta_oauth_states",
        "onboarding_sessions",
        "onboarding_questions",
        "business_profile_versions",
        "context_conflicts",
        "context_sources",
        "context_jobs",
      ];

      for (const table of tables) {
        const { error } = await serviceClient.from(table).select("*").limit(1);
        expect(error).toBeNull();
      }
    });
  });
});
