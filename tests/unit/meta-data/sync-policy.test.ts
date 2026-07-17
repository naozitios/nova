import { describe, expect, it } from "vitest";
import {
  buildHierarchyPartitions,
  classifyMetaSyncError,
  type MetaSyncPartition,
} from "@/core/meta-data/sync-policy";

// ── buildHierarchyPartitions ──────────────────────────────────────────

describe("buildHierarchyPartitions", () => {
  const accountId = "act_123456";

  it("returns exactly four partitions", () => {
    const result = buildHierarchyPartitions(accountId);
    expect(result).toHaveLength(4);
  });

  it("orders partitions: campaigns, ad_sets, ads, creatives", () => {
    const result = buildHierarchyPartitions(accountId);
    expect(result.map((p) => p.objectType)).toEqual([
      "campaigns",
      "ad_sets",
      "ads",
      "creatives",
    ]);
  });

  it("every partition carries the supplied accountId", () => {
    const result = buildHierarchyPartitions(accountId);
    for (const partition of result) {
      expect(partition.accountId).toBe(accountId);
    }
  });

  it("each partition satisfies the MetaSyncPartition shape", () => {
    const result = buildHierarchyPartitions(accountId);
    for (const partition of result) {
      const p: MetaSyncPartition = partition; // type-check only
      expect(typeof p.objectType).toBe("string");
      expect(typeof p.accountId).toBe("string");
    }
  });
});

// ── classifyMetaSyncError ─────────────────────────────────────────────

describe("classifyMetaSyncError", () => {
  // helper: build a minimal error-like object
  const err = (status?: number, message = "err") =>
    ({ status, message }) as unknown as Error;

  // retryable
  it("classifies 429 as retryable", () => {
    expect(classifyMetaSyncError(err(429))).toBe("retryable");
  });

  it("classifies 500 as retryable", () => {
    expect(classifyMetaSyncError(err(500))).toBe("retryable");
  });

  it("classifies 502 as retryable", () => {
    expect(classifyMetaSyncError(err(502))).toBe("retryable");
  });

  it("classifies 503 as retryable", () => {
    expect(classifyMetaSyncError(err(503))).toBe("retryable");
  });

  it("classifies network errors (no status) as retryable", () => {
    expect(classifyMetaSyncError(err(undefined))).toBe("retryable");
  });

  it("classifies timeout errors as retryable", () => {
    const timeoutErr = {
      name: "TimeoutError",
      message: "timed out",
    } as unknown as Error;
    expect(classifyMetaSyncError(timeoutErr)).toBe("retryable");
  });

  it("classifies ECONNREFUSED as retryable", () => {
    const connErr = {
      name: "FetchError",
      message: "request to https://graph.facebook.com failed, reason: connect ECONNREFUSED",
      code: "ECONNREFUSED",
    } as unknown as Error;
    expect(classifyMetaSyncError(connErr)).toBe("retryable");
  });

  // auth
  it("classifies 401 as auth", () => {
    expect(classifyMetaSyncError(err(401))).toBe("auth");
  });

  // permission
  it("classifies 403 as permission", () => {
    expect(classifyMetaSyncError(err(403))).toBe("permission");
  });

  // schema
  it("classifies 400 validation error as schema", () => {
    const validationErr = {
      status: 400,
      message: "Invalid parameter: fields",
    } as unknown as Error;
    expect(classifyMetaSyncError(validationErr)).toBe("schema");
  });

  it("classifies Graph API validation_error as schema", () => {
    const validationErr = {
      status: 400,
      message: "(#100) param fields must be set",
      error: { type: "OAuthException", code: 100, error_subcode: 100 },
    } as unknown as Error;
    expect(classifyMetaSyncError(validationErr)).toBe("schema");
  });

  // permanent
  it("classifies 404 as permanent", () => {
    expect(classifyMetaSyncError(err(404))).toBe("permanent");
  });

  it("classifies 410 as permanent", () => {
    expect(classifyMetaSyncError(err(410))).toBe("permanent");
  });

  it("classifies unknown error with valid status as permanent", () => {
    expect(classifyMetaSyncError(err(418))).toBe("permanent");
  });
});
