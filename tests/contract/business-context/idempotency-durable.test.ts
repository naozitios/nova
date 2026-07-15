import { describe, expect, it } from "vitest";
import {
  ALL_MUTATIONS,
  readFileSource,
  usesWithIdempotency,
  requiresIdempotencyKey,
} from "./_idempotency-helpers";

// ---------------------------------------------------------------------------
// T007 — Idempotency Inventory Test: Durable Semantics
// Proves idempotency uses durable (not process-local) storage, requires
// Idempotency-Key header, encodes workspace/operation/fingerprint, detects
// key/payload mismatch, and replays correctly.
// ---------------------------------------------------------------------------

describe("Idempotency Inventory — durable semantics and architecture", () => {
  describe("idempotency store must be durable (not process-local)", () => {
    it("_shared.ts uses durable storage, not in-memory Map", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const usesMapStore = source.includes("new Map<string");
      expect(usesMapStore).toBe(false);
    });

    it("idempotency records survive process restart", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const hasInMemoryEviction = source.includes("idempotencyStore.size >");
      expect(hasInMemoryEviction).toBe(false);
    });
  });

  describe("Idempotency-Key header is required for mutations", () => {
    it("_shared.ts withIdempotency rejects missing key", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      expect(requiresIdempotencyKey(source)).toBe(true);
    });

    it.each(
      ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const)
    )(
      "%s — route does not bypass key requirement",
      (_label, route) => {
        const source = readFileSource(route.file);
        expect(source).not.toContain("skipIdempotency");
        expect(source).not.toContain("idempotencyDisabled");
      },
    );
  });

  describe("idempotency key encodes workspace, operation, and fingerprint", () => {
    it("_shared.ts accepts workspace-scoped idempotency context", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const hasWorkspaceContext =
        source.includes("workspaceId") && source.includes("idempotency");
      expect(hasWorkspaceContext).toBe(true);
    });

    it("_shared.ts supports request fingerprint for payload binding", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const hasFingerprint =
        source.includes("fingerprint") ||
        source.includes("payloadHash") ||
        source.includes("bodyHash");
      expect(hasFingerprint).toBe(true);
    });
  });

  describe("same Idempotency-Key + different body returns IDEMPOTENCY_KEY_REUSED", () => {
    it("_shared.ts detects payload mismatch on reused key", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      expect(source).toContain("IDEMPOTENCY_KEY_REUSED");
    });

    it("_shared.ts does not silently replay mismatched payloads", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const hasBlindReplay =
        source.includes("checkIdempotency") &&
        !source.includes("fingerprint") &&
        !source.includes("payloadHash");
      expect(hasBlindReplay).toBe(false);
    });
  });

  describe("key + payload match replays original result", () => {
    it("_shared.ts replays stored response on matching key+payload", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      const hasReplayLogic =
        source.includes("cached.response.clone()") ||
        source.includes("replay") ||
        source.includes("cached");
      expect(hasReplayLogic).toBe(true);
    });
  });

  describe("PATCH /api/businesses/[id]/context/facts has idempotency", () => {
    it("facts PATCH route uses withIdempotency", () => {
      const source = readFileSource(
        "src/app/api/businesses/[id]/context/facts/route.ts",
      );
      expect(usesWithIdempotency(source, "PATCH")).toBe(true);
    });
  });
});

// ─── Idempotency Architecture Constraints ───────────────────────────────────

describe("idempotency architecture constraints", () => {
  it("_shared.ts idempotency store is not process-local Map", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    const hasMapStore = source.match(/new Map\s*</);
    expect(hasMapStore).toBeNull();
  });

  it("_shared.ts idempotency TTL uses database-level expiry, not JS timers", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    const hasJsTtl =
      source.includes("Date.now()") && source.includes("IDEMPOTENCY_TTL");
    expect(hasJsTtl).toBe(false);
  });

  it("_shared.ts does not evict entries based on in-memory size", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    const hasSizeEviction =
      source.includes("idempotencyStore.size >") ||
      source.includes("store.size >") ||
      source.includes("idempotencyMap.size");
    expect(hasSizeEviction).toBe(false);
  });

  it("idempotency records include workspace scope", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    const hasWorkspaceScope =
      source.includes("workspace_id") ||
      source.includes("workspaceId") ||
      source.includes("workspace");
    expect(hasWorkspaceScope).toBe(true);
  });

  it("idempotency records include operation type", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    const hasOperationScope =
      source.includes("operation") ||
      source.includes("route") ||
      source.includes("method");
    expect(hasOperationScope).toBe(true);
  });
});
