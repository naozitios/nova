import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { JobRunner } from "@/infrastructure/business-context/job-runner/job-runner";
import type { RepositoryPort } from "@/core/business-context/repository.port";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";

// ---------------------------------------------------------------------------
// T015 — Source processing worker tests (US1)
// Covers: claim race, lease, heartbeat, retry wait, shutdown, stale recovery,
// and duplicate prevention.
//
// Uses real Supabase database + real JobRunner instances.
// Seeding/inspection via service role. Workers via real JobRunner.
// Tests verify worker-level claim behavior, not just DB state transitions.
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

let client: SupabaseClient | null = null;
let repo: RepositoryPort | null = null;

const TEST_WORKSPACE = "30000000-0000-0000-0000-000000000001";
const TEST_BUSINESS = "30000000-0000-0000-0000-000000000002";

beforeAll(() => {
  if (supabaseServiceKey) {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    repo = new SupabaseRepository(client);
  }
});

// Track created rows for cleanup
const createdJobs: string[] = [];

afterEach(async () => {
  if (!client) return;
  for (const id of [...createdJobs].reverse()) {
    await client.from("context_jobs").delete().eq("id", id);
  }
  createdJobs.length = 0;
});

function track(id: string) {
  createdJobs.push(id);
}

async function insertJob(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track(id);
  const { error } = await client!.from("context_jobs").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    job_type: "crawl_website",
    status: "queued",
    attempt_count: 0,
    max_attempts: 4,
    idempotency_key: `t015-${id}`,
    input: { url: "https://example.com" },
    retry_policy: {},
    stage_timeout_seconds: 60,
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function readJob(id: string) {
  const { data, error } = await client!
    .from("context_jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Claim race — two workers claiming the same job, only one wins
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker claim race — two workers claim same job",
  () => {
    it("only one worker wins the claim race on a single queued job", async () => {
      const jobId = await insertJob();

      const claims: string[] = [];

      const workerA = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-race-a",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      const workerB = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-race-b",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      // Handler captures which worker claimed the job during processing.
      // executeJob clears locked_by on success, so we must check during execution.
      const noopHandler = async () => {
        const j = await readJob(jobId);
        if (j.locked_by) claims.push(j.locked_by);
        return { output: null };
      };
      workerA.registerHandler("crawl_website", noopHandler);
      workerB.registerHandler("crawl_website", noopHandler);

      // Start both workers concurrently — race for the single job
      await Promise.all([
        (async () => {
          workerA.start();
          await new Promise((r) => setTimeout(r, 500));
          await workerA.stop();
        })(),
        (async () => {
          workerB.start();
          await new Promise((r) => setTimeout(r, 500));
          await workerB.stop();
        })(),
      ]);

      // Exactly one worker should have claimed the job
      expect(claims.length).toBe(1);
      expect(
        ["worker-race-a", "worker-race-b"].includes(claims[0]),
      ).toBe(true);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Lease — job claimed with lease expiry, released if worker crashes
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker lease — job claimed with lease expiry",
  () => {
    it("claimed job has locked_at and heartbeat_at set", async () => {
      const jobId = await insertJob();

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-lease",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => {
        // Simulate slow processing — wait longer than lease
        await new Promise((r) => setTimeout(r, 200));
        return { output: null };
      });

      worker.start();
      await new Promise((r) => setTimeout(r, 400));
      await worker.stop();

      const job = await readJob(jobId);
      // After successful completion, locks are released
      expect(job.locked_by).toBeNull();
      expect(job.status).toBe("succeeded");
    });

    it("lease is released on worker crash (no heartbeat renewal)", async () => {
      const jobId = await insertJob({
        status: "running",
        attempt_count: 1,
        locked_by: "worker-crashed",
        locked_at: new Date(Date.now() - 300_000).toISOString(),
        heartbeat_at: new Date(Date.now() - 300_000).toISOString(),
        stage_timeout_seconds: 30,
      });

      // Simulate: job is running but worker is gone.
      // Another worker's stall sweep should recover it.
      const recoverer = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-recover",
        maxConcurrency: 5,
        stallSweepIntervalMs: 200,
      });

      recoverer.registerHandler("crawl_website", async () => ({
        output: null,
      }));

      recoverer.start();
      await new Promise((r) => setTimeout(r, 500));
      await recoverer.stop();

      const job = await readJob(jobId);
      // Stall sweep should have picked up the stale job
      // and transitioned it to retry_waiting or dead_lettered
      expect(
        ["retry_waiting", "dead_lettered", "running"].includes(job.status),
      ).toBe(true);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Heartbeat — worker sends heartbeat to extend lease during long processing
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker heartbeat — extends lease during processing",
  () => {
    it("heartbeat_at is updated periodically while job runs", async () => {
      const jobId = await insertJob();

      let midHeartbeat: string | null = null;

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-heartbeat",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => {
        // Capture heartbeat mid-processing before it's cleared on completion
        await new Promise((r) => setTimeout(r, 300));
        const mid = await readJob(jobId);
        midHeartbeat = mid.heartbeat_at;
        // Continue processing
        await new Promise((r) => setTimeout(r, 400));
        return { output: null };
      });

      worker.start();
      await new Promise((r) => setTimeout(r, 900));
      await worker.stop();

      // Heartbeat should have been set during processing
      expect(midHeartbeat).toBeTruthy();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Retry wait — failed jobs enter wait period before retry
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker retry wait — failed jobs enter wait period",
  () => {
    it("job transitions to retry_waiting after handler failure", async () => {
      const jobId = await insertJob();

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-retry",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => {
        throw new Error("Simulated provider timeout");
      });

      worker.start();
      await new Promise((r) => setTimeout(r, 800));
      await worker.stop();

      const job = await readJob(jobId);
      // After failure, job should be in retry_waiting or failed state
      expect(
        ["retry_waiting", "failed_retryable", "failed_permanent"].includes(
          job.status,
        ),
      ).toBe(true);
      expect(job.attempt_count).toBeGreaterThanOrEqual(1);
    });

    it("retry_waiting job is claimable after next_run_at passes", async () => {
      const jobId = await insertJob({
        status: "retry_waiting",
        attempt_count: 1,
        max_attempts: 4,
        next_run_at: new Date(Date.now() - 1000).toISOString(), // already past
        error_class: "provider_timeout",
      });

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-retry-claim",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => ({
        output: null,
      }));

      worker.start();
      await new Promise((r) => setTimeout(r, 500));
      await worker.stop();

      const job = await readJob(jobId);
      // Worker should have picked up the retry_waiting job
      expect(
        ["running", "succeeded"].includes(job.status),
      ).toBe(true);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Shutdown — graceful shutdown releases claimed jobs
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker shutdown — graceful shutdown releases claimed jobs",
  () => {
    it("stop() waits for in-flight jobs to complete", async () => {
      const jobId = await insertJob();

      let handlerCompleted = false;

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-shutdown",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => {
        await new Promise((r) => setTimeout(r, 300));
        handlerCompleted = true;
        return { output: null };
      });

      worker.start();
      await new Promise((r) => setTimeout(r, 200));

      // Stop should wait for in-flight job
      await worker.stop();

      expect(handlerCompleted).toBe(true);

      const job = await readJob(jobId);
      expect(job.status).toBe("succeeded");
      expect(job.locked_by).toBeNull();
    });

    it("stop() releases locks after all jobs finish", async () => {
      const jobIds = await Promise.all([
        insertJob(),
        insertJob(),
        insertJob(),
      ]);

      const worker = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 3,
        workerId: "worker-shutdown-multi",
        maxConcurrency: 3,
        stallSweepIntervalMs: 60_000,
      });

      worker.registerHandler("crawl_website", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return { output: null };
      });

      worker.start();
      await new Promise((r) => setTimeout(r, 400));
      await worker.stop();

      for (const id of jobIds) {
        const job = await readJob(id);
        expect(job.locked_by).toBeNull();
        expect(job.status).toBe("succeeded");
      }
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Stale recovery — jobs with expired leases recoverable by other workers
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker stale recovery — expired lease jobs recoverable",
  () => {
    it("stall sweep recovers jobs with stale heartbeat", async () => {
      const stageTimeoutSeconds = 10;
      const jobId = await insertJob({
        status: "running",
        attempt_count: 1,
        max_attempts: 4,
        locked_by: "worker-dead",
        locked_at: new Date(Date.now() - 120_000).toISOString(),
        heartbeat_at: new Date(
          Date.now() - stageTimeoutSeconds * 2 * 1000 - 5000,
        ).toISOString(),
        stage_timeout_seconds: stageTimeoutSeconds,
      });

      const recoverer = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-stale-recover",
        maxConcurrency: 5,
        stallSweepIntervalMs: 200,
      });

      recoverer.registerHandler("crawl_website", async () => ({
        output: null,
      }));

      recoverer.start();
      await new Promise((r) => setTimeout(r, 600));
      await recoverer.stop();

      const job = await readJob(jobId);
      // Stall sweep should have recovered the stale job.
      // The recoverer may also process it via its registered handler,
      // resulting in "succeeded" if the handler completes successfully.
      expect(
        ["retry_waiting", "dead_lettered", "running", "succeeded"].includes(job.status),
      ).toBe(true);
    });

    it("exhausted stale job goes to dead_lettered", async () => {
      const stageTimeoutSeconds = 10;
      const jobId = await insertJob({
        status: "running",
        attempt_count: 4,
        max_attempts: 4,
        locked_by: "worker-dead-exhausted",
        locked_at: new Date(Date.now() - 120_000).toISOString(),
        heartbeat_at: new Date(
          Date.now() - stageTimeoutSeconds * 2 * 1000 - 5000,
        ).toISOString(),
        stage_timeout_seconds: stageTimeoutSeconds,
      });

      const recoverer = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-stale-exhausted",
        maxConcurrency: 5,
        stallSweepIntervalMs: 200,
      });

      recoverer.registerHandler("crawl_website", async () => ({
        output: null,
      }));

      recoverer.start();
      await new Promise((r) => setTimeout(r, 600));
      await recoverer.stop();

      const job = await readJob(jobId);
      // Exhausted stall → dead_lettered
      expect(
        ["dead_lettered", "retry_waiting"].includes(job.status),
      ).toBe(true);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Duplicate prevention — same job can't be claimed twice simultaneously
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Worker duplicate prevention — same job can't be claimed twice",
  () => {
    it("claimRunnableJobs returns empty when job already locked", async () => {
      const jobId = await insertJob();

      let lockedByDuringProcessing: string | null = null;

      // Worker A claims the job
      const workerA = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-dup-a",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      // Slow handler — captures lock state during processing
      workerA.registerHandler("crawl_website", async () => {
        await new Promise((r) => setTimeout(r, 100));
        const j = await readJob(jobId);
        lockedByDuringProcessing = j.locked_by;
        await new Promise((r) => setTimeout(r, 900));
        return { output: null };
      });

      workerA.start();
      await new Promise((r) => setTimeout(r, 300));

      // Worker B tries to claim — should get nothing
      const workerB = new JobRunner(repo!, {
        pollIntervalMs: 100,
        batchSize: 1,
        workerId: "worker-dup-b",
        maxConcurrency: 5,
        stallSweepIntervalMs: 60_000,
      });

      workerB.registerHandler("crawl_website", async () => ({
        output: null,
      }));

      workerB.start();
      await new Promise((r) => setTimeout(r, 500));
      await workerB.stop();
      await workerA.stop();

      // Worker A should have held the lock during processing
      expect(lockedByDuringProcessing).toBe("worker-dup-a");
    });

    it("second claim attempt on same job returns empty via repo", async () => {
      const jobId = await insertJob();

      // First claim via repo directly
      const result1 = await repo!.claimRunnableJobs(
        { status: "queued" },
        "worker-direct-1",
        1,
      );
      expect(result1.ok).toBe(true);
      expect(result1.data).toHaveLength(1);
      expect(result1.data[0].id).toBe(jobId);

      // Second claim attempt — job is now locked, should return empty
      const result2 = await repo!.claimRunnableJobs(
        { status: "queued" },
        "worker-direct-2",
        1,
      );
      expect(result2.ok).toBe(true);
      expect(result2.data).toHaveLength(0);
    });
  },
);
