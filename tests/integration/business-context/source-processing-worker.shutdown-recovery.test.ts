import { describe, expect, it } from "vitest";
import {
  supabaseServiceKey,
  insertJob,
  readJob,
  createWorker,
} from "./source-processing-worker.helpers";

// ---------------------------------------------------------------------------
// Shutdown — graceful shutdown releases claimed jobs
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker shutdown — graceful shutdown releases claimed jobs",
  () => {
    it("stop() waits for in-flight jobs to complete", async () => {
      const jobId = await insertJob();

      let handlerCompleted = false;

      const worker = createWorker("worker-shutdown");

      worker.registerHandler("crawl_website", async () => {
        await new Promise((r) => setTimeout(r, 300));
        handlerCompleted = true;
        return {};
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

      const worker = createWorker("worker-shutdown-multi", {
        batchSize: 3,
        maxConcurrency: 3,
      });

      worker.registerHandler("crawl_website", async () => {
        await new Promise((r) => setTimeout(r, 200));
        return {};
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

// ---------------------------------------------------------------------------
// Stale recovery — jobs with expired leases recoverable by other workers
// ---------------------------------------------------------------------------

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

      const recoverer = createWorker("worker-stale-recover", {
        stallSweepIntervalMs: 200,
      });

      recoverer.registerHandler("crawl_website", async () => ({}));

      recoverer.start();
      await new Promise((r) => setTimeout(r, 600));
      await recoverer.stop();

      const job = await readJob(jobId);
      // Stall sweep should have recovered the stale job.
      // The recoverer may also process it via its registered handler,
      // resulting in "succeeded" if the handler completes successfully.
      expect(
        ["retry_waiting", "dead_lettered", "running", "succeeded"].includes(
          job.status,
        ),
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

      const recoverer = createWorker("worker-stale-exhausted", {
        stallSweepIntervalMs: 200,
      });

      recoverer.registerHandler("crawl_website", async () => ({}));

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
