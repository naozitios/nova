import { describe, expect, it, beforeAll } from "vitest";
import {
  requireEnv,
  itDb,
  tableExists,
  getColumns,
  indexExists,
  query,
} from "./db-introspect-helpers";

// ---------------------------------------------------------------------------
// T001 — Remediation migration: NEW TABLES
// Migration: supabase/migrations/202607150001_business_context_remediation.sql
// These tests MUST FAIL until the migration is implemented (T002).
// ---------------------------------------------------------------------------

// ============================================================================
// business_context_meta_connections
// ============================================================================

describe("Remediation migration — business_context_meta_connections", () => {
  requireEnv();

  itDb("creates business_context_meta_connections table", async () => {
    const exists = await tableExists("business_context_meta_connections");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("business_context_meta_connections");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "connected_by",
      "meta_user_id",
      "encrypted_access_token",
      "token_expires_at",
      "selected_ad_account_id",
      "account_metadata",
      "status",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("token_expires_at is nullable", async () => {
    const columns = await getColumns("business_context_meta_connections");
    const col = columns.find((c) => c.column_name === "token_expires_at");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("selected_ad_account_id is nullable", async () => {
    const columns = await getColumns("business_context_meta_connections");
    const col = columns.find(
      (c) => c.column_name === "selected_ad_account_id",
    );
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has check constraint for status enum (connected/expired/disconnected/error)", async () => {
    const rows = await query<{ constraint_name: string; check_clause: string }>(
      `SELECT cc.constraint_name, cc.check_clause
       FROM information_schema.check_constraints cc
       JOIN information_schema.table_constraints tc
         ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'business_context_meta_connections'`,
    );
    const statusConstraint = rows.find(
      (r) =>
        r.check_clause.includes("status") ||
        r.constraint_name.includes("status"),
    );
    expect(statusConstraint).toBeDefined();
  });

  itDb("has partial unique index enforcing one connected per workspace", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'business_context_meta_connections'`,
    );
    const connectedIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("UNIQUE") &&
        r.indexdef.includes("WHERE") &&
        r.indexdef.includes("connected"),
    );
    expect(connectedIndex).toBeDefined();
  });
});

// ============================================================================
// business_context_meta_oauth_states
// ============================================================================

describe("Remediation migration — business_context_meta_oauth_states", () => {
  requireEnv();

  itDb("creates business_context_meta_oauth_states table", async () => {
    const exists = await tableExists("business_context_meta_oauth_states");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("business_context_meta_oauth_states");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "created_by",
      "state_nonce_hash",
      "return_path",
      "expires_at",
      "consumed_at",
      "provider_code_hash",
      "created_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique constraint on state_nonce_hash", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'business_context_meta_oauth_states'
       AND ix.indisunique = true`,
    );
    const hasNonceUnique = rows.some((r) =>
      r.indexname.includes("nonce"),
    );
    expect(hasNonceUnique).toBe(true);
  });

  itDb("has unique constraint on provider_code_hash", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'business_context_meta_oauth_states'
       AND ix.indisunique = true`,
    );
    const hasCodeHashUnique = rows.some((r) =>
      r.indexname.includes("code_hash") || r.indexname.includes("provider"),
    );
    expect(hasCodeHashUnique).toBe(true);
  });

  itDb("consumed_at is nullable", async () => {
    const columns = await getColumns("business_context_meta_oauth_states");
    const col = columns.find((c) => c.column_name === "consumed_at");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("provider_code_hash is nullable", async () => {
    const columns = await getColumns("business_context_meta_oauth_states");
    const col = columns.find((c) => c.column_name === "provider_code_hash");
    expect(col?.is_nullable).toBe("YES");
  });
});
