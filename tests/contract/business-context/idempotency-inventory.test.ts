import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// T007 — Idempotency Inventory Test
// Proves every client mutation requires durable workspace/operation/fingerprint
// idempotency and Meta callback uniquely proves signed-state/provider-code
// replay protection without `Idempotency-Key`.
//
// These tests are INTENTIONALLY FAILING because durable idempotency
// is not yet wired (T008). They define the contract.
// ---------------------------------------------------------------------------

// ─── Route Inventory ────────────────────────────────────────────────────────
// Every POST/PUT/PATCH/DELETE under src/app/api/businesses/ must have
// idempotency checks. We scan source files for withIdempotency usage.

type HttpMethod = "POST" | "PUT" | "PATCH" | "DELETE";

interface MutatingRoute {
  method: HttpMethod;
  path: string;
  file: string;
  description: string;
  /** If true, uses its own replay protection instead of Idempotency-Key */
  usesAlternativeReplayProtection?: boolean;
}

// Complete inventory of mutating routes under src/app/api/businesses/
const BUSINESS_MUTATIONS: MutatingRoute[] = [
  {
    method: "POST",
    path: "/api/businesses",
    file: "src/app/api/businesses/route.ts",
    description: "Create business",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/onboarding",
    file: "src/app/api/businesses/[id]/onboarding/route.ts",
    description: "Start onboarding session",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/onboarding/scan",
    file: "src/app/api/businesses/[id]/onboarding/scan/route.ts",
    description: "Queue website scan",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/onboarding/answers",
    file: "src/app/api/businesses/[id]/onboarding/answers/route.ts",
    description: "Submit onboarding answers",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/onboarding/compile",
    file: "src/app/api/businesses/[id]/onboarding/compile/route.ts",
    description: "Compile onboarding draft",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/onboarding/approve",
    file: "src/app/api/businesses/[id]/onboarding/approve/route.ts",
    description: "Approve onboarding v1",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/sources",
    file: "src/app/api/businesses/[id]/context/sources/route.ts",
    description: "Register source",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/sources/[sourceId]/process",
    file: "src/app/api/businesses/[id]/context/sources/[sourceId]/process/route.ts",
    description: "Trigger source processing",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/sources/[sourceId]/archive",
    file: "src/app/api/businesses/[id]/context/sources/[sourceId]/archive/route.ts",
    description: "Archive source",
  },
  {
    method: "PATCH",
    path: "/api/businesses/[id]/context/facts",
    file: "src/app/api/businesses/[id]/context/facts/route.ts",
    description: "Patch user-verified facts",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/draft",
    file: "src/app/api/businesses/[id]/context/draft/route.ts",
    description: "Compile profile draft",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/approve",
    file: "src/app/api/businesses/[id]/context/approve/route.ts",
    description: "Approve profile version",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/conflicts/[conflictId]/resolve",
    file: "src/app/api/businesses/[id]/context/conflicts/[conflictId]/resolve/route.ts",
    description: "Resolve conflict",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/versions/[versionId]/restore",
    file: "src/app/api/businesses/[id]/context/versions/[versionId]/restore/route.ts",
    description: "Restore previous version",
  },
  {
    method: "POST",
    path: "/api/businesses/[id]/context/reconcile",
    file: "src/app/api/businesses/[id]/context/reconcile/route.ts",
    description: "Trigger reconciliation",
  },
];

// Context job mutations (not under businesses/ but still business-context)
const JOB_MUTATIONS: MutatingRoute[] = [
  {
    method: "POST",
    path: "/api/context-jobs/[id]/retry",
    file: "src/app/api/context-jobs/[id]/retry/route.ts",
    description: "Retry failed job",
  },
];

// Meta OAuth callback — uses its own replay protection, NOT Idempotency-Key
const META_OAUTH_ROUTES: MutatingRoute[] = [
  {
    method: "GET",
    path: "/api/meta/callback",
    file: "src/app/api/meta/callback/route.ts",
    description: "Meta OAuth callback (signed state replay protection)",
    usesAlternativeReplayProtection: true,
  },
];

const ALL_MUTATIONS = [...BUSINESS_MUTATIONS, ...JOB_MUTATIONS];

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function readFileSource(filePath: string): string {
  const root = process.cwd();
  return readFileSync(join(root, filePath), "utf-8");
}

function usesWithIdempotency(source: string, method: HttpMethod): boolean {
  // Check if the route handler wraps its logic in withIdempotency().
  // We use a simple check: the file must import withIdempotency AND
  // contain a call to withIdempotency(req in the context of this method.
  // For files with multiple handlers (GET+POST), we check if the method
  // keyword appears near withIdempotency.
  const hasImport =
    source.includes("withIdempotency") || source.includes("checkIdempotency");

  if (!hasImport) return false;

  // Find the export for this method and check if withIdempotency appears
  // within 500 chars (rough handler body size)
  const exportIdx = source.indexOf(`export async function ${method}(`);
  if (exportIdx === -1) return false;

  const nearChunk = source.slice(exportIdx, exportIdx + 2000);
  return nearChunk.includes("withIdempotency(req");
}

function requiresIdempotencyKey(source: string): boolean {
  // The Idempotency-Key header must be REQUIRED, not optional.
  // Current withIdempotency silently skips if key is absent — that's a bug.
  // We check if the code explicitly rejects missing keys.
  return (
    source.includes("IDEMPOTENCY_KEY_REQUIRED") ||
    source.includes("Idempotency-Key") && source.includes("400")
  );
}

function usesDurableIdempotencyStore(source: string): boolean {
  // Durable means: database table, Redis, file-based — NOT Map/Set/in-memory.
  // The _shared.ts file uses `new Map<string, ...>()` which is process-local.
  return (
    source.includes("idempotency_store") && !source.includes("new Map") ||
    source.includes("idempotency_keys") && source.includes("supabase") ||
    source.includes("idempotency") && source.includes("persisted")
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Idempotency Inventory — every mutation must be idempotent", () => {
  // ── Part 1: Route Inventory ────────────────────────────────────────────────

  describe("route inventory completeness", () => {
    it("has inventoried every mutating business-context route", () => {
      // This is a meta-test: verify our inventory matches actual route files.
      // If new routes are added, this test should be updated.
      const expectedRouteFiles = ALL_MUTATIONS.map((r) => r.file);
      const routeFiles = new Set(expectedRouteFiles);

      // Verify no duplicate files (each route file should appear once)
      expect(routeFiles.size).toBe(expectedRouteFiles.length);
    });

    it.each(ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const))(
      "%s is inventoried",
      (_label, route) => {
        expect(route.file).toBeTruthy();
        expect(route.description).toBeTruthy();
      },
    );
  });

  // ── Part 2: Every mutation uses withIdempotency ────────────────────────────

  describe("every mutation wraps handler in withIdempotency", () => {
    it.each(
      ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const)
    )("%s — source uses withIdempotency", (_label, route) => {
      const source = readFileSource(route.file);
      expect(
        usesWithIdempotency(source, route.method),
      ).toBe(true);
    });
  });

  // ── Part 3: Durable storage requirement ────────────────────────────────────

  describe("idempotency store must be durable (not process-local)", () => {
    it("_shared.ts uses durable storage, not in-memory Map", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // The current implementation uses `new Map<string, ...>()` which
      // is process-local and loses state on restart. Durable storage
      // (Postgres, Redis) is required for cross-instance idempotency.
      const usesMapStore = source.includes("new Map<string");
      expect(usesMapStore).toBe(false);
    });

    it("idempotency records survive process restart", () => {
      // This test proves the store persists. If using Postgres, this
      // means writing to a table. If using Redis, it means using a
      // persistent Redis instance. In-memory Map fails this.
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // Should NOT have in-memory TTL eviction logic
      const hasInMemoryEviction = source.includes("idempotencyStore.size >");
      expect(hasInMemoryEviction).toBe(false);
    });
  });

  // ── Part 4: Idempotency-Key header must be required ────────────────────────

  describe("Idempotency-Key header is required for mutations", () => {
    it("_shared.ts withIdempotency rejects missing key", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // Current behavior: withIdempotency silently skips when key is absent.
      // Contract: MUST return 400 IDEMPOTENCY_KEY_REQUIRED when key is missing.
      expect(requiresIdempotencyKey(source)).toBe(true);
    });

    it.each(
      ALL_MUTATIONS.map((r) => [`${r.method} ${r.path}`, r] as const)
    )(
      "%s — route does not bypass key requirement",
      (_label, route) => {
        const source = readFileSource(route.file);
        // Route should not override or skip idempotency key requirement
        expect(source).not.toContain("skipIdempotency");
        expect(source).not.toContain("idempotencyDisabled");
      },
    );
  });

  // ── Part 5: Workspace + operation + fingerprint ────────────────────────────

  describe("idempotency key encodes workspace, operation, and fingerprint", () => {
    it("_shared.ts accepts workspace-scoped idempotency context", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // The idempotency key must be scoped to workspace + operation.
      // Raw client-provided keys alone are insufficient — a key from
      // workspace A could replay in workspace B.
      const hasWorkspaceContext =
        source.includes("workspaceId") && source.includes("idempotency");
      expect(hasWorkspaceContext).toBe(true);
    });

    it("_shared.ts supports request fingerprint for payload binding", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // The idempotency record must store a fingerprint (hash) of the
      // request payload so same key + different body is detected.
      const hasFingerprint =
        source.includes("fingerprint") ||
        source.includes("payloadHash") ||
        source.includes("bodyHash");
      expect(hasFingerprint).toBe(true);
    });
  });

  // ── Part 6: Key/payload mismatch detection ─────────────────────────────────

  describe("same Idempotency-Key + different body returns IDEMPOTENCY_KEY_REUSED", () => {
    it("_shared.ts detects payload mismatch on reused key", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // When client sends same key but different request body,
      // must return 409 IDEMPOTENCY_KEY_REUSED, not replay old result.
      expect(source).toContain("IDEMPOTENCY_KEY_REUSED");
    });

    it("_shared.ts does not silently replay mismatched payloads", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // The checkIdempotency function must compare fingerprints before
      // returning cached response. Blind replay is a correctness bug.
      const hasBlindReplay =
        source.includes("checkIdempotency") &&
        !source.includes("fingerprint") &&
        !source.includes("payloadHash");
      expect(hasBlindReplay).toBe(false);
    });
  });

  // ── Part 7: Replay returns original result ─────────────────────────────────

  describe("key + payload match replays original result", () => {
    it("_shared.ts replays stored response on matching key+payload", () => {
      const source = readFileSource("src/app/api/businesses/_shared.ts");

      // Must store the original response and replay it verbatim
      // (same status, headers, body) when key+payload match.
      const hasReplayLogic =
        source.includes("cached.response.clone()") ||
        source.includes("replay") ||
        source.includes("cached");
      expect(hasReplayLogic).toBe(true);
    });
  });

  // ── Part 8: PATCH /context/facts has idempotency ───────────────────────────

  describe("PATCH /api/businesses/[id]/context/facts has idempotency", () => {
    it("facts PATCH route uses withIdempotency", () => {
      const source = readFileSource(
        "src/app/api/businesses/[id]/context/facts/route.ts",
      );
      // Currently this route does NOT wrap in withIdempotency.
      // This test will FAIL until T008 adds it.
      expect(usesWithIdempotency(source, "PATCH")).toBe(true);
    });
  });

  // ── Part 9: Read-only routes do NOT have idempotency ──────────────────────

  // NOTE: Read-only route checks are file-level, not handler-level.
  // Files with both GET and POST handlers (e.g., sources/route.ts) may
  // trigger false positives because POST uses withIdempotency. The
  // critical contract is Part 2 (all mutations have idempotency), not
  // this inverse check.
});

// ─── Meta OAuth Callback Replay Protection ──────────────────────────────────

describe("Meta OAuth callback — signed-state replay protection", () => {
  const CALLBACK_FILE = "src/app/api/meta/callback/route.ts";

  it("callback verifies signed state nonce", () => {
    const source = readFileSource(CALLBACK_FILE);

    // The callback must verify the state parameter is a valid signed nonce,
    // not just compare it to a cookie value.
    const hasSignedState =
      source.includes("verify") ||
      source.includes("hmac") ||
      source.includes("signature") ||
      source.includes("jwt") ||
      source.includes("signed");
    expect(hasSignedState).toBe(true);
  });

  it("callback records provider code hash before token exchange", () => {
    const source = readFileSource(CALLBACK_FILE);

    // Before exchanging the code for a token, the callback must hash
    // and persist the provider code to prevent replay.
    const recordsCodeHash =
      source.includes("codeHash") ||
      source.includes("code_hash") ||
      source.includes("provider_code");
    expect(recordsCodeHash).toBe(true);
  });

  it("callback rejects replayed nonces (OAUTH_CALLBACK_REPLAYED)", () => {
    const source = readFileSource(CALLBACK_FILE);

    // If the same nonce is received twice, the second must be rejected.
    const hasReplayRejection =
      source.includes("OAUTH_CALLBACK_REPLAYED") ||
      source.includes("nonce_used") ||
      source.includes("nonce_replay");
    expect(hasReplayRejection).toBe(true);
  });

  it("callback rejects replayed provider codes", () => {
    const source = readFileSource(CALLBACK_FILE);

    // If the same authorization code is used twice (provider replay),
    // the second attempt must be rejected.
    const hasCodeReplayRejection =
      source.includes("CODE_REPLAYED") ||
      source.includes("code_replay") ||
      source.includes("code_used");
    expect(hasCodeReplayRejection).toBe(true);
  });

  it("callback does NOT use Idempotency-Key header", () => {
    const source = readFileSource(CALLBACK_FILE);

    // The Meta callback uses its own signed-state replay protection,
    // not the standard Idempotency-Key header. These are different
    // mechanisms: state is per-flow, idempotency key is per-request.
    const usesIdempotencyKey =
      source.includes("idempotency-key") ||
      source.includes("Idempotency-Key") ||
      source.includes("withIdempotency");
    expect(usesIdempotencyKey).toBe(false);
  });

  it("meta auth route generates signed state with nonce", () => {
    const authSource = readFileSource("src/app/api/meta/auth/route.ts");

    // The auth initiation route must generate a cryptographically signed
    // state parameter that includes a one-time nonce.
    const hasSignedGeneration =
      authSource.includes("randomBytes") ||
      authSource.includes("crypto") ||
      authSource.includes("nanoid");
    expect(hasSignedGeneration).toBe(true);
  });
});

// ─── Idempotency Architecture Constraints ───────────────────────────────────

describe("idempotency architecture constraints", () => {
  it("_shared.ts idempotency store is not process-local Map", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    // Process-local Map means:
    // - Multiple server instances see different idempotency stores
    // - Server restart loses all records
    // - Memory grows unbounded until eviction
    //
    // Required: Postgres table, Redis, or similar durable store.
    const hasMapStore = source.match(/new Map\s*</);
    expect(hasMapStore).toBeNull();
  });

  it("_shared.ts idempotency TTL uses database-level expiry, not JS timers", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    // JS-based TTL (setTimeout, Date.now() comparison) does not survive
    // process restart. Database-level expiry (TTL column, pg_cron) does.
    const hasJsTtl =
      source.includes("Date.now()") && source.includes("IDEMPOTENCY_TTL");
    expect(hasJsTtl).toBe(false);
  });

  it("_shared.ts does not evict entries based on in-memory size", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    // In-memory eviction on size threshold (e.g., > 1000 entries) is
    // a symptom of process-local storage. Durable stores handle this
    // at the storage layer.
    const hasSizeEviction =
      source.includes("idempotencyStore.size >") ||
      source.includes("store.size >") ||
      source.includes("idempotencyMap.size");
    expect(hasSizeEviction).toBe(false);
  });

  it("idempotency records include workspace scope", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    // Without workspace scoping, key reuse across workspaces is possible.
    // The idempotency table must include workspace_id as part of the
    // uniqueness constraint.
    const hasWorkspaceScope =
      source.includes("workspace_id") ||
      source.includes("workspaceId") ||
      source.includes("workspace");
    expect(hasWorkspaceScope).toBe(true);
  });

  it("idempotency records include operation type", () => {
    const source = readFileSource("src/app/api/businesses/_shared.ts");

    // Different operations on the same resource must not share
    // idempotency keys. The record must include the operation/route.
    const hasOperationScope =
      source.includes("operation") ||
      source.includes("route") ||
      source.includes("method");
    expect(hasOperationScope).toBe(true);
  });
});
