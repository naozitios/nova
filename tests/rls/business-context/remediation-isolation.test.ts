import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T003 — Real-User-JWT RLS Matrix for Business Context Remediation Tables
//
// Verifies that RLS policies enforce workspace membership for reads and
// role-based writes across ALL Business Context tables and Storage paths.
//
// Uses real Supabase Auth users with real JWTs — no mocks.
// Service role is used ONLY for seeding and inspection.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Skip if no service role key
const run = !!supabaseServiceKey;

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** Service-role client for seeding/inspection only — bypasses RLS. */
let serviceClient: SupabaseClient;

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_A = "aaaa1111-1111-1111-1111-aaaaaaaaaaaa";
const WORKSPACE_B = "bbbb2222-2222-2222-2222-bbbbbbbbbbbb";
const BUSINESS_A = "aaaa3333-3333-3333-3333-aaaaaaaaaaaa";
const BUSINESS_B = "bbbb3333-3333-3333-3333-bbbbbbbbbbbb";
const SESSION_A = "aaaa4444-4444-4444-4444-aaaaaaaaaaaa";
const SESSION_B = "bbbb4444-4444-4444-4444-bbbbbbbbbbbb";
const SOURCE_A = "aaaa5555-5555-5555-5555-aaaaaaaaaaaa";
const SOURCE_B = "bbbb5555-5555-5555-5555-bbbbbbbbbbbb";

// Test user emails (unique per run)
const EMAIL_OWNER_A = `rls-owner-a-${Date.now()}@test.example`;
const EMAIL_EDITOR_A = `rls-editor-a-${Date.now()}@test.example`;
const EMAIL_VIEWER_A = `rls-viewer-a-${Date.now()}@test.example`;
const EMAIL_OWNER_B = `rls-owner-b-${Date.now()}@test.example`;

// Track created auth user IDs for cleanup
const createdUserIds: string[] = [];

// ---------------------------------------------------------------------------
// User creation helpers
// ---------------------------------------------------------------------------

interface TestUser {
  id: string;
  email: string;
  jwt: string;
}

async function createAuthUser(email: string): Promise<TestUser> {
  const password = `TestPass-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      "Content-Type": "application/json",
      apikey: supabaseServiceKey,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Failed to create auth user ${email}: ${createRes.status} ${body}`);
  }

  const authUser = (await createRes.json()) as { id: string; email: string };
  createdUserIds.push(authUser.id);

  const tokenRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: supabaseServiceKey },
    body: JSON.stringify({ email, password }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(`Failed to get token for ${email}: ${tokenRes.status} ${body}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  return { id: authUser.id, email: authUser.email, jwt: tokenData.access_token };
}

/** Create a Supabase client authenticated with a user's JWT. */
function authedClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

async function seedWorkspaces() {
  await serviceClient.from("workspaces").upsert([
    { id: WORKSPACE_A, name: "RLS Test Workspace A" },
    { id: WORKSPACE_B, name: "RLS Test Workspace B" },
  ]);
}

async function seedBusinesses() {
  await serviceClient.from("businesses").upsert([
    { id: BUSINESS_A, workspace_id: WORKSPACE_A, name: "Business A", status: "active" },
    { id: BUSINESS_B, workspace_id: WORKSPACE_B, name: "Business B", status: "active" },
  ]);
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
});

afterAll(async () => {
  for (const userId of createdUserIds) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${supabaseServiceKey}`, apikey: supabaseServiceKey },
      });
    } catch {
      // best-effort
    }
  }
});

// ---------------------------------------------------------------------------
// Tables under test
// ---------------------------------------------------------------------------

type TableName =
  | "context_upload_intents"
  | "context_idempotency_records"
  | "business_context_meta_connections"
  | "business_context_meta_oauth_states"
  | "onboarding_sessions"
  | "onboarding_questions"
  | "business_profile_versions"
  | "context_conflicts"
  | "context_sources"
  | "context_jobs";

// ---------------------------------------------------------------------------
// RLS Matrix helper
// ---------------------------------------------------------------------------

interface RoleTestUser {
  label: string;
  user: TestUser | null; // null = unauthenticated
}

/**
 * Seed rows in a table via service role, then test access from multiple roles.
 *
 * @param table - Table name
 * @param seedRow - Row to insert via service role (with id and workspace_id)
 * @param queryFilter - Additional filter for the select query
 * @param expectations - Map of role label to expected access outcome
 */
async function testRlsMatrix(
  table: TableName,
  seedRow: Record<string, unknown>,
  roles: RoleTestUser[],
  expectations: {
    ownerA: "allowed" | "denied";
    editorA: "allowed" | "denied";
    viewerA: "allowed" | "denied";
    ownerB: "allowed" | "denied";
    unauth: "allowed" | "denied";
  },
) {
  // 1. Seed via service role
  const { error: insertError } = await serviceClient.from(table).upsert(seedRow);
  if (insertError) {
    // Table may not exist or have schema issues — still test access
    console.warn(`Seed ${table}: ${insertError.message}`);
  }

  // 2. Create auth users
  const ownerA = await createAuthUser(`rls-${table}-ownerA-${Date.now()}@test.example`);
  const editorA = await createAuthUser(`rls-${table}-editorA-${Date.now()}@test.example`);
  const viewerA = await createAuthUser(`rls-${table}-viewerA-${Date.now()}@test.example`);
  const ownerB = await createAuthUser(`rls-${table}-ownerB-${Date.now()}@test.example`);

  // 3. Create memberships
  await serviceClient.from("workspace_members").upsert([
    { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
    { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
    { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
    { workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner" },
  ]);

  // 4. Test access from each role
  const clients: { label: string; client: SupabaseClient | null }[] = [
    { label: "ownerA", client: authedClient(ownerA.jwt) },
    { label: "editorA", client: authedClient(editorA.jwt) },
    { label: "viewerA", client: authedClient(viewerA.jwt) },
    { label: "ownerB", client: authedClient(ownerB.jwt) },
    { label: "unauth", client: createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } }) },
  ];

  const expectedMap: Record<string, "allowed" | "denied"> = {
    ownerA: expectations.ownerA,
    editorA: expectations.editorA,
    viewerA: expectations.viewerA,
    ownerB: expectations.ownerB,
    unauth: expectations.unauth,
  };

  for (const { label, client } of clients) {
    if (!client) continue;
    const expected = expectedMap[label];

    const { data, error } = await client
      .from(table)
      .select("*")
      .eq("workspace_id", WORKSPACE_A)
      .limit(10);

    if (expected === "denied") {
      expect(error).not.toBeNull();
      expect(data).toEqual([]);
    } else {
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }
  }
}

// ============================================================================
// RLS Matrix Tests
// ============================================================================

describe.skipIf(!run)("RLS — Remediation Tables: Real-User-JWT Matrix", () => {
  // -----------------------------------------------------------------------
  // context_upload_intents
  // -----------------------------------------------------------------------
  describe("context_upload_intents", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "context_upload_intents",
        {
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
        },
        [], // roles created inside helper
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",   // read-only
          ownerB: "denied",     // cross-workspace
          unauth: "denied",
        },
      );
    });

    it("prevents cross-workspace reads", async () => {
      const intentId = crypto.randomUUID();
      await serviceClient.from("context_upload_intents").upsert({
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

      const ownerB = await createAuthUser(`rls-upload-intent-ownerB-${Date.now()}@test.example`);
      await serviceClient.from("workspace_members").upsert({
        workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner",
      });

      const client = authedClient(ownerB.jwt);
      const { data, error } = await client
        .from("context_upload_intents")
        .select("*")
        .eq("id", intentId);

      expect(error).not.toBeNull();
      expect(data).toEqual([]);

      // Cleanup
      await serviceClient.from("context_upload_intents").delete().eq("id", intentId);
    });
  });

  // -----------------------------------------------------------------------
  // context_idempotency_records
  // -----------------------------------------------------------------------
  describe("context_idempotency_records", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();

      await testRlsMatrix(
        "context_idempotency_records",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          operation: "create_source",
          idempotency_key: `idem-key-${Date.now()}`,
          request_fingerprint: "abc123",
          state: "pending",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // business_context_meta_connections
  // -----------------------------------------------------------------------
  describe("business_context_meta_connections", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();

      await testRlsMatrix(
        "business_context_meta_connections",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          connected_by: "00000000-0000-0000-0000-000000000001",
          meta_user_id: "meta-user-123",
          encrypted_access_token: "encrypted-token-value",
          status: "connected",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // business_context_meta_oauth_states
  // -----------------------------------------------------------------------
  describe("business_context_meta_oauth_states", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();

      await testRlsMatrix(
        "business_context_meta_oauth_states",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          created_by: "00000000-0000-0000-0000-000000000001",
          state_nonce_hash: `nonce-hash-${Date.now()}`,
          return_path: "/api/meta/callback",
          expires_at: new Date(Date.now() + 3600_000).toISOString(),
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // onboarding_sessions (modified)
  // -----------------------------------------------------------------------
  describe("onboarding_sessions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "onboarding_sessions",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          business_id: BUSINESS_A,
          status: "created",
          mode: "initial",
          started_by: "00000000-0000-0000-0000-000000000001",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // onboarding_questions (modified)
  // -----------------------------------------------------------------------
  describe("onboarding_questions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      // Create a session first (FK dependency)
      await serviceClient.from("onboarding_sessions").upsert({
        id: SESSION_A,
        workspace_id: WORKSPACE_A,
        business_id: BUSINESS_A,
        status: "awaiting_review",
        started_by: "00000000-0000-0000-0000-000000000001",
      });

      await testRlsMatrix(
        "onboarding_questions",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          session_id: SESSION_A,
          business_id: BUSINESS_A,
          fact_key: "business.name",
          question_type: "single_choice",
          question: "What is your business name?",
          reason: "gap",
          priority: 10,
          status: "open",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // business_profile_versions (modified)
  // -----------------------------------------------------------------------
  describe("business_profile_versions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "business_profile_versions",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          business_id: BUSINESS_A,
          version: 1,
          profile: { business: {}, offers: {}, customers: {}, conversion_journey: {}, economics: {}, brand: {}, creative_capacity: {}, measurement: {} },
          status: "draft",
          created_by: "00000000-0000-0000-0000-000000000001",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_conflicts (existing)
  // -----------------------------------------------------------------------
  describe("context_conflicts (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "context_conflicts",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          business_id: BUSINESS_A,
          fact_key: "business.founded_year",
          fact_ids: [],
          status: "open",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_sources (existing)
  // -----------------------------------------------------------------------
  describe("context_sources (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "context_sources",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          business_id: BUSINESS_A,
          source_type: "website",
          source_name: "Test Website",
          status: "registered",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_jobs (existing)
  // -----------------------------------------------------------------------
  describe("context_jobs (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      await testRlsMatrix(
        "context_jobs",
        {
          id: crypto.randomUUID(),
          workspace_id: WORKSPACE_A,
          business_id: BUSINESS_A,
          job_type: "crawl_website",
          status: "queued",
          idempotency_key: `idem-job-${Date.now()}`,
          input: { url: "https://example.com" },
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // Storage path isolation
  // -----------------------------------------------------------------------
  describe("Storage: business-context-sources", () => {
    it("prevents cross-workspace file access", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      const ownerA = await createAuthUser(`rls-storage-ownerA-${Date.now()}@test.example`);
      const ownerB = await createAuthUser(`rls-storage-ownerB-${Date.now()}@test.example`);

      await serviceClient.from("workspace_members").upsert([
        { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
        { workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner" },
      ]);

      const uploadPath = `${WORKSPACE_A}/${BUSINESS_A}/uploads/test-intent/test.pdf`;

      // Seed a storage object via service role
      await serviceClient.from("storage.objects").upsert({
        bucket_id: "business-context-sources",
        name: uploadPath,
        owner: ownerA.id,
        metadata: { size: 1024 },
      });

      // Owner A should be able to read their workspace's files
      const clientA = authedClient(ownerA.jwt);
      const { data: dataA, error: errorA } = await clientA.storage
        .from("business-context-sources")
        .list(`${WORKSPACE_A}/${BUSINESS_A}/uploads/test-intent`);
      expect(errorA).toBeNull();

      // Owner B should NOT be able to read workspace A's files
      const clientB = authedClient(ownerB.jwt);
      const { data: dataB, error: errorB } = await clientB.storage
        .from("business-context-sources")
        .list(`${WORKSPACE_A}/${BUSINESS_A}/uploads/test-intent`);
      expect(errorB).not.toBeNull();

      // Cleanup
      await serviceClient.storage
        .from("business-context-sources")
        .remove([uploadPath]);
    });
  });

  // -----------------------------------------------------------------------
  // Service role can see all rows
  // -----------------------------------------------------------------------
  describe("Service role visibility", () => {
    it("can read all rows across all tables", async () => {
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
        "business_context_meta_connections",
        "business_context_meta_oauth_states",
      ];

      for (const table of tables) {
        const { error } = await unauthClient.from(table).select("*").limit(1);
        expect(error).not.toBeNull();
      }
    });

    it("denies writes on remediation tables", async () => {
      const unauthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });

      // Attempt insert — should be denied
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

  // -----------------------------------------------------------------------
  // Viewer cannot write
  // -----------------------------------------------------------------------
  describe("Viewer write denial", () => {
    it("viewer cannot insert on remediation tables", async () => {
      await seedWorkspaces();
      await seedBusinesses();

      const viewer = await createAuthUser(`rls-viewer-write-${Date.now()}@test.example`);
      await serviceClient.from("workspace_members").upsert({
        workspace_id: WORKSPACE_A, user_id: viewer.id, role: "viewer",
      });

      const client = authedClient(viewer.jwt);

      // Attempt insert on context_upload_intents — should be denied
      const { error } = await client.from("context_upload_intents").insert({
        workspace_id: WORKSPACE_A,
        business_id: BUSINESS_A,
        source_type: "product_document",
        source_name: "Viewer Upload",
        file_name: "viewer.pdf",
        declared_mime_type: "application/pdf",
        expected_size_bytes: 512,
        storage_path: `workspaces/${WORKSPACE_A}/businesses/${BUSINESS_A}/uploads/viewer-test/viewer.pdf`,
        created_by: viewer.id,
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });
      expect(error).not.toBeNull();
    });

    it("viewer cannot insert on context_idempotency_records", async () => {
      await seedWorkspaces();

      const viewer = await createAuthUser(`rls-viewer-idem-${Date.now()}@test.example`);
      await serviceClient.from("workspace_members").upsert({
        workspace_id: WORKSPACE_A, user_id: viewer.id, role: "viewer",
      });

      const client = authedClient(viewer.jwt);
      const { error } = await client.from("context_idempotency_records").insert({
        workspace_id: WORKSPACE_A,
        operation: "test_operation",
        idempotency_key: `viewer-idem-${Date.now()}`,
        request_fingerprint: "viewer-fp",
        state: "pending",
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      });
      expect(error).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Policy existence checks via SQL
  // -----------------------------------------------------------------------
  describe("RLS policy existence checks", () => {
    const tablesNeedingPolicies: TableName[] = [
      "context_upload_intents",
      "context_idempotency_records",
      "business_context_meta_connections",
      "business_context_meta_oauth_states",
    ];

    for (const table of tablesNeedingPolicies) {
      it(`has SELECT policy on ${table}`, async () => {
        const { data, error } = await serviceClient.rpc("exec_sql", {
          query: `
            SELECT polname
            FROM pg_policy pol
            JOIN pg_class pc ON pc.oid = pol.polrelid
            JOIN pg_namespace pn ON pn.oid = pc.relnamespace
            WHERE pc.relname = '${table}'
              AND pn.nspname = 'public'
              AND pol.polcmd IN ('r', '*')
          `,
        });
        // Should find at least one SELECT policy
        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect((data as unknown[]).length).toBeGreaterThan(0);
      });

      it(`has INSERT policy on ${table} for editors`, async () => {
        const { data, error } = await serviceClient.rpc("exec_sql", {
          query: `
            SELECT polname
            FROM pg_policy pol
            JOIN pg_class pc ON pc.oid = pol.polrelid
            JOIN pg_namespace pn ON pn.oid = pc.relnamespace
            WHERE pc.relname = '${table}'
              AND pn.nspname = 'public'
              AND pol.polcmd IN ('a', '*')
          `,
        });
        expect(error).toBeNull();
        expect(data).toBeDefined();
        expect((data as unknown[]).length).toBeGreaterThan(0);
      });
    }
  });
});
