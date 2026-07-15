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

// Import cleanup helpers for orchestrator
import { cleanupUsers } from "./supabase";
import { cleanupProcesses } from "./process";

/**
 * Kill all spawned processes and remove test users from Supabase Auth.
 * Call this in afterEach/afterAll.
 */
export async function cleanup(): Promise<void> {
  cleanupProcesses();
  await cleanupUsers();
}
