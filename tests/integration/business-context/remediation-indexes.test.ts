import { describe, expect, it, beforeAll } from "vitest";
import { requireEnv, itDb, query } from "./db-introspect-helpers";

// ---------------------------------------------------------------------------
// T001 — Remediation migration: CONSTRAINTS AND INDEXES
// Migration: supabase/migrations/202607150001_business_context_remediation.sql
// These tests MUST FAIL until the migration is implemented (T002).
// ---------------------------------------------------------------------------

describe("Remediation migration — conflict uniqueness", () => {
  requireEnv();

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
  requireEnv();

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
  requireEnv();

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
  requireEnv();

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
  requireEnv();

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
  requireEnv();

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
  requireEnv();

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
