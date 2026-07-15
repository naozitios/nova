/**
 * E2E Test Harness for Business Context Pipeline
 *
 * Shared utilities for all E2E tests (T020, T030, T041, T052, T060, T071).
 * Uses real Supabase, real NextAuth sessions, real process spawning.
 * No mocks for any boundary.
 */

import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encode } from "next-auth/jwt";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for creating a NextAuth session cookie. */
export interface SessionOptions {
  /** User ID to embed in the JWT. */
  userId: string;
  /** Workspace ID to embed in the session. */
  workspaceId: string;
  /** Role within the workspace. */
  role: "owner" | "admin" | "editor" | "viewer";
}

/** Options for creating a Supabase Auth user. */
export interface UserOptions {
  /** Email address for the auth user. */
  email: string;
  /** Optional workspace ID to create membership for. */
  workspaceId?: string;
  /** Membership role if workspaceId is provided. */
  membershipRole?: string;
}

/** Result of creating a test user via Supabase Auth. */
export interface TestUser {
  /** Supabase Auth user ID. */
  id: string;
  /** User email. */
  email: string;
  /** JWT access token for API calls. */
  jwt: string;
  /** Refresh token for token rotation. */
  refreshToken: string;
}

/** Handle to a spawned child process. */
export interface ProcessHandle {
  /** Process ID. */
  pid: number;
  /** Kill the process. */
  kill: () => void;
  /** Wait for process to exit, returns exit code. */
  waitForExit: () => Promise<number>;
}

/** Captured process logs. */
export interface LogCapture {
  /** Get all captured log lines. */
  getLogs: () => string[];
  /** Assert a pattern appears in logs. Throws if not found. */
  assertOnLog: (pattern: RegExp | string) => void;
  /** Clear captured logs. */
  clear: () => void;
}

/** Complete test harness interface. */
export interface TestHarness {
  resetDatabase: () => Promise<void>;
  createTestSession: (opts: SessionOptions) => Promise<string>;
  createTestUser: (opts: UserOptions) => Promise<TestUser>;
  getRandomPort: () => number;
  startApp: (port: number) => Promise<ProcessHandle>;
  startWorker: (port: number) => Promise<ProcessHandle>;
  authenticatedFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  pollForCondition: <T>(
    fn: () => T | Promise<T>,
    timeout?: number,
    interval?: number,
  ) => Promise<T>;
  captureLogs: (proc: ProcessHandle) => LogCapture;
  cleanup: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Business-context tables in FK-safe truncation order (children before parents).
 * Supabase service role bypasses RLS, so no policy concerns.
 */
const BUSINESS_CONTEXT_TABLES = [
  "context_audit_log",
  "context_quality_gate_results",
  "context_processing_stage_events",
  "context_processing_runs",
  "context_facts",
  "context_conflicts",
  "onboarding_questions",
  "business_profile_versions",
  "source_documents",
  "context_sources",
  "onboarding_sessions",
  "context_jobs",
  "businesses",
];

const ALL_TABLES = [
  ...BUSINESS_CONTEXT_TABLES,
  "workspace_members",
  "workspaces",
];

/** Tracks created user IDs for cleanup. */
const createdUserIds: Set<string> = new Set();

/** Tracks spawned process handles for cleanup. */
const spawnedProcesses: Set<ProcessHandle> = new Set();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServiceClient(): SupabaseClient {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set for E2E tests",
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "http://127.0.0.1:54321"
  );
}

// ---------------------------------------------------------------------------
// 1. resetDatabase
// ---------------------------------------------------------------------------

/**
 * Truncate all business-context tables (and workspace tables) in FK-safe order.
 * Uses the Supabase service-role client to bypass RLS.
 */
export async function resetDatabase(): Promise<void> {
  const client = getServiceClient();

  for (const table of ALL_TABLES) {
    const { error } = await client
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      // Table may not exist or may be empty — log but don't fail
      console.warn(`resetDatabase: delete from ${table}: ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. createTestSession
// ---------------------------------------------------------------------------

/**
 * Create a NextAuth session cookie for authenticated requests.
 * Signs a JWT using NEXTAUTH_SECRET matching the auth adapter's JWT strategy.
 *
 * @returns The session cookie string (e.g. "next-auth.session-token=<token>; ...")
 */
export async function createTestSession(opts: SessionOptions): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET ?? "test-secret";
  const maxAge = 60 * 60; // 1 hour

  const token = await encode({
    token: {
      sub: opts.userId,
      name: opts.userId,
      email: `test-${opts.userId}@e2e.test`,
      workspaceId: opts.workspaceId,
      role: opts.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + maxAge,
    },
    secret,
  });

  return `next-auth.session-token=${token}; Path=/; HttpOnly; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// 3. createTestUser
// ---------------------------------------------------------------------------

/**
 * Create a Supabase Auth user via the admin API and return their JWT.
 * Also optionally creates a workspace membership row for RLS tests.
 *
 * The user is tracked for automatic cleanup by {@link cleanup}.
 */
export async function createTestUser(opts: UserOptions): Promise<TestUser> {
  const client = getServiceClient();
  const url = getSupabaseUrl();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

  // Generate a random password (user won't log in via UI)
  const password = randomUUID();

  // Create user via Supabase Auth admin API
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: JSON.stringify({
      email: opts.email,
      password,
      email_confirm: true,
    }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(
      `Failed to create auth user ${opts.email}: ${createRes.status} ${body}`,
    );
  }

  const authUser = (await createRes.json()) as {
    id: string;
    email: string;
  };

  // Track for cleanup
  createdUserIds.add(authUser.id);

  // Get an access token for this user
  const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
    },
    body: JSON.stringify({
      email: opts.email,
      password,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Error(
      `Failed to get token for ${opts.email}: ${tokenRes.status} ${body}`,
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token: string;
  };

  // Create workspace membership if requested
  if (opts.workspaceId && opts.membershipRole) {
    const { error } = await client.from("workspace_members").upsert({
      workspace_id: opts.workspaceId,
      user_id: authUser.id,
      role: opts.membershipRole,
    });
    if (error) {
      console.warn(
        `createTestUser: upsert membership for ${authUser.id}: ${error.message}`,
      );
    }
  }

  return {
    id: authUser.id,
    email: authUser.email,
    jwt: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
  };
}

// ---------------------------------------------------------------------------
// 4. getRandomPort
// ---------------------------------------------------------------------------

/** Set of ports currently in use by this harness (for parallel test safety). */
const usedPorts = new Set<number>();

/**
 * Return a random available port not currently tracked by the harness.
 * Uses a ephemeral port range (49152–65535) and checks availability.
 */
export function getRandomPort(): number {
  const min = 49152;
  const max = 65535;
  let port: number;
  let attempts = 0;
  do {
    port = Math.floor(Math.random() * (max - min + 1)) + min;
    attempts++;
    if (attempts > 100) {
      throw new Error("Could not find an available port after 100 attempts");
    }
  } while (usedPorts.has(port));
  usedPorts.add(port);
  return port;
}

/**
 * Release a port back to the available pool.
 */
function releasePort(port: number): void {
  usedPorts.delete(port);
}

// ---------------------------------------------------------------------------
// 5. startApp
// ---------------------------------------------------------------------------

/**
 * Start a Next.js dev server on the given port.
 * Waits for the "Ready" message before returning.
 *
 * @param port - Port to start the app on.
 * @returns Process handle for lifecycle management.
 */
export async function startApp(port: number): Promise<ProcessHandle> {
  const proc = spawn("npx", ["next", "dev", "-p", String(port)], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
  });

  const handle = wrapProcess(proc, () => releasePort(port));
  spawnedProcesses.add(handle);

  // Wait for "Ready" message
  await waitForOutput(proc, /Ready/i, 30_000);

  return handle;
}

// ---------------------------------------------------------------------------
// 6. startWorker (deferred to T018)
// ---------------------------------------------------------------------------

/**
 * Start a worker process on the given port.
 *
 * **DEFERRED**: Worker smoke tests are not implemented until T018.
 * This stub throws if called prematurely.
 *
 * @throws {Error} Always — not yet implemented.
 */
export async function startWorker(_port: number): Promise<ProcessHandle> {
  throw new Error(
    "startWorker is deferred to T018 — not yet implemented in E2E harness",
  );
}

// ---------------------------------------------------------------------------
// 7. authenticatedFetch
// ---------------------------------------------------------------------------

/**
 * HTTP fetch with authentication headers pre-set.
 * Accepts either a session cookie string (from {@link createTestSession})
 * or a raw JWT (from {@link createTestUser}).
 *
 * @param url - Target URL.
 * @param opts - Standard RequestInit plus `authToken` for convenience.
 * @returns Response object.
 */
export async function authenticatedFetch(
  url: string,
  opts?: RequestInit & { authToken?: string },
): Promise<Response> {
  const headers = new Headers(opts?.headers);

  if (opts?.authToken) {
    // Detect if it's a cookie string (contains "=") or a raw JWT
    if (opts.authToken.includes("next-auth.session-token=")) {
      headers.set("Cookie", opts.authToken);
    } else {
      headers.set("Authorization", `Bearer ${opts.authToken}`);
    }
  }

  return fetch(url, { ...opts, headers });
}

// ---------------------------------------------------------------------------
// 8. pollForCondition
// ---------------------------------------------------------------------------

/**
 * Poll a condition function until it returns a truthy value or timeout.
 *
 * @param fn - Condition to check (may be async).
 * @param timeout - Max wait in ms (default 30_000).
 * @param interval - Poll interval in ms (default 500).
 * @returns The truthy result from fn.
 * @throws {Error} If timeout exceeded. Error includes last fn result.
 */
export async function pollForCondition<T>(
  fn: () => T | Promise<T>,
  timeout = 30_000,
  interval = 500,
): Promise<T> {
  const deadline = Date.now() + timeout;
  let lastResult: unknown;

  while (Date.now() < deadline) {
    lastResult = await fn();
    if (lastResult) {
      return lastResult as T;
    }
    await sleep(interval);
  }

  throw new Error(
    `pollForCondition: timed out after ${timeout}ms. Last result: ${JSON.stringify(lastResult)}`,
  );
}

// ---------------------------------------------------------------------------
// 9. captureLogs
// ---------------------------------------------------------------------------

/**
 * Capture stdout and stderr from a process handle.
 *
 * @param proc - Process handle from {@link startApp} or {@link startWorker},
 *               or a raw ChildProcess (for testing with inline processes).
 * @returns LogCapture interface for reading and asserting on logs.
 */
export function captureLogs(proc: ProcessHandle | ChildProcess): LogCapture {
  const lines: string[] = [];

  // Resolve to ChildProcess: check internal map, or use proc directly if it is one
  let childProc: ChildProcess | null = null;
  if ("stdout" in proc && "stderr" in proc) {
    // Already a ChildProcess
    childProc = proc as unknown as ChildProcess;
  } else {
    childProc = internalProcessMap.get(proc.pid) ?? null;
  }

  if (childProc) {
    childProc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) lines.push(line);
      }
    });
    childProc.stderr?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n")) {
        if (line.trim()) lines.push(line);
      }
    });
  }

  return {
    getLogs(): string[] {
      return [...lines];
    },
    assertOnLog(pattern: RegExp | string): void {
      const regex =
        typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
      if (!lines.some((l) => regex.test(l))) {
        throw new Error(
          `assertOnLog: pattern ${regex} not found in logs:\n${lines.join("\n")}`,
        );
      }
    },
    clear(): void {
      lines.length = 0;
    },
  };
}

// ---------------------------------------------------------------------------
// 10. cleanup
// ---------------------------------------------------------------------------

/**
 * Kill all spawned processes and remove test users from Supabase Auth.
 * Call this in afterEach/afterAll.
 */
export async function cleanup(): Promise<void> {
  // Kill spawned processes
  for (const handle of spawnedProcesses) {
    try {
      handle.kill();
    } catch {
      // Process may already be dead
    }
  }
  spawnedProcesses.clear();
  usedPorts.clear();

  // Remove test users from Supabase Auth
  if (createdUserIds.size > 0) {
    const url = getSupabaseUrl();
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

    for (const userId of createdUserIds) {
      try {
        await fetch(`${url}/auth/v1/admin/users/${userId}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
        });
      } catch {
        // Best-effort cleanup
      }
    }
    createdUserIds.clear();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const internalProcessMap = new Map<number, ChildProcess>();

function wrapProcess(
  proc: ChildProcess,
  onExit?: () => void,
): ProcessHandle {
  const pid = proc.pid!;
  internalProcessMap.set(pid, proc);

  const handle: ProcessHandle = {
    pid,
    kill() {
      proc.kill("SIGTERM");
      internalProcessMap.delete(pid);
      onExit?.();
    },
    waitForExit(): Promise<number> {
      return new Promise((resolve, reject) => {
        proc.on("exit", (code) => {
          internalProcessMap.delete(pid);
          onExit?.();
          resolve(code ?? 1);
        });
        proc.on("error", (err) => {
          internalProcessMap.delete(pid);
          onExit?.();
          reject(err);
        });
      });
    },
  };

  return handle;
}

function waitForOutput(
  proc: ChildProcess,
  pattern: RegExp,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      proc.kill();
      reject(
        new Error(
          `waitForOutput: timed out after ${timeoutMs}ms waiting for ${pattern}`,
        ),
      );
    }, timeoutMs);

    let buffer = "";

    const onData = (data: Buffer) => {
      buffer += data.toString();
      if (pattern.test(buffer)) {
        clearTimeout(timeout);
        proc.stdout?.off("data", onData);
        proc.stderr?.off("data", onData);
        resolve();
      }
    };

    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);

    proc.on("exit", (code) => {
      clearTimeout(timeout);
      if (!pattern.test(buffer)) {
        reject(
          new Error(
            `waitForOutput: process exited (${code}) before pattern ${pattern} was found`,
          ),
        );
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
