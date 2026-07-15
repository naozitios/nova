/**
 * E2E Test Harness for Business Context Pipeline
 *
 * Shared utilities for all E2E tests (T020, T030, T041, T052, T060, T071).
 * Uses real Supabase, real NextAuth sessions, real process spawning.
 * No mocks for any boundary.
 *
 * This file re-exports everything from focused modules for backward compatibility.
 */

// Re-export types
export type {
  SessionOptions,
  UserOptions,
  TestUser,
  ProcessHandle,
  LogCapture,
  TestHarness,
} from "./types";

// Re-export Supabase/auth functions
export { resetDatabase, createTestSession, createTestUser } from "./supabase";

// Re-export process control functions
export { getRandomPort, startApp, startWorker, captureLogs } from "./process";

// Re-export HTTP/polling functions
export { authenticatedFetch, pollForCondition } from "./http";

// Re-export ClamAV scanner lifecycle functions
export { startScanner, waitScannerHealthy, cleanupScanner, run, COMPOSE_FILE } from "./scanner";

// Import cleanup helpers for orchestrator
import { cleanupUsers } from "./supabase";
import { cleanupProcesses } from "./process";
import { startScanner, waitScannerHealthy, cleanupScanner } from "./scanner";
import { resetDatabase } from "./supabase";

// ---------------------------------------------------------------------------
// E2E Config Validation
// ---------------------------------------------------------------------------

/** Alias groups: at least one candidate in each group must be set. */
interface EnvAliasGroup {
  /** Logical name for the group (used in missingVar output). */
  variable: string;
  /** Human description of what this group provides. */
  description: string;
  /** Acceptable env var names — at least one must be non-empty. */
  candidates: readonly string[];
}

const REQUIRED_ENV_GROUPS: readonly EnvAliasGroup[] = [
  {
    variable: "SUPABASE_URL",
    description: "Supabase project URL",
    candidates: ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  },
  {
    variable: "SUPABASE_SERVICE_ROLE_KEY",
    description: "Supabase service-role key",
    candidates: ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"],
  },
  {
    variable: "SUPABASE_ANON_KEY",
    description: "Supabase anon/public key (required for real Auth JWT clients)",
    candidates: ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  },
  {
    variable: "NEXTAUTH_SECRET",
    description: "NextAuth JWT signing secret",
    candidates: ["NEXTAUTH_SECRET"],
  },
  {
    variable: "META_ENCRYPTION_KEY",
    description: "Meta API encryption key",
    candidates: ["META_ENCRYPTION_KEY"],
  },
  {
    variable: "FIRECRAWL_API_KEY",
    description: "Firecrawl API key",
    candidates: ["FIRECRAWL_API_KEY"],
  },
] as const;

export interface ConfigValidationError {
  variable: string;
  description: string;
  message: string;
}

export interface ConfigValidationResult {
  ok: boolean;
  errors: ConfigValidationError[];
  missingVars: string[];
}

/**
 * Resolve the first non-empty value from a list of candidates.
 */
function resolveAlias(candidates: readonly string[]): string | undefined {
  for (const name of candidates) {
    const value = process.env[name];
    if (value && value.trim() !== "") {
      return value;
    }
  }
  return undefined;
}

/**
 * Validate that all required E2E environment variable groups are present.
 * Each group accepts one of several alias names (e.g. SUPABASE_URL or
 * NEXT_PUBLIC_SUPABASE_URL). Error messages name all acceptable aliases.
 */
export function validateConfig(): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];
  const missingVars: string[] = [];

  for (const group of REQUIRED_ENV_GROUPS) {
    const resolved = resolveAlias(group.candidates);
    if (resolved === undefined) {
      missingVars.push(group.variable);
      const aliasList = group.candidates.join(" or ");
      errors.push({
        variable: group.variable,
        description: group.description,
        message: `Missing required E2E variable: ${group.description}. Set one of: ${aliasList}.`,
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    missingVars,
  };
}

/**
 * Throw a descriptive error if E2E config validation fails.
 * Use inside setup() to gate real-boundary tests.
 */
export function assertConfigValid(): void {
  const result = validateConfig();
  if (!result.ok) {
    const details = result.errors.map((e) => `  - ${e.message}`).join("\n");
    throw new Error(
      `E2E config validation failed (${result.missingVars.length} missing):\n${details}`,
    );
  }
}

// ---------------------------------------------------------------------------
// E2E Setup — validate, reset, scanner start, health wait
// ---------------------------------------------------------------------------

/**
 * Full E2E setup sequence: validate config, reset database, start scanner,
 * wait for scanner healthy. Call this in beforeAll/once at suite start.
 * Cleanup already owns teardown via {@link cleanup}.
 *
 * Scanner cleanup happens if start succeeds but health wait fails.
 * No scanner cleanup if reset fails before start.
 *
 * @param opts.scannerTimeoutMs - Max wait for ClamAV health (default 120_000).
 * @returns Setup metadata for diagnostic logging.
 */
export async function setup(opts?: {
  scannerTimeoutMs?: number;
}): Promise<{
  validated: true;
  resetAt: string;
  scannerStartedAt: string;
  scannerHealthyAt: string;
}> {
  // 1. Validate config first — fail fast with descriptive error
  assertConfigValid();

  // 2. Reset Supabase tables
  const resetAt = new Date().toISOString();
  await resetDatabase();

  // 3. Start scanner and wait healthy — cleanup if health wait fails
  const scannerStartedAt = new Date().toISOString();
  await startScanner();
  try {
    await waitScannerHealthy(opts?.scannerTimeoutMs ?? 120_000);
  } catch (healthErr) {
    await cleanupScanner().catch(() => {});
    throw healthErr;
  }
  const scannerHealthyAt = new Date().toISOString();

  return { validated: true, resetAt, scannerStartedAt, scannerHealthyAt };
}

/**
 * Attempt scanner, processes, and users cleanup in parallel.
 * All three are always attempted regardless of individual failures.
 * Errors from any are collected and thrown after all settle.
 * Call this in afterEach/afterAll.
 */
export async function cleanup(): Promise<void> {
  const [scannerResult, procResult, userResult] = await Promise.allSettled([
    cleanupScanner(),
    Promise.resolve().then(() => cleanupProcesses()),
    cleanupUsers(),
  ]);

  const errors: string[] = [];
  if (scannerResult.status === "rejected") {
    errors.push(`scanner cleanup: ${scannerResult.reason}`);
  }
  if (procResult.status === "rejected") {
    errors.push(`process cleanup: ${procResult.reason}`);
  }
  if (userResult.status === "rejected") {
    errors.push(`user cleanup: ${userResult.reason}`);
  }
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
}
