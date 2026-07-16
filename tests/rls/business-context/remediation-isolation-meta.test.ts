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
} from "./remediation-isolation-fixtures";

// ---------------------------------------------------------------------------
// Meta connection/OAuth tables — server-ownership denial, sanitized view
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — Meta Connections & OAuth (server-owned)", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  // -----------------------------------------------------------------------
  // business_context_meta_connections — direct CRUD denial
  // -----------------------------------------------------------------------
  describe("business_context_meta_connections — server-ownership denial", () => {
    const seedRow = () => ({
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      connected_by: "00000000-0000-0000-0000-000000000001",
      meta_user_id: "meta-user-123",
      encrypted_access_token: "encrypted-token-value",
      status: "connected",
    });

    it("owner/editor/viewer cannot SELECT connection rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_connections").delete().eq("workspace_id", WORKSPACE_A);
      await svc.from("business_context_meta_connections").upsert(seedRow());

      const users = await Promise.all([
        createAuthUser(`meta-sel-o-${Date.now()}@test.example`),
        createAuthUser(`meta-sel-e-${Date.now()}@test.example`),
        createAuthUser(`meta-sel-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { data, error } = await authedClient(u.jwt).from("business_context_meta_connections").select("*");
        expect(!data || data.length === 0 || error !== null).toBe(true);
      }
    });

    it("owner/editor/viewer cannot INSERT connection rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      const users = await Promise.all([
        createAuthUser(`meta-ins-o-${Date.now()}@test.example`),
        createAuthUser(`meta-ins-e-${Date.now()}@test.example`),
        createAuthUser(`meta-ins-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_connections").insert(seedRow());
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot UPDATE connection rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_connections").delete().eq("workspace_id", WORKSPACE_A);
      const row = seedRow();
      await svc.from("business_context_meta_connections").upsert(row);
      const users = await Promise.all([
        createAuthUser(`meta-upd-o-${Date.now()}@test.example`),
        createAuthUser(`meta-upd-e-${Date.now()}@test.example`),
        createAuthUser(`meta-upd-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_connections").update({ status: "revoked" }).eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot DELETE connection rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_connections").delete().eq("workspace_id", WORKSPACE_A);
      const row = seedRow();
      await svc.from("business_context_meta_connections").upsert(row);
      const users = await Promise.all([
        createAuthUser(`meta-del-o-${Date.now()}@test.example`),
        createAuthUser(`meta-del-e-${Date.now()}@test.example`),
        createAuthUser(`meta-del-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_connections").delete().eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // business_context_meta_oauth_states — direct CRUD denial
  // -----------------------------------------------------------------------
  describe("business_context_meta_oauth_states — server-ownership denial", () => {
    const seedRow = () => ({
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      created_by: "00000000-0000-0000-0000-000000000001",
      state_nonce_hash: `nonce-hash-${Date.now()}`,
      return_path: "/api/meta/callback",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    it("owner/editor/viewer cannot SELECT oauth state rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_oauth_states").delete().eq("workspace_id", WORKSPACE_A);
      await svc.from("business_context_meta_oauth_states").upsert(seedRow());

      const users = await Promise.all([
        createAuthUser(`oauth-sel-o-${Date.now()}@test.example`),
        createAuthUser(`oauth-sel-e-${Date.now()}@test.example`),
        createAuthUser(`oauth-sel-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { data, error } = await authedClient(u.jwt).from("business_context_meta_oauth_states").select("*");
        expect(!data || data.length === 0 || error !== null).toBe(true);
      }
    });

    it("owner/editor/viewer cannot INSERT oauth state rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      const users = await Promise.all([
        createAuthUser(`oauth-ins-o-${Date.now()}@test.example`),
        createAuthUser(`oauth-ins-e-${Date.now()}@test.example`),
        createAuthUser(`oauth-ins-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_oauth_states").insert(seedRow());
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot UPDATE oauth state rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_oauth_states").delete().eq("workspace_id", WORKSPACE_A);
      const row = seedRow();
      await svc.from("business_context_meta_oauth_states").upsert(row);
      const users = await Promise.all([
        createAuthUser(`oauth-upd-o-${Date.now()}@test.example`),
        createAuthUser(`oauth-upd-e-${Date.now()}@test.example`),
        createAuthUser(`oauth-upd-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_oauth_states").update({ return_path: "/hacked" }).eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot DELETE oauth state rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_oauth_states").delete().eq("workspace_id", WORKSPACE_A);
      const row = seedRow();
      await svc.from("business_context_meta_oauth_states").upsert(row);
      const users = await Promise.all([
        createAuthUser(`oauth-del-o-${Date.now()}@test.example`),
        createAuthUser(`oauth-del-e-${Date.now()}@test.example`),
        createAuthUser(`oauth-del-v-${Date.now()}@test.example`),
      ]);
      await svc.from("workspace_members").upsert(
        users.map((u, i) => ({ workspace_id: WORKSPACE_A, user_id: u.id, role: (["owner", "editor", "viewer"] as const)[i] })),
      );
      for (const u of users) {
        const { error } = await authedClient(u.jwt).from("business_context_meta_oauth_states").delete().eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Sanitized view — member read excludes encrypted_access_token
  // -----------------------------------------------------------------------
  describe("v_business_context_meta_connections — sanitized view", () => {
    it("workspace member read excludes encrypted_access_token", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_connections").delete().eq("workspace_id", WORKSPACE_A);
      const connId = crypto.randomUUID();
      await svc.from("business_context_meta_connections").upsert({
        id: connId,
        workspace_id: WORKSPACE_A,
        connected_by: "00000000-0000-0000-0000-000000000001",
        meta_user_id: "meta-user-456",
        encrypted_access_token: "super-secret-token",
        status: "connected",
      });

      const ownerA = await createAuthUser(`meta-view-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert({
        workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner",
      });

      const client = authedClient(ownerA.jwt);
      const { data, error } = await client
        .from("v_business_context_meta_connections")
        .select("*")
        .eq("id", connId)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.meta_user_id).toBe("meta-user-456");
      expect(data).not.toHaveProperty("encrypted_access_token");
    });

    it("cross-workspace sanitized read denied", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();
      await svc.from("business_context_meta_connections").delete().eq("workspace_id", WORKSPACE_A);
      const connId = crypto.randomUUID();
      await svc.from("business_context_meta_connections").upsert({
        id: connId,
        workspace_id: WORKSPACE_A,
        connected_by: "00000000-0000-0000-0000-000000000001",
        meta_user_id: "meta-cross-ws",
        encrypted_access_token: "cross-ws-secret",
        status: "connected",
      });

      const ownerB = await createAuthUser(`meta-xws-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert({
        workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner",
      });

      const client = authedClient(ownerB.jwt);
      const { data, error } = await client
        .from("v_business_context_meta_connections")
        .select("*")
        .eq("id", connId);

      const isEmpty = !data || data.length === 0;
      expect(isEmpty || error !== null).toBe(true);
    });
  });
});
