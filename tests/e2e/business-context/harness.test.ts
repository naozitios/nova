import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  resetDatabase,
  createTestSession,
  createTestUser,
  getRandomPort,
  startApp,
  authenticatedFetch,
  pollForCondition,
  captureLogs,
  cleanup,
  type ProcessHandle,
} from "./harness";

// ---------------------------------------------------------------------------
// T011 — E2E Harness smoke tests
// Verifies that the shared harness utilities work correctly against real
// Supabase and NextAuth boundaries. Tests are skipped when env vars are missing.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

const hasSupabase = !!supabaseServiceKey;

// Track created test users for cleanup
const createdUserIds: string[] = [];

afterAll(async () => {
  if (!hasSupabase) return;
  // Cleanup any test users created during tests
  await cleanup();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe.skipIf(!hasSupabase)("harness — resetDatabase", () => {
  it("completes without error", async () => {
    await expect(resetDatabase()).resolves.toBeUndefined();
  });
});

describe.skipIf(!hasSupabase)("harness — createTestSession", () => {
  it("returns a valid cookie string", async () => {
    const cookie = await createTestSession({
      userId: "00000000-0000-0000-0000-000000000099",
      workspaceId: "00000000-0000-0000-0000-000000000001",
      role: "editor",
    });

    expect(typeof cookie).toBe("string");
    expect(cookie.length).toBeGreaterThan(0);
    // NextAuth session cookie format: key=value; ... (typically contains __Secure-next-auth.session-token or next-auth.session-token)
    expect(cookie).toMatch(/next-auth\.session-token/);
  });
});

describe.skipIf(!hasSupabase)("harness — createTestUser", () => {
  it("creates a user and returns a valid TestUser", async () => {
    const user = await createTestUser({
      email: `test-harness-${Date.now()}@example.com`,
    });

    createdUserIds.push(user.id);

    expect(user.id).toBeDefined();
    expect(typeof user.id).toBe("string");
    expect(user.id.length).toBeGreaterThan(0);
    expect(user.email).toMatch(/^test-harness-.*@example\.com$/);
    expect(typeof user.jwt).toBe("string");
    expect(user.jwt.length).toBeGreaterThan(0);
    expect(typeof user.refreshToken).toBe("string");
    expect(user.refreshToken.length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasSupabase)("harness — getRandomPort", () => {
  it("returns different ports on successive calls", () => {
    const ports = new Set<number>();
    for (let i = 0; i < 20; i++) {
      ports.add(getRandomPort());
    }
    // With 20 calls, at least 15 should be unique (collisions unlikely with 16-bit range)
    expect(ports.size).toBeGreaterThanOrEqual(15);
  });
});

describe.skipIf(!hasSupabase)("harness — pollForCondition", () => {
  it("resolves when condition is met", async () => {
    let counter = 0;
    const result = await pollForCondition(
      () => {
        counter++;
        return counter >= 3 ? "done" : null;
      },
      5000,
      10,
    );

    expect(result).toBe("done");
    expect(counter).toBeGreaterThanOrEqual(3);
  });

  it("throws on timeout", async () => {
    await expect(
      pollForCondition(
        () => null,
        200,
        50,
      ),
    ).rejects.toThrowError(/timed out/i);
  });
});
