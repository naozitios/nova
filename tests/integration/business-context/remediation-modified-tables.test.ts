import { describe, expect, it, beforeAll } from "vitest";
import {
  requireEnv,
  itDb,
  columnExists,
  getColumns,
  query,
} from "./db-introspect-helpers";

// ---------------------------------------------------------------------------
// T001 — Remediation migration: MODIFIED TABLES
// Migration: supabase/migrations/202607150001_business_context_remediation.sql
// These tests MUST FAIL until the migration is implemented (T002).
// ----------------------------------------------------------------===========

// ============================================================================
// onboarding_sessions
// ============================================================================

describe("Remediation migration — onboarding_sessions modifications", () => {
  requireEnv();

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
// onboarding_questions
// ============================================================================

describe("Remediation migration — onboarding_questions modifications", () => {
  requireEnv();

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
// business_profile_versions
// ============================================================================

describe("Remediation migration — business_profile_versions modifications", () => {
  requireEnv();

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
