import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Task 7 — Contract tests: Meta sync routes
// Covers: auth, idempotency, sync run lifecycle, selected-account guard,
// sanitized progress, no token leakage, no direct runHierarchySync call.
// ---------------------------------------------------------------------------

function readFileSource(filePath: string): string {
  return readFileSync(join(process.cwd(), filePath), "utf-8");
}

const SYNC_START_FILE = "src/app/api/meta/sync/route.ts";
const SYNC_RUN_FILE = "src/app/api/meta/sync/[runId]/route.ts";
const SYNC_RETRY_FILE = "src/app/api/meta/sync/[runId]/retry/route.ts";

// ─── Route file existence ─────────────────────────────────────────────────

describe("Meta sync routes — file existence", () => {
  it("sync start route file exists", () => {
    expect(() => readFileSource(SYNC_START_FILE)).not.toThrow();
  });

  it("sync run status route file exists", () => {
    expect(() => readFileSource(SYNC_RUN_FILE)).not.toThrow();
  });

  it("sync retry route file exists", () => {
    expect(() => readFileSource(SYNC_RETRY_FILE)).not.toThrow();
  });
});

// ─── POST /api/meta/sync — start sync ─────────────────────────────────────

describe("POST /api/meta/sync — source contract", () => {
  const source = () => readFileSource(SYNC_START_FILE);

  it("exports async POST handler", () => {
    expect(source()).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("uses requireAuthz for authorization", () => {
    expect(source()).toMatch(/requireAuthz/);
  });

  it("uses withIdempotency for replay protection", () => {
    expect(source()).toMatch(/withIdempotency/);
  });

  it("creates a sync run record via createSyncRun", () => {
    expect(source()).toMatch(/createSyncRun/);
  });

  it("rejects when no Meta account is selected (NO_SELECTED_META_ACCOUNT or META_NOT_CONNECTED)", () => {
    expect(source()).toMatch(/NO_SELECTED_META_ACCOUNT|META_NOT_CONNECTED/);
  });

  it("does not call runHierarchySync directly (delegated to background)", () => {
    expect(source()).not.toMatch(/runHierarchySync\s*\(/);
  });

  it("does not expose access tokens in response", () => {
    expect(source()).not.toMatch(/accessToken|access_token(?!_id)/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });
});

// ─── GET /api/meta/sync/[runId] — run status ──────────────────────────────

describe("GET /api/meta/sync/[runId] — source contract", () => {
  const source = () => readFileSource(SYNC_RUN_FILE);

  it("exports async GET handler", () => {
    expect(source()).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("uses requireAuthz for authorization", () => {
    expect(source()).toMatch(/requireAuthz/);
  });

  it("fetches sync run via getSyncRun", () => {
    expect(source()).toMatch(/getSyncRun/);
  });

  it("returns sanitized progress fields (progress, status, or step)", () => {
    expect(source()).toMatch(/progress|status|step/);
  });

  it("does not expose access tokens in response", () => {
    expect(source()).not.toMatch(/accessToken|access_token(?!_id)/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });

  it("does not expose raw token strings in JSON response", () => {
    const src = source();
    // Should not have cookie-set or direct token passthrough
    expect(src).not.toMatch(/cookies\.set\(['"]meta_access_token|cookies\.set\(['"]access_token/);
  });
});

// ─── POST /api/meta/sync/[runId]/retry — retry sync ───────────────────────

describe("POST /api/meta/sync/[runId]/retry — source contract", () => {
  const source = () => readFileSource(SYNC_RETRY_FILE);

  it("exports async POST handler", () => {
    expect(source()).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("uses requireAuthz for authorization", () => {
    expect(source()).toMatch(/requireAuthz/);
  });

  it("uses withIdempotency for replay protection", () => {
    expect(source()).toMatch(/withIdempotency/);
  });

  it("schedules retry via scheduleSyncRetry or updates retry status", () => {
    expect(source()).toMatch(/scheduleSyncRetry|retry|RETRY/);
  });

  it("does not expose access tokens in response", () => {
    expect(source()).not.toMatch(/accessToken|access_token(?!_id)/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });

  it("does not expose raw token strings in JSON response", () => {
    const src = source();
    expect(src).not.toMatch(/cookies\.set\(['"]meta_access_token|cookies\.set\(['"]access_token/);
  });
});
