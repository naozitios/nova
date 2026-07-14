import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T018 — Schema migration smoke test
// Verifies that all PRD tables exist in the local Supabase and the
// one_current_business_profile partial unique index is present.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const EXPECTED_TABLES = [
  "workspaces",
  "workspace_members",
  "businesses",
  "onboarding_sessions",
  "context_sources",
  "source_documents",
  "context_facts",
  "context_conflicts",
  "onboarding_questions",
  "business_profile_versions",
  "context_jobs",
  "context_processing_runs",
  "context_processing_stage_events",
  "context_quality_gate_results",
  "context_provider_circuit_breakers",
  "context_audit_log",
];

const EXPECTED_INDEXES = [
  { table: "business_profile_versions", index: "one_current_business_profile" },
];

async function getTableNames(): Promise<string[]> {
  const { data, error } = await supabase.rpc("exec_sql", {
    query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  });
  if (error) throw new Error(`Failed to query tables: ${error.message}`);
  return (data as { table_name: string }[]).map((r) => r.table_name);
}

async function getIndexNames(): Promise<{ table: string; index: string }[]> {
  const { data, error } = await supabase.rpc("exec_sql", {
    query: `
      SELECT
        t.relname AS table_name,
        i.relname AS index_name
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      WHERE t.relkind = 'r'
        AND ix.indisvalid = true
    `,
  });
  if (error) throw new Error(`Failed to query indexes: ${error.message}`);
  return data as { table_name: string; index_name: string }[];
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Migration — all PRD tables exist", () => {
  it.skipIf(!supabaseServiceKey)(
    "has all expected tables in public schema",
    async () => {
      const tables = await getTableNames();
      const missing = EXPECTED_TABLES.filter((t) => !tables.includes(t));
      expect(missing).toEqual([]);
    },
  );
});

describe("Migration — one_current_business_profile index", () => {
  it.skipIf(!supabaseServiceKey)(
    "partial unique index exists on business_profile_versions",
    async () => {
      const indexes = await getIndexNames();
      const found = indexes.find(
        (idx) =>
          idx.table === "business_profile_versions" &&
          idx.index === "one_current_business_profile",
      );
      expect(found).toBeDefined();
    },
  );
});

describe("Migration — workspace RLS enabled", () => {
  it.skipIf(!supabaseServiceKey)(
    "RLLS is enabled on tenant-owned tables",
    async () => {
      const { data, error } = await supabase.rpc("exec_sql", {
        query: `
          SELECT
            c.relname AS table_name,
            c.relrowsecurity AS rls_enabled
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind = 'r'
            AND n.nspname = 'public'
            AND c.relname IN (${EXPECTED_TABLES.map((t) => `'${t}'`).join(",")})
        `,
      });
      if (error) throw new Error(`Failed to query RLS: ${error.message}`);

      const rows = data as { table_name: string; rls_enabled: boolean }[];
      const rlsDisabled = rows.filter((r) => !r.rls_enabled).map((r) => r.table_name);
      expect(rlsDisabled).toEqual([]);
    },
  );
});

describe("Migration — storage buckets exist", () => {
  it.skipIf(!supabaseServiceKey)(
    "business-context-sources bucket exists",
    async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`Failed to list buckets: ${error.message}`);
      const names = data.map((b) => b.name);
      expect(names).toContain("business-context-sources");
    },
  );

  it.skipIf(!supabaseServiceKey)(
    "business-context-archives bucket exists",
    async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw new Error(`Failed to list buckets: ${error.message}`);
      const names = data.map((b) => b.name);
      expect(names).toContain("business-context-archives");
    },
  );
});
