import { describe, expect, it, beforeAll } from "vitest";
import { getSupabaseTestEnv } from "../../harness/supabase-test-env";

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

const EXPECTED_BUCKETS = [
  "business-context-sources",
  "business-context-archives",
];

const env = getSupabaseTestEnv();
const itDb = env.available ? it : it.skip;

describe("Migration — tables", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for migration tests"
      );
    }
  });

  itDb("has all expected tables in public schema", async () => {
    const { data, error } = await env.serviceClient.rpc("exec_sql", {
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    });
    if (error) throw error;
    const names = (data as { table_name: string }[]).map((r) => r.table_name);
    const missing = EXPECTED_TABLES.filter((t) => !names.includes(t));
    expect(missing).toEqual([]);
  });

  itDb("RLS is enabled on all tenant-owned tables", async () => {
    const inList = EXPECTED_TABLES.map((t) => `'${t}'`).join(",");
    const { data, error } = await env.serviceClient.rpc("exec_sql", {
      query: `
        SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public' AND c.relname IN (${inList})
      `,
    });
    if (error) throw error;
    const rows = data as { table_name: string; rls_enabled: boolean }[];
    const off = rows.filter((r) => !r.rls_enabled).map((r) => r.table_name);
    expect(off).toEqual([]);
  });
});

describe("Migration — indexes", () => {
  itDb("has one_current_business_profile partial unique index", async () => {
    const { data, error } = await env.serviceClient.rpc("exec_sql", {
      query: `
        SELECT t.relname AS table_name, i.relname AS index_name
        FROM pg_index ix
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_class t ON t.oid = ix.indrelid
        WHERE t.relkind = 'r' AND ix.indisvalid = true
      `,
    });
    if (error) throw error;
    const found = (data as { table_name: string; index_name: string }[]).find(
      (r) => r.table_name === "business_profile_versions" && r.index_name === "one_current_business_profile"
    );
    expect(found).toBeDefined();
  });
});

describe("Migration — storage buckets", () => {
  itDb("has business-context-sources bucket", async () => {
    const { data, error } = await env.serviceClient.storage.listBuckets();
    if (error) throw error;
    const names = data.map((b) => b.name);
    for (const b of EXPECTED_BUCKETS) expect(names).toContain(b);
  });
});
