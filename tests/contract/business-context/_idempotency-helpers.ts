import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// T007 — Idempotency Inventory Test Helpers
// Shared types, route inventory, and analysis functions used by the split
// idempotency test files.
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface MutatingRoute {
  method: HttpMethod;
  path: string;
  file: string;
  description: string;
  /** If true, uses its own replay protection instead of Idempotency-Key */
  usesAlternativeReplayProtection?: boolean;
}

// Complete inventory of mutating routes under src/app/api/businesses/
export const BUSINESS_MUTATIONS: MutatingRoute[] = [
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
export const JOB_MUTATIONS: MutatingRoute[] = [
  {
    method: "POST",
    path: "/api/context-jobs/[id]/retry",
    file: "src/app/api/context-jobs/[id]/retry/route.ts",
    description: "Retry failed job",
  },
];

// Meta OAuth callback — uses its own replay protection, NOT Idempotency-Key
export const META_OAUTH_ROUTES: MutatingRoute[] = [
  {
    method: "GET",
    path: "/api/meta/callback",
    file: "src/app/api/meta/callback/route.ts",
    description: "Meta OAuth callback (signed state replay protection)",
    usesAlternativeReplayProtection: true,
  },
];

export const ALL_MUTATIONS = [...BUSINESS_MUTATIONS, ...JOB_MUTATIONS];

// ─── Shared Helpers ─────────────────────────────────────────────────────────

export function readFileSource(filePath: string): string {
  const root = process.cwd();
  return readFileSync(join(root, filePath), "utf-8");
}

export function usesWithIdempotency(source: string, method: HttpMethod): boolean {
  const hasImport =
    source.includes("withIdempotency") || source.includes("checkIdempotency");

  if (!hasImport) return false;

  const exportIdx = source.indexOf(`export async function ${method}(`);
  if (exportIdx === -1) return false;

  const nearChunk = source.slice(exportIdx, exportIdx + 2000);
  return nearChunk.includes("withIdempotency(req");
}

export function requiresIdempotencyKey(source: string): boolean {
  return (
    source.includes("IDEMPOTENCY_KEY_REQUIRED") ||
    source.includes("Idempotency-Key") && source.includes("400")
  );
}

export function usesDurableIdempotencyStore(source: string): boolean {
  return (
    source.includes("idempotency_store") && !source.includes("new Map") ||
    source.includes("idempotency_keys") && source.includes("supabase") ||
    source.includes("idempotency") && source.includes("persisted")
  );
}
