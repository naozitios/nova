/**
 * Shared types for E2E test harness.
 */

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
