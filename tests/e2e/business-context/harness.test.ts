import { describe, expect, it, afterAll, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import {
  resetDatabase,
  createTestSession,
  createTestUser,
  getRandomPort,
  pollForCondition,
  cleanup,
  startScanner,
  waitScannerHealthy,
  cleanupScanner,
  run,
  COMPOSE_FILE,
  validateConfig,
  assertConfigValid,
  setup,
} from "./harness";

// ---------------------------------------------------------------------------
// T011 — E2E Harness smoke tests
// Verifies that the shared harness utilities work correctly against real
// Supabase and NextAuth boundaries. Tests are skipped when env vars are missing.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// T011 — E2E Config Validation (pure RED/GREEN with env save/restore)
// ---------------------------------------------------------------------------

/** Every candidate env var name that validateConfig inspects (across all groups). */
const ALL_CANDIDATE_VARS = [
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_KEY",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXTAUTH_SECRET",
  "META_ENCRYPTION_KEY",
  "FIRECRAWL_API_KEY",
] as const;

/** Save all candidate env vars and set each to a valid dummy value. */
function setAllEnvVars(): { restore: () => void } {
  const saved: Record<string, string | undefined> = {};
  for (const v of ALL_CANDIDATE_VARS) {
    saved[v] = process.env[v];
    process.env[v] = `test-${v.toLowerCase()}`;
  }
  return {
    restore() {
      for (const v of ALL_CANDIDATE_VARS) {
        if (saved[v] === undefined) {
          delete process.env[v];
        } else {
          process.env[v] = saved[v];
        }
      }
    },
  };
}

describe("validateConfig — pure validation", () => {
  let envRestore: (() => void) | undefined;

  afterEach(() => {
    envRestore?.();
    envRestore = undefined;
  });

  it("returns ok when all required groups have at least one candidate", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    const result = validateConfig();
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.missingVars).toHaveLength(0);
  });

  it("accepts NEXT_PUBLIC_SUPABASE_URL as alias for SUPABASE_URL", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_URL;
    const result = validateConfig();
    expect(result.ok).toBe(true);
    expect(result.missingVars).not.toContain("SUPABASE_URL");
  });

  it("accepts NEXT_PUBLIC_SUPABASE_ANON_KEY as alias for SUPABASE_ANON_KEY", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_ANON_KEY;
    const result = validateConfig();
    expect(result.ok).toBe(true);
    expect(result.missingVars).not.toContain("SUPABASE_ANON_KEY");
  });

  it("accepts SUPABASE_KEY as alias for SUPABASE_SERVICE_ROLE_KEY", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = validateConfig();
    expect(result.ok).toBe(true);
    expect(result.missingVars).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("fails when all candidates in a group are missing", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const result = validateConfig();
    expect(result.ok).toBe(false);
    expect(result.missingVars).toContain("SUPABASE_URL");
  });

  it("reports all missing groups independently", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.FIRECRAWL_API_KEY;
    const result = validateConfig();
    expect(result.ok).toBe(false);
    expect(result.missingVars).toHaveLength(3);
    expect(result.missingVars).toContain("SUPABASE_URL");
    expect(result.missingVars).toContain("SUPABASE_ANON_KEY");
    expect(result.missingVars).toContain("FIRECRAWL_API_KEY");
  });

  it("error messages name acceptable aliases", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const result = validateConfig();
    const urlError = result.errors.find((e) => e.variable === "SUPABASE_URL");
    expect(urlError).toBeDefined();
    expect(urlError!.message).toContain("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  });

  it("treats empty string as missing for all candidates", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    process.env.SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    const result = validateConfig();
    expect(result.ok).toBe(false);
    expect(result.missingVars).toContain("SUPABASE_URL");
  });

  it("treats whitespace-only string as missing for all candidates", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    process.env.FIRECRAWL_API_KEY = "   ";
    const result = validateConfig();
    expect(result.ok).toBe(false);
    expect(result.missingVars).toContain("FIRECRAWL_API_KEY");
  });
});

describe("assertConfigValid — throws on missing vars", () => {
  let envRestore: (() => void) | undefined;

  afterEach(() => {
    envRestore?.();
    envRestore = undefined;
  });

  it("does not throw when all groups satisfied", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    expect(() => assertConfigValid()).not.toThrow();
  });

  it("throws descriptive error listing all missing groups", () => {
    const { restore } = setAllEnvVars();
    envRestore = restore;
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.FIRECRAWL_API_KEY;
    expect(() => assertConfigValid()).toThrow(/E2E config validation failed/);
    expect(() => assertConfigValid()).toThrow(/SUPABASE_URL/);
    expect(() => assertConfigValid()).toThrow(/FIRECRAWL_API_KEY/);
  });
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

// ---------------------------------------------------------------------------
// T012 — ClamAV scanner lifecycle
// Verifies the harness can start, health-check, and stop the ClamAV container.
// Requires Docker with the clamav service defined in docker-compose.yml.
// ---------------------------------------------------------------------------

const hasDocker = (() => {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const configValid = (() => {
  try {
    const r = validateConfig();
    return r.ok;
  } catch {
    return false;
  }
})();

describe.skipIf(!hasDocker)("harness — ClamAV scanner lifecycle", () => {
  afterAll(async () => {
    await cleanupScanner();
  }, 30_000);

  it(
    "startScanner starts the clamav container",
    async () => {
      await startScanner();
      const output = execFileSync("docker", [
        "compose", "-f", COMPOSE_FILE,
        "ps", "clamav",
        "--format", "{{.State}}",
      ], { encoding: "utf-8" });
      expect(output.trim().toLowerCase()).toContain("running");
    },
    60_000,
  );

  it(
    "waitScannerHealthy resolves when container is healthy",
    async () => {
      await expect(waitScannerHealthy(150_000)).resolves.toBeUndefined();
    },
    180_000,
  );

  it(
    "cleanupScanner stops the clamav container",
    async () => {
      await cleanupScanner();
      const output = execFileSync("docker", [
        "compose", "-f", COMPOSE_FILE,
        "ps", "clamav",
        "--format", "{{.State}}",
      ], { encoding: "utf-8" });
      expect(output.trim().toLowerCase()).not.toContain("running");
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// RED: run() rejects after deadline — proves timed-out children reject
// ---------------------------------------------------------------------------

describe("scanner — run() rejects after deadline", () => {
  it(
    "rejects with timeout error when child exceeds deadline",
    async () => {
      await expect(run("sleep", ["10"], 200)).rejects.toThrow(/timed out/i);
    },
    5_000,
  );

  it(
    "resolves normally when child completes within deadline",
    async () => {
      const result = await run("echo", ["ok"], 5_000);
      expect(result.stdout).toBe("ok");
    },
    5_000,
  );
});

// ---------------------------------------------------------------------------
// RED: run() error surfacing — proves non-container errors propagate
// ---------------------------------------------------------------------------

describe("scanner — run() propagates docker compose errors", () => {
  it(
    "surfaces unexpected errors from docker compose rm",
    async () => {
      await expect(
        run("docker", [
          "compose", "-f", COMPOSE_FILE,
          "rm", "-f", "nonexistent-service-xyz",
        ], 10_000),
      ).rejects.toThrow();
    },
    15_000,
  );
});

// ---------------------------------------------------------------------------
// T012 — Lifecycle orchestration (setup → validate → reset → scanner healthy)
// Two separate suites with explicit skip reasons instead of silent combined skip.
// ---------------------------------------------------------------------------

if (!configValid) {
  describe.skip("harness — setup() lifecycle orchestration (skipped: E2E env vars missing)", () => {});
} else if (!hasDocker) {
  describe.skip("harness — setup() lifecycle orchestration (skipped: Docker unavailable)", () => {});
} else {
  describe("harness — setup() lifecycle orchestration", () => {
    afterAll(async () => {
      await cleanupScanner();
    }, 30_000);

    it(
      "validates config, resets DB, starts scanner, waits healthy",
      async () => {
        const result = await setup({ scannerTimeoutMs: 150_000 });

        expect(result.validated).toBe(true);
        expect(result.resetAt).toBeDefined();
        expect(result.scannerStartedAt).toBeDefined();
        expect(result.scannerHealthyAt).toBeDefined();

        // Verify scanner is actually running after setup
        const output = execFileSync("docker", [
          "compose", "-f", COMPOSE_FILE,
          "ps", "clamav",
          "--format", "{{.State}}",
        ], { encoding: "utf-8" });
        expect(output.trim().toLowerCase()).toContain("running");
      },
      180_000,
    );
  });
}
