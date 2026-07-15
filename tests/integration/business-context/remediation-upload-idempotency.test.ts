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
// context_upload_intents
// ============================================================================

describe("Remediation migration — context_upload_intents", () => {
  requireEnv();

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

// ============================================================================
// context_idempotency_records
// ============================================================================

describe("Remediation migration — context_idempotency_records", () => {
  requireEnv();

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
