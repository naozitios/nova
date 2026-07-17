/**
 * Supabase Auth and database reset utilities.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";
import type { SessionOptions, UserOptions, TestUser } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Business-context tables in FK-safe truncation order (children before parents).
 * Supabase service role bypasses RLS, so no policy concerns.
 */
const BUSINESS_CONTEXT_TABLES = [
  "context_audit_log",
  "context_quality_gate_results",
  "context_processing_stage_events",
  "context_processing_runs",
  "context_facts",
  "context_conflicts",
  "onboarding_questions",
  "business_profile_versions",
  "source_documents",
  "context_sources",
  "onboarding_sessions",
  "context_upload_intents",
  "context_jobs",
  "businesses",
];

const ALL_TABLES = [
  ...BUSINESS_CONTEXT_TABLES,
  "workspace_members",
  "workspaces",
];

/** Tracks created user IDs for cleanup. */
const createdUserIds: Set<string> = new Set();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set for E2E tests",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321"
  );
}

// ---------------------------------------------------------------------------
// resetDatabase
// ---------------------------------------------------------------------------

/**
 * Truncate all business-context tables (and workspace tables) in FK-safe order.
 * Uses the Supabase service-role client to bypass RLS.
 */
export async function resetDatabase(): Promise<void> {
  const client = getServiceClient();

  const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

  for (const table of ALL_TABLES) {
    const { error } =
      table === "workspace_members"
        ? await client
            .from(table)
            .delete()
            .neq("workspace_id", ZERO_UUID)
        : await client
            .from(table)
            .delete()
            .neq("id", ZERO_UUID);
    if (error) {
      // Table may not exist or may be empty — log but don't fail
      console.warn(`resetDatabase: delete from ${table}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// createTestSession
// ---------------------------------------------------------------------------

/**
 * Create a NextAuth session cookie for authenticated requests.
 * Signs a JWT using NEXTAUTH_SECRET matching the auth adapter's JWT strategy.
 *
 * @returns The session cookie string (e.g. "next-auth.session-token=<token>; ...")
 */
export async function createTestSession(opts: SessionOptions): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? "test-secret";
  const maxAge = 60 * 60; // 1 hour

  const token = await encode({
    token: {
      sub: opts.userId,
      name: opts.userId,
      email: `test-${opts.userId}@e2e.test`,
      workspaceId: opts.workspaceId,
      role: opts.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + maxAge,
    },
    secret,
  });

  return `next-auth.session-token=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// createTestUser
// ---------------------------------------------------------------------------

/**
 * Create a Supabase Auth user via the admin API and return their JWT.
 * Also optionally creates a workspace membership row for RLS tests.
 *
 * The user is tracked for automatic cleanup by {@link cleanupUsers}.
 */
export async function createTestUser(opts: UserOptions): Promise<TestUser> {
  const client = getServiceClient();
  const url = getSupabaseUrl();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

  // Generate a random password (user won't log in via UI)
  const password = randomUUID();

  // Create user via Supabase Auth admin API
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: JSON.stringify({
      email: opts.email,
      password,
      email_confirm: true,
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(
      `Failed to create auth user ${opts.email}: ${createRes.status} ${body}`,
    );
  }

  const authUser = (await createRes.json()) as {
    id: string;
    email: string;
  };

  // Track for cleanup
  createdUserIds.add(authUser.id);

  // Get an access token for this user
  const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: JSON.stringify({
      email: opts.email,
      password,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(
      `Failed to get token for ${opts.email}: ${tokenRes.status} ${body}`,
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  // Create workspace membership if requested
  if (opts.workspaceId && opts.membershipRole) {
    const { error } = await client.from("workspace_members").upsert({
      workspace_id: opts.workspaceId,
      user_id: authUser.id,
      role: opts.membershipRole,
    });
    if (error) {
      console.warn(
        `createTestUser: upsert membership for ${authUser.id}: ${error.message}`,
      );
    }
  }

  return {
    id: authUser.id,
    email: authUser.email,
    jwt: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
  };
}

// ---------------------------------------------------------------------------
// cleanupUsers
// ---------------------------------------------------------------------------

/**
 * Remove test users from Supabase Auth.
 * Called by cleanup() in harness.ts.
 */
export async function cleanupUsers(): Promise<void> {
  if (createdUserIds.size === 0) return;

  const url = getSupabaseUrl();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

  for (const userId of createdUserIds) {
    try {
      await fetch(`${url}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });
    } catch {
      // Best-effort cleanup
    }
  }
  createdUserIds.clear();
}
