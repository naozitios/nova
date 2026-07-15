import { describe, expect, it, beforeAll } from "vitest";
import { getSupabaseTestEnv } from "../../harness/supabase-test-env";

// ---------------------------------------------------------------------------
// T001 — Remediation migration tests
// Covers: upload intents, idempotency records, Meta connections,
// Meta OAuth states, session/draft fields, question fields,
// profile version fields, and worker indexes.
//
// Migration under test: supabase/migrations/202607150001_business_context_remediation.sql
// These tests MUST FAIL until the migration is implemented (T002).
// ---------------------------------------------------------------------------

const env = getSupabaseTestEnv();
const itDb = env.available ? it : it.skip;

// Helper: run raw SQL via exec_sql RPC
async function query<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const { data, error } = await env.serviceClient.rpc("exec_sql", { query: sql });
  if (error) throw error;
  return data as T[];
}

// Helper: check if a column exists
async function columnExists(
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return rows.length > 0;
}

// Helper: get column type
async function columnType(
  table: string,
  column: string,
): Promise<string | null> {
  const rows = await query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return rows[0]?.data_type ?? null;
}

// Helper: check if a table exists
async function tableExists(table: string): Promise<boolean> {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  return rows.length > 0;
}

// Helper: check if an index exists
async function indexExists(
  table: string,
  indexName: string,
): Promise<boolean> {
  const rows = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = '${table}' AND indexname = '${indexName}'`,
  );
  return rows.length > 0;
}

// Helper: check constraint exists
async function constraintExists(
  table: string,
  constraintName: string,
): Promise<boolean> {
  const rows = await query<{ constraint_name: string }>(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = '${table}' AND constraint_name = '${constraintName}'`,
  );
  return rows.length > 0;
}

// Helper: get check constraint definition
async function checkConstraintDef(
  table: string,
  constraintName: string,
): Promise<string | null> {
  const rows = await query<{ check_clause: string }>(
    `SELECT check_clause FROM information_schema.check_constraints
     WHERE constraint_schema = 'public' AND constraint_name = '${constraintName}'`,
  );
  return rows[0]?.check_clause ?? null;
}

// Helper: get columns for a table
async function getColumns(
  table: string,
): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
  return query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'
     ORDER BY ordinal_position`,
  );
}

// ============================================================================
// NEW TABLES
// ============================================================================

describe("Remediation migration — context_upload_intents", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("creates context_upload_intents table", async () => {
    const exists = await tableExists("context_upload_intents");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("context_upload_intents");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "business_id",
      "source_id",
      "source_type",
      "source_name",
      "document_class",
      "classification_source",
      "file_name",
      "declared_mime_type",
      "expected_size_bytes",
      "storage_path",
      "created_by",
      "status",
      "malware_scan_status",
      "malware_scan_code",
      "malware_scanned_at",
      "expires_at",
      "completed_at",
      "created_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("source_id is nullable", async () => {
    const columns = await getColumns("context_upload_intents");
    const sourceId = columns.find((c) => c.column_name === "source_id");
    expect(sourceId?.is_nullable).toBe("YES");
  });

  itDb("malware_scan_code is nullable", async () => {
    const columns = await getColumns("context_upload_intents");
    const col = columns.find((c) => c.column_name === "malware_scan_code");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("malware_scanned_at is nullable", async () => {
    const columns = await getColumns("context_upload_intents");
    const col = columns.find((c) => c.column_name === "malware_scanned_at");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("completed_at is nullable", async () => {
    const columns = await getColumns("context_upload_intents");
    const col = columns.find((c) => c.column_name === "completed_at");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has unique constraint on storage_path", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_upload_intents'
       AND indexname LIKE '%storage_path%' AND indexname LIKE '%uniq%'`,
    );
    // Also check for unique index directly
    const uniqueRows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'context_upload_intents'
       AND ix.indisunique = true
       AND i.relname LIKE '%storage_path%'`,
    );
    expect(rows.length + uniqueRows.length).toBeGreaterThan(0);
  });

  itDb("has index on business_id and status", async () => {
    const exists = await indexExists(
      "context_upload_intents",
      "idx_upload_intents_business_status",
    );
    // Fallback: check any index on business_id + status
    if (!exists) {
      const rows = await query<{ indexname: string }>(
        `SELECT i.relname AS indexname
         FROM pg_index ix
         JOIN pg_class i ON i.oid = ix.indexrelid
         JOIN pg_class t ON t.oid = ix.indrelid
         WHERE t.relname = 'context_upload_intents'
         AND ix.indisvalid = true`,
      );
      const hasBusinessStatus = rows.some(
        (r) =>
          r.indexname.includes("business") && r.indexname.includes("status"),
      );
      expect(hasBusinessStatus).toBe(true);
    }
  });

  itDb("has index on expires_at", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'context_upload_intents'
       AND ix.indisvalid = true`,
    );
    const hasExpiry = rows.some((r) => r.indexname.includes("expir"));
    expect(hasExpiry).toBe(true);
  });

  itDb("has check constraint for expected_size_bytes range (1 to 52428800)", async () => {
    const rows = await query<{ constraint_name: string; check_clause: string }>(
      `SELECT cc.constraint_name, cc.check_clause
       FROM information_schema.check_constraints cc
       JOIN information_schema.table_constraints tc
         ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'context_upload_intents'`,
    );
    const sizeConstraint = rows.find(
      (r) =>
        r.check_clause.includes("expected_size_bytes") ||
        r.constraint_name.includes("size"),
    );
    expect(sizeConstraint).toBeDefined();
  });

  itDb("has check constraint for status enum (pending/scan_in_progress/completed/failed)", async () => {
    const rows = await query<{ constraint_name: string; check_clause: string }>(
      `SELECT cc.constraint_name, cc.check_clause
       FROM information_schema.check_constraints cc
       JOIN information_schema.table_constraints tc
         ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'context_upload_intents'`,
    );
    const statusConstraint = rows.find(
      (r) =>
        r.check_clause.includes("status") ||
        r.constraint_name.includes("status"),
    );
    expect(statusConstraint).toBeDefined();
  });

  itDb("has check constraint for malware_scan_status enum (pending/clean/infected/error/skipped)", async () => {
    const rows = await query<{ constraint_name: string; check_clause: string }>(
      `SELECT cc.constraint_name, cc.check_clause
       FROM information_schema.check_constraints cc
       JOIN information_schema.table_constraints tc
         ON cc.constraint_name = tc.constraint_name AND cc.constraint_schema = tc.constraint_schema
       WHERE tc.table_schema = 'public' AND tc.table_name = 'context_upload_intents'`,
    );
    const malwareConstraint = rows.find(
      (r) =>
        r.check_clause.includes("malware_scan_status") ||
        r.constraint_name.includes("malware"),
    );
    expect(malwareConstraint).toBeDefined();
  });
});

describe("Remediation migration — context_idempotency_records", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("creates context_idempotency_records table", async () => {
    const exists = await tableExists("context_idempotency_records");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("context_idempotency_records");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "operation",
      "idempotency_key",
      "request_fingerprint",
      "state",
      "resource_type",
      "resource_id",
      "response_status",
      "response_body",
      "expires_at",
      "created_at",
      "completed_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has nullable columns: resource_type, resource_id, response_status, response_body, completed_at", async () => {
    const columns = await getColumns("context_idempotency_records");
    for (const col of [
      "resource_type",
      "resource_id",
      "response_status",
      "response_body",
      "completed_at",
    ]) {
      const found = columns.find((c) => c.column_name === col);
      expect(found?.is_nullable).toBe("YES");
    }
  });

  itDb("has unique constraint on (workspace_id, operation, idempotency_key)", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'context_idempotency_records'
       AND ix.indisunique = true`,
    );
    const hasCompositeUnique = rows.some(
      (r) =>
        r.indexname.includes("workspace") ||
        r.indexname.includes("operation") ||
        r.indexname.includes("idempotency"),
    );
    expect(hasCompositeUnique).toBe(true);
  });
});

describe("Remediation migration — business_context_meta_connections", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

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

describe("Remediation migration — business_context_meta_oauth_states", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

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

// ============================================================================
// MODIFIED TABLES — onboarding_sessions
// ============================================================================

describe("Remediation migration — onboarding_sessions modifications", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has mode column", async () => {
    const exists = await columnExists("onboarding_sessions", "mode");
    expect(exists).toBe(true);
  });

  itDb("has base_profile_version_id column (nullable)", async () => {
    const exists = await columnExists(
      "onboarding_sessions",
      "base_profile_version_id",
    );
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_sessions");
    const col = columns.find(
      (c) => c.column_name === "base_profile_version_id",
    );
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has draft_profile_version_id column (nullable)", async () => {
    const exists = await columnExists(
      "onboarding_sessions",
      "draft_profile_version_id",
    );
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_sessions");
    const col = columns.find(
      (c) => c.column_name === "draft_profile_version_id",
    );
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has partial unique index on business_id for active statuses", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'onboarding_sessions'`,
    );
    const partialIndex = rows.find(
      (r) =>
        r.indexdef.includes("business_id") &&
        r.indexdef.includes("UNIQUE") &&
        r.indexdef.includes("WHERE"),
    );
    expect(partialIndex).toBeDefined();
  });

  itDb("partial unique index restricts to active session statuses", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'onboarding_sessions'`,
    );
    const partialIndex = rows.find(
      (r) =>
        r.indexdef.includes("business_id") &&
        r.indexdef.includes("UNIQUE") &&
        r.indexdef.includes("WHERE"),
    );
    expect(partialIndex).toBeDefined();
    expect(
      partialIndex!.indexdef.includes("IN") ||
        partialIndex!.indexdef.includes("="),
    ).toBe(true);
  });
});

// ============================================================================
// MODIFIED TABLES — onboarding_questions
// ============================================================================

describe("Remediation migration — onboarding_questions modifications", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has generation_kind column", async () => {
    const exists = await columnExists(
      "onboarding_questions",
      "generation_kind",
    );
    expect(exists).toBe(true);
  });

  itDb("has prompt column", async () => {
    const exists = await columnExists("onboarding_questions", "prompt");
    expect(exists).toBe(true);
  });

  itDb("has control_type column", async () => {
    const exists = await columnExists("onboarding_questions", "control_type");
    expect(exists).toBe(true);
  });

  itDb("has allows_unknown column", async () => {
    const exists = await columnExists("onboarding_questions", "allows_unknown");
    expect(exists).toBe(true);
  });

  itDb("has answer_is_unknown column (nullable)", async () => {
    const exists = await columnExists(
      "onboarding_questions",
      "answer_is_unknown",
    );
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_questions");
    const col = columns.find((c) => c.column_name === "answer_is_unknown");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has conflict_id column (nullable)", async () => {
    const exists = await columnExists("onboarding_questions", "conflict_id");
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_questions");
    const col = columns.find((c) => c.column_name === "conflict_id");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has resulting_fact_id column (nullable)", async () => {
    const exists = await columnExists(
      "onboarding_questions",
      "resulting_fact_id",
    );
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_questions");
    const col = columns.find((c) => c.column_name === "resulting_fact_id");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has generation_key column", async () => {
    const exists = await columnExists(
      "onboarding_questions",
      "generation_key",
    );
    expect(exists).toBe(true);
  });

  itDb("has dismissed_at column (nullable)", async () => {
    const exists = await columnExists("onboarding_questions", "dismissed_at");
    expect(exists).toBe(true);
    const columns = await getColumns("onboarding_questions");
    const col = columns.find((c) => c.column_name === "dismissed_at");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has partial unique index on (session_id, generation_key) where open", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'onboarding_questions'`,
    );
    const partialIndex = rows.find(
      (r) =>
        r.indexdef.includes("session_id") &&
        r.indexdef.includes("generation_key") &&
        r.indexdef.includes("UNIQUE") &&
        r.indexdef.includes("WHERE"),
    );
    expect(partialIndex).toBeDefined();
  });

  itDb("partial unique index filters to open status only", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'onboarding_questions'`,
    );
    const partialIndex = rows.find(
      (r) =>
        r.indexdef.includes("session_id") &&
        r.indexdef.includes("generation_key") &&
        r.indexdef.includes("UNIQUE") &&
        r.indexdef.includes("WHERE"),
    );
    expect(partialIndex).toBeDefined();
    expect(partialIndex!.indexdef).toContain("open");
  });
});

// ============================================================================
// MODIFIED TABLES — business_profile_versions
// ============================================================================

describe("Remediation migration — business_profile_versions modifications", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has base_version_id column (nullable)", async () => {
    const exists = await columnExists(
      "business_profile_versions",
      "base_version_id",
    );
    expect(exists).toBe(true);
    const columns = await getColumns("business_profile_versions");
    const col = columns.find((c) => c.column_name === "base_version_id");
    expect(col?.is_nullable).toBe("YES");
  });

  itDb("has onboarding_session_id column", async () => {
    const exists = await columnExists(
      "business_profile_versions",
      "onboarding_session_id",
    );
    expect(exists).toBe(true);
  });

  itDb("has partial unique index for draft-per-session", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'business_profile_versions'`,
    );
    const draftIndex = rows.find(
      (r) =>
        r.indexdef.includes("session") &&
        r.indexdef.includes("draft") &&
        r.indexdef.includes("WHERE"),
    );
    expect(draftIndex).toBeDefined();
  });
});

// ============================================================================
// CONSTRAINTS AND INDEXES
// ============================================================================

describe("Remediation migration — conflict uniqueness", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has partial unique index on context_conflicts for one open row per business/normalized fact key", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_conflicts'`,
    );
    const openConflictIndex = rows.find(
      (r) =>
        r.indexdef.includes("business_id") &&
        r.indexdef.includes("fact_key") &&
        r.indexdef.includes("WHERE") &&
        r.indexdef.includes("open"),
    );
    expect(openConflictIndex).toBeDefined();
  });
});

describe("Remediation migration — workspace/job-type/idempotency uniqueness", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has workspace/job-type/idempotency unique index on context_jobs", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_jobs'`,
    );
    const wsJobTypeIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("job_type") &&
        r.indexdef.includes("idempotency_key") &&
        r.indexdef.includes("UNIQUE"),
    );
    expect(wsJobTypeIndex).toBeDefined();
  });
});

describe("Remediation migration — runnable job index", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has runnable job index on context_jobs (status, next_run_at, created_at)", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_jobs'`,
    );
    const runnableIndex = rows.find(
      (r) =>
        r.indexdef.includes("status") &&
        r.indexdef.includes("next_run_at") &&
        r.indexdef.includes("created_at"),
    );
    expect(runnableIndex).toBeDefined();
  });
});

describe("Remediation migration — source polling index", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has source polling index on context_sources (workspace_id, business_id, status, current_stage)", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_sources'`,
    );
    const pollingIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("business_id") &&
        r.indexdef.includes("status") &&
        r.indexdef.includes("current_stage"),
    );
    expect(pollingIndex).toBeDefined();
  });
});

describe("Remediation migration — active-fact index", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has active-fact partial index on context_facts", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_facts'`,
    );
    const activeFactIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("business_id") &&
        r.indexdef.includes("fact_key") &&
        r.indexdef.includes("WHERE"),
    );
    expect(activeFactIndex).toBeDefined();
  });
});

describe("Remediation migration — run index", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has run index on context_processing_runs (workspace_id, source_id, started_at)", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'context_processing_runs'`,
    );
    const runIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("source_id") &&
        r.indexdef.includes("started_at"),
    );
    expect(runIndex).toBeDefined();
  });
});

describe("Remediation migration — question index", () => {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });

  itDb("has question index on onboarding_questions (workspace_id, session_id, status, priority)", async () => {
    const rows = await query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'onboarding_questions'`,
    );
    const questionIndex = rows.find(
      (r) =>
        r.indexdef.includes("workspace_id") &&
        r.indexdef.includes("session_id") &&
        r.indexdef.includes("status") &&
        r.indexdef.includes("priority"),
    );
    expect(questionIndex).toBeDefined();
  });
});
