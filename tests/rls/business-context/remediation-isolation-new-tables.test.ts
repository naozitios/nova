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
// New remediation tables — server-ownership denial, unauth, cross-workspace
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — New Remediation Tables (server-owned)", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  // -----------------------------------------------------------------------
  // context_upload_intents — authenticated users cannot mutate server rows
  // -----------------------------------------------------------------------
  describe("context_upload_intents — server-ownership denial", () => {
    const seedRow = () => ({
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      business_id: BUSINESS_A,
      source_type: "product_document",
      source_name: "Test Upload",
      file_name: "test.pdf",
      declared_mime_type: "application/pdf",
      expected_size_bytes: 1024,
      storage_path: `workspaces/${WORKSPACE_A}/businesses/${BUSINESS_A}/uploads/test/test.pdf`,
      created_by: "00000000-0000-0000-0000-000000000001",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    it("owner/editor/viewer cannot INSERT server-owned rows", async () => {
      await seedWorkspaces();
      await seedBusinesses();
      const svc = getServiceClient();

      const ownerA = await createAuthUser(`upload-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`upload-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`upload-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client.from("context_upload_intents").insert(seedRow());
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot UPDATE server-owned rows", async () => {
      await seedWorkspaces();
      await seedBusinesses();
      const svc = getServiceClient();

      const row = seedRow();
      await svc.from("context_upload_intents").upsert(row);

      const ownerA = await createAuthUser(`upload-upd-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`upload-upd-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`upload-upd-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client
          .from("context_upload_intents")
          .update({ source_name: "HACKED" })
          .eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot DELETE server-owned rows", async () => {
      await seedWorkspaces();
      await seedBusinesses();
      const svc = getServiceClient();

      const row = seedRow();
      await svc.from("context_upload_intents").upsert(row);

      const ownerA = await createAuthUser(`upload-del-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`upload-del-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`upload-del-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client
          .from("context_upload_intents")
          .delete()
          .eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });

    it("prevents cross-workspace reads", async () => {
      const svc = getServiceClient();
      const intentId = crypto.randomUUID();
      await svc.from("context_upload_intents").upsert({
        id: intentId,
        workspace_id: WORKSPACE_A,
        business_id: BUSINESS_A,
        source_type: "product_document",
        source_name: "Secret Upload",
        file_name: "secret.pdf",
        declared_mime_type: "application/pdf",
        expected_size_bytes: 2048,
        storage_path: `workspaces/${WORKSPACE_A}/businesses/${BUSINESS_A}/uploads/${intentId}/secret.pdf`,
        created_by: "00000000-0000-0000-0000-000000000001",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });

      const ownerB = await createAuthUser(`upload-xws-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert({
        workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner",
      });

      const client = authedClient(ownerB.jwt);
      const { data, error } = await client
        .from("context_upload_intents")
        .select("*")
        .eq("id", intentId);

      const isEmpty = !data || data.length === 0;
      expect(isEmpty || error !== null).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // context_idempotency_records — server-ownership denial
  // -----------------------------------------------------------------------
  describe("context_idempotency_records — server-ownership denial", () => {
    const seedRow = () => ({
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      operation: "create_source",
      idempotency_key: `idem-key-${Date.now()}`,
      request_fingerprint: "abc123",
      state: "pending",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });

    it("owner/editor/viewer cannot INSERT server-owned rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const ownerA = await createAuthUser(`idem-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`idem-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`idem-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client.from("context_idempotency_records").insert(seedRow());
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot UPDATE server-owned rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const row = seedRow();
      await svc.from("context_idempotency_records").upsert(row);

      const ownerA = await createAuthUser(`idem-upd-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`idem-upd-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`idem-upd-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client
          .from("context_idempotency_records")
          .update({ state: "completed" })
          .eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });

    it("owner/editor/viewer cannot DELETE server-owned rows", async () => {
      await seedWorkspaces();
      const svc = getServiceClient();

      const row = seedRow();
      await svc.from("context_idempotency_records").upsert(row);

      const ownerA = await createAuthUser(`idem-del-owner-${Date.now()}@test.example`);
      const editorA = await createAuthUser(`idem-del-editor-${Date.now()}@test.example`);
      const viewerA = await createAuthUser(`idem-del-viewer-${Date.now()}@test.example`);
      await svc.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
        { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
      ]);

      for (const u of [ownerA, editorA, viewerA]) {
        const client = authedClient(u.jwt);
        const { error } = await client
          .from("context_idempotency_records")
          .delete()
          .eq("id", row.id);
        expect(error).not.toBeNull();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Unauthenticated access denied
  // -----------------------------------------------------------------------
  describe("Unauthenticated access", () => {
    it("denies all reads on remediation tables", async () => {
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const tables: TableName[] = [
        "context_upload_intents",
        "context_idempotency_records",
      ];

      for (const table of tables) {
        const { data, error } = await unauthClient.from(table).select("*").limit(1);
        const isEmpty = !data || data.length === 0;
        expect(isEmpty || error !== null).toBe(true);
      }
    });

    it("denies writes on remediation tables", async () => {
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      const { error: insertError } = await unauthClient.from("context_upload_intents").insert({
        workspace_id: WORKSPACE_A,
        business_id: BUSINESS_A,
        source_type: "product_document",
        source_name: "Unauthorized Upload",
        file_name: "hack.pdf",
        declared_mime_type: "application/pdf",
        expected_size_bytes: 1024,
        storage_path: "hack/hack.pdf",
        created_by: "00000000-0000-0000-0000-000000000000",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });
      expect(insertError).not.toBeNull();
    });
  });
});
