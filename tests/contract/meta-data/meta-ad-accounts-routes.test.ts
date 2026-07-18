import { describe, expect, it } from "vitest";
import { readFileSource } from "../business-context/_idempotency-helpers";

// ---------------------------------------------------------------------------
// Task 6 — Contract tests: Meta ad-accounts routes
// Covers: file existence, exports, authz, dependency usage, token safety,
// field completeness, select-account constraints.
// ---------------------------------------------------------------------------

const LIST_FILE = "src/app/api/meta/ad-accounts/route.ts";
const SELECT_FILE = "src/app/api/meta/ad-accounts/[accountId]/select/route.ts";
const ADAPTER_FILE = "src/infrastructure/meta/meta-api.adapter.ts";

// ─── File existence ────────────────────────────────────────────────────────

describe("Meta ad-accounts routes — file existence", () => {
  it("list route file exists", () => {
    expect(() => readFileSource(LIST_FILE)).not.toThrow();
  });

  it("select route file exists", () => {
    expect(() => readFileSource(SELECT_FILE)).not.toThrow();
  });

  it("adapter file exists", () => {
    expect(() => readFileSource(ADAPTER_FILE)).not.toThrow();
  });
});

// ─── GET /api/meta/ad-accounts — list route ────────────────────────────────

describe("GET /api/meta/ad-accounts — list route", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("uses requireAuthz", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/requireAuthz/);
  });

  it("resolves repository via Container", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/Container\.getMetaRepository/);
  });

  it("uses MetaTokenVault", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/MetaTokenVault/);
  });

  it("uses MetaApiAdapter", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/MetaApiAdapter/);
  });

  it("calls getConnectionWithToken", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/getConnectionWithToken/);
  });

  it("calls listAccessibleAdAccounts", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/listAccessibleAdAccounts/);
  });

  it("calls upsertAdAccounts", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).toMatch(/upsertAdAccounts/);
  });

  it("does not expose accessToken in returned JSON shape", () => {
    const source = readFileSource(LIST_FILE);
    // Look for accessToken as a field name in a returned object literal
    expect(source).not.toMatch(/accessToken\s*:/);
  });

  it("does not read meta_access_token cookie", () => {
    const source = readFileSource(LIST_FILE);
    expect(source).not.toMatch(/meta_access_token/);
  });
});

// ─── POST /api/meta/ad-accounts/[accountId]/select — select route ──────────

describe("POST /api/meta/ad-accounts/[accountId]/select — select route", () => {
  it("exports a POST handler", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("uses requireAuthz", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/requireAuthz/);
  });

  it("requires editor or admin role", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/editor|admin/);
  });

  it("reads workspace_id", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/workspace_id|workspaceId/);
  });

  it("reads business_id", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/business_id|businessId/);
  });

  it("calls selectAdAccount", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).toMatch(/selectAdAccount/);
  });

  it("does not expose access token in response", () => {
    const source = readFileSource(SELECT_FILE);
    expect(source).not.toMatch(/accessToken\s*:|access_token\s*:/);
  });
});

// ─── MetaApiAdapter — listAccessibleAdAccounts ─────────────────────────────

describe("MetaApiAdapter — listAccessibleAdAccounts", () => {
  it("includes listAccessibleAdAccounts method", () => {
    const source = readFileSource(ADAPTER_FILE);
    expect(source).toMatch(/listAccessibleAdAccounts/);
  });

  it("requests fields id,account_id,name,currency,timezone_name,business{id,name},account_status", () => {
    const source = readFileSource(ADAPTER_FILE);
    expect(source).toMatch(/fields=.*id.*account_id.*name.*currency.*timezone_name.*business\{id,name\}.*account_status/);
  });
});
