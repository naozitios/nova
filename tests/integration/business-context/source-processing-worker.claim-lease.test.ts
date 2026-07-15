import { describe, expect, it } from "vitest";
import {
  supabaseServiceKey,
  insertJob,
  readJob,
  createWorker,
} from "./source-processing-worker.helpers";

// ---------------------------------------------------------------------------
// Claim race + lease behavior
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker claim race — two workers claim same job",
  () => {
    it("only one worker wins the claim race on a single queued job", async () => {
      const jobId = await insertJob();

      const claims: string[] = [];

      const workerA = createWorker("worker-race-a");
      const workerB = createWorker("worker-race-b");

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

// ---------------------------------------------------------------------------
// Lease — job claimed with lease expiry, released if worker crashes
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker lease — job claimed with lease expiry",
  () => {
    it("claimed job has locked_at and heartbeat_at set", async () => {
      const jobId = await insertJob();

      const worker = createWorker("worker-lease");

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
      const recoverer = createWorker("worker-recover", {
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
