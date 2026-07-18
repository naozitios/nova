import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Task 8 — Static source-contract tests for deprecated Meta prototype routes
// Asserts routes point users to new endpoints and no longer store OAuth
// credentials in cookies. Each test reads the route source directly.
// ---------------------------------------------------------------------------

function readFileSource(filePath: string): string {
  return readFileSync(join(process.cwd(), filePath), "utf-8");
}

const ROUTE_AUTH = "src/app/api/meta/auth/route.ts";
const ROUTE_ACCOUNTS = "src/app/api/meta/accounts/route.ts";
const ROUTE_CALLBACK = "src/app/api/meta/callback/route.ts";
const ROUTE_APPLY = "src/app/api/meta/apply/[campaignId]/route.ts";
const ROUTE_SYNC = "src/app/api/meta/sync/[runId]/route.ts";

// ─── /api/meta/auth — deprecated, must not set meta_oauth_state cookie ─────

describe("meta auth route — deprecated prototype guard", () => {
  const source = () => readFileSource(ROUTE_AUTH);

  it("does not set meta_oauth_state cookie", () => {
    expect(source()).not.toContain("meta_oauth_state");
  });

  it("returns 410 Gone or mentions 410", () => {
    const src = source();
    const has410 = src.includes("410") || src.toLowerCase().includes("gone");
    expect(has410).toBe(true);
  });

  it("points to /api/meta/oauth/start", () => {
    expect(source()).toContain("/api/meta/oauth/start");
  });
});

// ─── /api/meta/accounts — deprecated, must not read meta_access_token cookie

describe("meta accounts route — deprecated prototype guard", () => {
  const source = () => readFileSource(ROUTE_ACCOUNTS);

  it("does not read meta_access_token cookie", () => {
    expect(source()).not.toContain("meta_access_token");
  });

  it("returns 410 Gone or mentions 410", () => {
    const src = source();
    const has410 = src.includes("410") || src.toLowerCase().includes("gone");
    expect(has410).toBe(true);
  });

  it("points to /api/meta/ad-accounts", () => {
    expect(source()).toContain("/api/meta/ad-accounts");
  });
});

// ─── /api/meta/callback — deprecated, must not set token/account cookies ───

describe("meta callback route — deprecated prototype guard", () => {
  const source = () => readFileSource(ROUTE_CALLBACK);

  it("does not set meta_access_token cookie", () => {
    expect(source()).not.toMatch(/cookies\.set\(\s*['"]meta_access_token['"]/);
  });

  it("does not set meta_ad_account_id cookie", () => {
    expect(source()).not.toMatch(/cookies\.set\(\s*['"]meta_ad_account_id['"]/);
  });

  it("redirects with meta_route_deprecated", () => {
    expect(source()).toContain("meta_route_deprecated");
  });
});

// ─── /api/meta/apply/[campaignId] — deprecated, no cookie reads or MetaApiAdapter

describe("meta apply route — deprecated prototype guard", () => {
  const source = () => readFileSource(ROUTE_APPLY);

  it("returns 410 status", () => {
    expect(source()).toContain("410");
  });

  it("returns META_ROUTE_DEPRECATED code", () => {
    expect(source()).toContain("META_ROUTE_DEPRECATED");
  });

  it("does not read meta_access_token cookie", () => {
    expect(source()).not.toContain("cookies.get('meta_access_token')");
  });

  it("does not read meta_ad_account_id cookie", () => {
    expect(source()).not.toContain("cookies.get('meta_ad_account_id')");
  });

  it("does not import MetaApiAdapter", () => {
    expect(source()).not.toMatch(/MetaApiAdapter/);
  });
});

// ─── /api/meta/sync/[runId] — deprecated, no cookie reads or MetaApiAdapter

describe("meta sync route — deprecated prototype guard", () => {
  const source = () => readFileSource(ROUTE_SYNC);

  it("returns 410 status", () => {
    expect(source()).toContain("410");
  });

  it("returns META_ROUTE_DEPRECATED code", () => {
    expect(source()).toContain("META_ROUTE_DEPRECATED");
  });

  it("does not read meta_access_token cookie", () => {
    expect(source()).not.toContain("cookies.get('meta_access_token')");
  });

  it("does not read meta_ad_account_id cookie", () => {
    expect(source()).not.toContain("cookies.get('meta_ad_account_id')");
  });

  it("does not import MetaApiAdapter", () => {
    expect(source()).not.toMatch(/MetaApiAdapter/);
  });
});
