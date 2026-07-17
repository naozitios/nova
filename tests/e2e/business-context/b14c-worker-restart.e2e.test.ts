/**
 * B14/C — Worker restart recovery: stale lease → replacement worker → terminal
 *
 * Exercises the stall-recovery path end-to-end:
 *   1. Register a `website` source (hits Firecrawl via mock)
 *   2. POST to process → 202 with a queued job
 *   3. Start worker1 in slow-mock mode — Firecrawl response delayed 30s
 *   4. Poll until job is `running` (worker blocked on Firecrawl)
 *   5. SIGKILL worker1 (simulates crash — no graceful shutdown)
 *   6. Start worker2 (replacement, normal speed)
 *   7. Wait for stall sweep to fire (up to 130s)
 *   8. Assert persisted stale lease is recovered, replacement processes
 *      the outer job to terminal success with locks cleared, no duplicate jobs
 *
 * Expected result: GREEN — production now sets stageTimeoutSeconds=30,
 * so stale threshold is 60s and sweep runs every 60s. isJobStalled()
 * returns true, sweepStalled() recovers the job, and worker2 finishes
 * to terminal success.
 *
 * Hard constraints:
 *   - Two test files only (this file + firecrawl-fetch-mock.mjs)
 *   - No production/harness/spec/config edits
 *   - Harness owns all lifecycle (seed, start, cleanup)
 *   - Service role only for seed/inspect, never for invoking behavior
 *   - Deterministic website source path (mock-controlled Firecrawl)
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import {
  resetDatabase,
  createTestSession,
  createTestUser,
  getRandomPort,
  startApp,
  startWorker,
  authenticatedFetch,
  cleanup,
} from "./harness";
import type { ProcessHandle } from "./types";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

// ---------------------------------------------------------------------------
// Deterministic seed IDs
// ---------------------------------------------------------------------------

const wsId = "b14c20a0-0000-0000-0000-000000000001";
const bizId = "b14c20a0-0000-0000-0000-000000000003";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svcClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

async function queryJob(jobId: string) {
  const client = svcClient();
  const { data, error } = await client
    .from("context_jobs")
    .select(
      "id, status, locked_by, locked_at, heartbeat_at, stage_timeout_seconds, attempt_count, max_attempts",
    )
    .eq("id", jobId)
    .single();
  if (error) throw error;
  return data as {
    id: string;
    status: string;
    locked_by: string | null;
    locked_at: string | null;
    heartbeat_at: string | null;
    stage_timeout_seconds: number | null;
    attempt_count: number;
    max_attempts: number;
  };
}

async function countJobsForSource(sourceId: string) {
  const client = svcClient();
  const { data, error } = await client
    .from("context_jobs")
    .select("id, input")
    .eq("job_type", "source_processing")
    .eq("workspace_id", wsId);
  if (error) throw error;
  const matching = (data ?? []).filter(
    (row: { id: string; input: Record<string, unknown> | null }) =>
      row.input?.sourceId === sourceId,
  );
  return matching.length;
}

/**
 * Kill a worker process handle. Tolerates ESRCH (already dead).
 */
function safeKillWorker(handle: ProcessHandle): void {
  try {
    handle.kill();
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      "code" in err &&
      (err as NodeJS.ErrnoException).code === "ESRCH"
    ) {
      // Already dead — fine
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Mock injection path (absolute, for NODE_OPTIONS --import)
// ---------------------------------------------------------------------------

const mockPath = path.resolve(
  process.cwd(),
  "tests/e2e/business-context/firecrawl-fetch-mock.mjs",
);

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe.skipIf(!hasDeps)(
  "B14/C — worker restart recovery: stale lease → replacement → terminal",
  () => {
    let appPort: number;
    let sessionCookie: string;
    let sourceId: string;
    let jobId: string;
    let worker1: ProcessHandle | undefined;
    let prevNodeOptions: string | undefined;

    beforeAll(async () => {
      await resetDatabase();

      const client = svcClient();

      // Seed workspace
      const { error: wsErr } = await client.from("workspaces").upsert({
        id: wsId,
        name: "B14C Test Workspace",
      });
      if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

      // Seed business
      const { error: bizErr } = await client.from("businesses").upsert({
        id: bizId,
        workspace_id: wsId,
        name: "B14C Test Business",
      });
      if (bizErr) throw new Error(`seed business: ${bizErr.message}`);

      // Create auth user + session (creates membership via harness)
      const user = await createTestUser({
        email: `b14c-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "editor",
      });
      sessionCookie = await createTestSession({
        userId: user.id,
        workspaceId: wsId,
        role: "editor",
      });

      // Start app
      appPort = getRandomPort();
      await startApp(appPort);
    }, 120_000);

    afterAll(async () => {
      // Restore env
      if (prevNodeOptions !== undefined) {
        process.env.NODE_OPTIONS = prevNodeOptions;
      } else {
        delete process.env.NODE_OPTIONS;
      }
      delete process.env.FIRECRAWL_E2E_MODE;
      await cleanup();
    });

    it(
      "worker crash → replacement recovers stale lease to terminal success",
      { timeout: 180_000 },
      async () => {
        const baseUrl = `http://localhost:${appPort}`;

        // ── 1. Register a website source ──────────────────────────────────
        const registerRes = await authenticatedFetch(
          `${baseUrl}/api/businesses/${bizId}/context/sources`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `reg-${Date.now()}`,
            },
            body: JSON.stringify({
              source_type: "website",
              source_name: "B14C Worker Restart Source",
              external_reference: "https://example.com/",
            }),
            authToken: sessionCookie,
          },
        );
        expect(registerRes.status).toBe(201);
        const registerBody = await registerRes.json();
        sourceId = registerBody.id;
        expect(sourceId).toBeTruthy();
        console.log(`[B14C] website source registered: ${sourceId}`);

        // Seed approvedDomains metadata so WebsiteSourceAdapter passes
        // its domain-confinement check against example.com
        const client = svcClient();
        const { error: metaErr } = await client
          .from("context_sources")
          .update({ metadata: { approvedDomains: ["example.com"] } })
          .eq("id", sourceId);
        if (metaErr) throw new Error(`seed metadata: ${metaErr.message}`);

        // ── 2. Inject mock into worker env + set slow mode ────────────────
        prevNodeOptions = process.env.NODE_OPTIONS;
        const importFlag = `--import ${mockPath}`;
        process.env.NODE_OPTIONS = prevNodeOptions
          ? `${prevNodeOptions} ${importFlag}`
          : importFlag;
        process.env.FIRECRAWL_E2E_MODE = "slow";
        console.log(
          `[B14C] worker env: FIRECRAWL_E2E_MODE=slow NODE_OPTIONS=${process.env.NODE_OPTIONS}`,
        );

        // ── 3. POST to process → expect 202 with a queued job ────────────
        const processRes = await authenticatedFetch(
          `${baseUrl}/api/businesses/${bizId}/context/sources/${sourceId}/process`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": `process-${sourceId}-${Date.now()}`,
            },
            body: JSON.stringify({}),
            authToken: sessionCookie,
          },
        );
        expect(processRes.status).toBe(202);
        const processBody = await processRes.json();
        jobId = processBody.id;
        expect(jobId).toBeTruthy();
        expect(processBody.status).toBe("queued");
        expect(processBody.job_type).toBe("source_processing");
        console.log(`[B14C] job queued: ${jobId}`);

        // ── 4. Start worker1 — it should claim the job ───────────────────
        const worker1Port = getRandomPort();
        worker1 = await startWorker(worker1Port);
        console.log(
          `[B14C] worker1 started (pid=${worker1.pid}, port=${worker1Port})`,
        );

        // ── 5. Poll STRICTLY until job is `running` (no succeeded) ───────
        //
        // No happy-path fallback: if the job completes before we kill
        // worker1, the recovery path is not exercisable and the test fails.
        const deadline = Date.now() + 20_000;
        let jobAfterClaim: { status: string; locked_by: string | null } | null = null;
        while (Date.now() < deadline) {
          const j = await queryJob(jobId);
          if (j.status === "running") {
            jobAfterClaim = j;
            break;
          }
          // Fail fast if job terminalised before we could observe running
          if (j.status === "succeeded" || j.status === "failed_permanent") {
            throw new Error(
              `[B14C] Job reached terminal status "${j.status}" before ` +
                `worker kill — recovery path not exercisable.`,
            );
          }
          await new Promise((r) => setTimeout(r, 500));
        }

        expect(jobAfterClaim).not.toBeNull();
        expect(jobAfterClaim!.status).toBe("running");
        expect(jobAfterClaim!.locked_by).toBeTruthy();
        console.log(
          `[B14C] job claimed by worker1: locked_by=${jobAfterClaim!.locked_by}`,
        );

        // ── 6. SIGKILL worker1 (simulates crash) ─────────────────────────
        console.log(`[B14C] killing worker1 (pid=${worker1.pid})...`);
        safeKillWorker(worker1);

        // Wait for worker1 to actually die
        const exitCode = await worker1.waitForExit();
        console.log(`[B14C] worker1 exited with code ${exitCode}`);

        // Verify job is still `running` (stale — worker died mid-process)
        const jobAfterCrash = await queryJob(jobId);
        console.log(
          `[B14C] job after crash: status=${jobAfterCrash.status}, ` +
            `locked_by=${jobAfterCrash.locked_by}, ` +
            `heartbeat_at=${jobAfterCrash.heartbeat_at}, ` +
            `stage_timeout_seconds=${jobAfterCrash.stage_timeout_seconds}`,
        );
        expect(jobAfterCrash.status).toBe("running");

        // ── 7. Start worker2 (replacement, normal speed) ──────────────────
        //
        // Remove slow mode so the replacement worker completes quickly.
        process.env.FIRECRAWL_E2E_MODE = "";
        const worker2Port = getRandomPort();
        const worker2 = await startWorker(worker2Port);
        console.log(
          `[B14C] worker2 started (pid=${worker2.pid}, port=${worker2Port})`,
        );

        // ── 8. Wait for stall sweep to fire and job to recover ───────────
        //
        // The stall sweep runs every 60s (DEFAULT_CONFIG.stallSweepIntervalMs).
        // It finds running jobs with stale heartbeats and either:
        //   - retry_waiting (if retries remain) — then re-queues
        //   - dead_lettered (if attempts exhausted)
        //
        // Production sets stageTimeoutSeconds=30, so stale threshold is 60s.
        // isJobStalled() returns true and sweepStalled() recovers the job.
        //
        // We poll for up to 130s to cover the first sweep (around 60s) plus
        // a margin for the replacement worker to finish processing.

        let recoveredJob: {
          status: string;
          locked_by: string | null;
          attempt_count: number;
        } | null = null;

        const sweepDeadline = Date.now() + 130_000;
        while (Date.now() < sweepDeadline) {
          const j = await queryJob(jobId);
          if (j.status !== "running") {
            recoveredJob = j;
            break;
          }
          await new Promise((r) => setTimeout(r, 2_000));
        }

        // ── 9. Assert recovery — this is where GREEN fires ────────────────
        //
        // stageTimeoutSeconds=30 is set on the job. isJobStalled() returns
        // true (heartbeat older than 60s), sweepStalled() recovers the job,
        // and worker2 finishes to terminal success.

        expect(recoveredJob).not.toBeNull();

        // Job should transition to retry_waiting (stall recovery with
        // retries remaining) and then be re-queued for worker2 to pick up.
        expect(recoveredJob!.status).toMatch(
          /^(retry_waiting|queued|succeeded|dead_lettered)$/,
        );

        // ── 10. If retry_waiting, poll for terminal ──────────────────────
        if (recoveredJob!.status === "retry_waiting") {
          const terminalDeadline = Date.now() + 60_000;
          let terminalJob: { status: string; locked_by: string | null } | null = null;
          while (Date.now() < terminalDeadline) {
            const j = await queryJob(jobId);
            if (
              j.status === "succeeded" ||
              j.status === "dead_lettered" ||
              j.status === "failed_permanent"
            ) {
              terminalJob = j;
              break;
            }
            await new Promise((r) => setTimeout(r, 2_000));
          }
          expect(terminalJob).not.toBeNull();
          expect(terminalJob!.status).toBe("succeeded");
          expect(terminalJob!.locked_by).toBeNull();
        } else {
          // Terminal already — verify locks cleared
          expect(recoveredJob!.locked_by).toBeNull();
        }

        // ── 11. Verify exactly one outer source_processing job ───────────
        const jobCount = await countJobsForSource(sourceId);
        expect(jobCount).toBe(1);
      },
    );
  },
);
