import { describe, expect, it, beforeAll } from "vitest";
import {
  requireEnv,
  itDb,
  tableExists,
  getColumns,
  indexExists,
  query,
} from "../business-context/db-introspect-helpers";

// ---------------------------------------------------------------------------
// 008B Task 1 — Meta Hierarchy Sync Schema Tests
// Migration: supabase/migrations/202607180002_meta_hierarchy_sync.sql
// ---------------------------------------------------------------------------

// ============================================================================
// meta_campaigns
// ============================================================================

describe("Meta hierarchy — meta_campaigns", () => {
  requireEnv();

  itDb("creates meta_campaigns table", async () => {
    const exists = await tableExists("meta_campaigns");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_campaigns");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "meta_ad_account_id",
      "meta_campaign_id",
      "name",
      "objective",
      "effective_status",
      "configured_status",
      "buying_type",
      "start_time",
      "stop_time",
      "provider_created_time",
      "provider_updated_time",
      "raw_metadata_json",
      "meta_sync_run_id",
      "first_seen_at",
      "last_seen_at",
      "archived_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique index idx_meta_campaigns_unique_provider", async () => {
    const exists = await indexExists(
      "meta_campaigns",
      "idx_meta_campaigns_unique_provider",
    );
    expect(exists).toBe(true);
  });

  itDb("workspace_id references workspaces(id)", async () => {
    const rows = await query<{ foreign_key_name: string }>(
      `SELECT tc.constraint_name AS foreign_key_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'meta_campaigns'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'workspace_id'`,
    );
    expect(rows.length).toBe(1);
  });
});

// ============================================================================
// meta_ad_sets
// ============================================================================

describe("Meta hierarchy — meta_ad_sets", () => {
  requireEnv();

  itDb("creates meta_ad_sets table", async () => {
    const exists = await tableExists("meta_ad_sets");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_ad_sets");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "meta_ad_account_id",
      "meta_ad_set_id",
      "meta_campaign_id",
      "name",
      "optimization_goal",
      "billing_event",
      "effective_status",
      "configured_status",
      "daily_budget",
      "lifetime_budget",
      "start_time",
      "end_time",
      "provider_created_time",
      "provider_updated_time",
      "raw_metadata_json",
      "meta_sync_run_id",
      "first_seen_at",
      "last_seen_at",
      "archived_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique index idx_meta_ad_sets_unique_provider", async () => {
    const exists = await indexExists(
      "meta_ad_sets",
      "idx_meta_ad_sets_unique_provider",
    );
    expect(exists).toBe(true);
  });
});

// ============================================================================
// meta_ads
// ============================================================================

describe("Meta hierarchy — meta_ads", () => {
  requireEnv();

  itDb("creates meta_ads table", async () => {
    const exists = await tableExists("meta_ads");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_ads");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "meta_ad_account_id",
      "meta_ad_id",
      "meta_campaign_id",
      "meta_ad_set_id",
      "meta_creative_id",
      "name",
      "effective_status",
      "configured_status",
      "provider_created_time",
      "provider_updated_time",
      "raw_metadata_json",
      "meta_sync_run_id",
      "first_seen_at",
      "last_seen_at",
      "archived_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique index idx_meta_ads_unique_provider", async () => {
    const exists = await indexExists("meta_ads", "idx_meta_ads_unique_provider");
    expect(exists).toBe(true);
  });
});

// ============================================================================
// meta_creatives
// ============================================================================

describe("Meta hierarchy — meta_creatives", () => {
  requireEnv();

  itDb("creates meta_creatives table", async () => {
    const exists = await tableExists("meta_creatives");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_creatives");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "meta_ad_account_id",
      "meta_creative_id",
      "name",
      "title",
      "body",
      "object_story_spec",
      "asset_feed_spec",
      "thumbnail_url",
      "image_url",
      "video_id",
      "effective_object_story_id",
      "provider_created_time",
      "provider_updated_time",
      "raw_metadata_json",
      "meta_sync_run_id",
      "first_seen_at",
      "last_seen_at",
      "archived_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique index idx_meta_creatives_unique_provider", async () => {
    const exists = await indexExists(
      "meta_creatives",
      "idx_meta_creatives_unique_provider",
    );
    expect(exists).toBe(true);
  });
});

// ============================================================================
// meta_sync_runs
// ============================================================================

describe("Meta hierarchy — meta_sync_runs", () => {
  requireEnv();

  itDb("creates meta_sync_runs table", async () => {
    const exists = await tableExists("meta_sync_runs");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_sync_runs");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "meta_ad_account_id",
      "status",
      "mode",
      "idempotency_key",
      "lease_owner",
      "lease_acquired_at",
      "lease_expires_at",
      "heartbeat_at",
      "partition_states",
      "error",
      "started_at",
      "completed_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique constraint on idempotency_key", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'meta_sync_runs'
       AND ix.indisunique = true`,
    );
    const hasIdempotency = rows.some((r) =>
      r.indexname.includes("idempotency"),
    );
    expect(hasIdempotency).toBe(true);
  });
});

// ============================================================================
// meta_sync_checkpoints
// ============================================================================

describe("Meta hierarchy — meta_sync_checkpoints", () => {
  requireEnv();

  itDb("creates meta_sync_checkpoints table", async () => {
    const exists = await tableExists("meta_sync_checkpoints");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_sync_checkpoints");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "run_id",
      "partition_key",
      "cursor",
      "records_upserted",
      "records_quarantined",
      "status",
      "completed_at",
      "created_at",
      "updated_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("has unique constraint on (run_id, partition_key)", async () => {
    const rows = await query<{ indexname: string }>(
      `SELECT i.relname AS indexname
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       WHERE t.relname = 'meta_sync_checkpoints'
       AND ix.indisunique = true`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// meta_sync_attempts
// ============================================================================

describe("Meta hierarchy — meta_sync_attempts", () => {
  requireEnv();

  itDb("creates meta_sync_attempts table", async () => {
    const exists = await tableExists("meta_sync_attempts");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_sync_attempts");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "run_id",
      "partition_key",
      "attempt_number",
      "status",
      "provider_status_code",
      "provider_request_id",
      "duration_ms",
      "records_fetched",
      "records_upserted",
      "records_quarantined",
      "error",
      "created_at",
    ]) {
      expect(names).toContain(col);
    }
  });
});

// ============================================================================
// meta_quarantined_records
// ============================================================================

describe("Meta hierarchy — meta_quarantined_records", () => {
  requireEnv();

  itDb("creates meta_quarantined_records table", async () => {
    const exists = await tableExists("meta_quarantined_records");
    expect(exists).toBe(true);
  });

  itDb("has all required columns", async () => {
    const columns = await getColumns("meta_quarantined_records");
    const names = columns.map((c) => c.column_name);

    for (const col of [
      "id",
      "workspace_id",
      "run_id",
      "source_table",
      "provider_id",
      "redacted_payload",
      "validation_errors",
      "created_at",
    ]) {
      expect(names).toContain(col);
    }
  });

  itDb("redacted_payload has jsonb default", async () => {
    const columns = await getColumns("meta_quarantined_records");
    const col = columns.find((c) => c.column_name === "redacted_payload");
    expect(col?.data_type).toBe("jsonb");
  });

  itDb("validation_errors has jsonb default", async () => {
    const columns = await getColumns("meta_quarantined_records");
    const col = columns.find((c) => c.column_name === "validation_errors");
    expect(col?.data_type).toBe("jsonb");
  });
});

// ============================================================================
// RLS enabled on all tables
// ============================================================================

describe("Meta hierarchy — RLS enabled", () => {
  requireEnv();

  const tables = [
    "meta_campaigns",
    "meta_ad_sets",
    "meta_ads",
    "meta_creatives",
    "meta_sync_runs",
    "meta_sync_checkpoints",
    "meta_sync_attempts",
    "meta_quarantined_records",
  ];

  for (const table of tables) {
    itDb(`RLS enabled on ${table}`, async () => {
      const rows = await query<{ relname: string; relrowsecurity: boolean }>(
        `SELECT c.relname, c.relrowsecurity
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = '${table}'`,
      );
      expect(rows.length).toBe(1);
      expect(rows[0].relrowsecurity).toBe(true);
    });
  }
});
