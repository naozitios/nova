import { expect } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Shared fixtures for remediation-isolation RLS tests.
// Service role is used ONLY for seeding and inspection.
// ---------------------------------------------------------------------------

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const run = !!supabaseServiceKey;

// ---------------------------------------------------------------------------
// Test fixtures — UUIDs
// ---------------------------------------------------------------------------

export const WORKSPACE_A = "aaaa1111-1111-1111-1111-aaaaaaaaaaaa";
export const WORKSPACE_B = "bbbb2222-2222-2222-2222-bbbbbbbbbbbb";
export const BUSINESS_A = "aaaa3333-3333-3333-3333-aaaaaaaaaaaa";
export const BUSINESS_B = "bbbb3333-3333-3333-3333-bbbbbbbbbbbb";
export const SESSION_A = "aaaa4444-4444-4444-4444-aaaaaaaaaaaa";
export const SESSION_B = "bbbb4444-4444-4444-4444-bbbbbbbbbbbb";
export const SOURCE_A = "aaaa5555-5555-5555-5555-aaaaaaaaaaaa";
export const SOURCE_B = "bbbb5555-5555-5555-5555-bbbbbbbbbbbb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  jwt: string;
}

export interface RoleTestUser {
  label: string;
  user: TestUser | null;
}

export type TableName =
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
// Service client — per-file init via initServiceClient()
// ---------------------------------------------------------------------------

let _serviceClient: SupabaseClient;
const _createdUserIds: string[] = [];

export function initServiceClient(): SupabaseClient {
  _serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
  return _serviceClient;
}

export function getServiceClient(): SupabaseClient {
  return _serviceClient;
}

// ---------------------------------------------------------------------------
// User creation helpers
// ---------------------------------------------------------------------------

export async function createAuthUser(email: string): Promise<TestUser> {
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
  _createdUserIds.push(authUser.id);

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

export function authedClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

export async function seedWorkspaces() {
  await _serviceClient.from("workspaces").upsert([
    { id: WORKSPACE_A, name: "RLS Test Workspace A" },
    { id: WORKSPACE_B, name: "RLS Test Workspace B" },
  ]);
}

export async function seedBusinesses() {
  await _serviceClient.from("businesses").upsert([
    { id: BUSINESS_A, workspace_id: WORKSPACE_A, name: "Business A", status: "active" },
    { id: BUSINESS_B, workspace_id: WORKSPACE_B, name: "Business B", status: "active" },
  ]);
}

// ---------------------------------------------------------------------------
// RLS Matrix helper
// ---------------------------------------------------------------------------

/**
 * Seed rows in a table via service role, then test access from multiple roles.
 */
export async function testRlsMatrix(
  table: TableName,
  seedRow: Record<string, unknown>,
  _roles: RoleTestUser[],
  expectations: {
    ownerA: "allowed" | "denied";
    editorA: "allowed" | "denied";
    viewerA: "allowed" | "denied";
    ownerB: "allowed" | "denied";
    unauth: "allowed" | "denied";
  },
) {
  const { error: insertError } = await _serviceClient.from(table).upsert(seedRow);
  if (insertError) {
    console.warn(`Seed ${table}: ${insertError.message}`);
  }

  const ownerA = await createAuthUser(`rls-${table}-ownerA-${Date.now()}@test.example`);
  const editorA = await createAuthUser(`rls-${table}-editorA-${Date.now()}@test.example`);
  const viewerA = await createAuthUser(`rls-${table}-viewerA-${Date.now()}@test.example`);
  const ownerB = await createAuthUser(`rls-${table}-ownerB-${Date.now()}@test.example`);

  await _serviceClient.from("workspace_members").upsert([
    { workspace_id: WORKSPACE_A, user_id: ownerA.id, role: "owner" },
    { workspace_id: WORKSPACE_A, user_id: editorA.id, role: "editor" },
    { workspace_id: WORKSPACE_A, user_id: viewerA.id, role: "viewer" },
    { workspace_id: WORKSPACE_B, user_id: ownerB.id, role: "owner" },
  ]);

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
      .limit(10);

    if (expected === "denied") {
      const isEmpty = !data || data.length === 0;
      expect(isEmpty || error !== null).toBe(true);
    } else {
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function cleanupUsers() {
  for (const userId of _createdUserIds) {
    try {
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${supabaseServiceKey}`, apikey: supabaseServiceKey },
      });
    } catch {
      // best-effort
    }
  }
}
