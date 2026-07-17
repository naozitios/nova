import { describe, expect, it } from "vitest";
import { readFileSource } from "../business-context/_idempotency-helpers";

const INSIGHTS_FILE = "src/app/api/meta/insights/route.ts";
const FRESHNESS_FILE = "src/app/api/meta/data-freshness/route.ts";

describe("Meta insights routes — file existence", () => {
  it("insights route file exists", () => {
    expect(() => readFileSource(INSIGHTS_FILE)).not.toThrow();
  });

  it("data freshness route file exists", () => {
    expect(() => readFileSource(FRESHNESS_FILE)).not.toThrow();
  });
});

describe("GET /api/meta/insights", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(INSIGHTS_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("requires viewer-or-better workspace authorization", () => {
    const source = readFileSource(INSIGHTS_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/viewer/);
  });

  it("requires workspace_id, business_id, since, and until query params", () => {
    const source = readFileSource(INSIGHTS_FILE);
    expect(source).toMatch(/workspace_id/);
    expect(source).toMatch(/business_id/);
    expect(source).toMatch(/since/);
    expect(source).toMatch(/until/);
  });

  it("resolves selected Meta ad account for the requested business", () => {
    const source = readFileSource(INSIGHTS_FILE);
    expect(source).toMatch(/listAdAccounts/);
    expect(source).toMatch(/businessId/);
    expect(source).toMatch(/isSelected/);
  });

  it("reads daily insights through repository and never exposes tokens", () => {
    const source = readFileSource(INSIGHTS_FILE);
    expect(source).toMatch(/listDailyInsights/);
    expect(source).not.toMatch(/encryptedAccessToken|access_token|accessToken/);
  });
});

describe("GET /api/meta/data-freshness", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(FRESHNESS_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("requires viewer-or-better workspace authorization", () => {
    const source = readFileSource(FRESHNESS_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/viewer/);
  });

  it("requires workspace_id and business_id query params", () => {
    const source = readFileSource(FRESHNESS_FILE);
    expect(source).toMatch(/workspace_id/);
    expect(source).toMatch(/business_id/);
  });

  it("resolves selected Meta ad account for the requested business", () => {
    const source = readFileSource(FRESHNESS_FILE);
    expect(source).toMatch(/listAdAccounts/);
    expect(source).toMatch(/businessId/);
    expect(source).toMatch(/isSelected/);
  });

  it("reads freshness through repository and returns gap counts", () => {
    const source = readFileSource(FRESHNESS_FILE);
    expect(source).toMatch(/getDataFreshness/);
    expect(source).toMatch(/latestDate|latest_date/);
    expect(source).toMatch(/gapCount|gap_count/);
  });
});
