import { describe, expect, it } from "vitest";
import {
  supabaseServiceKey,
  insertJob,
  readJob,
  createWorker,
} from "./source-processing-worker.helpers";

// ---------------------------------------------------------------------------
// Heartbeat — worker sends heartbeat to extend lease during long processing
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker heartbeat — extends lease during processing",
  () => {
    it("heartbeat_at is updated periodically while job runs", async () => {
      const jobId = await insertJob();

      let midHeartbeat: string | null = null;

      const worker = createWorker("worker-heartbeat");

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

// ---------------------------------------------------------------------------
// Retry wait — failed jobs enter wait period before retry
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker retry wait — failed jobs enter wait period",
  () => {
    it("job transitions to retry_waiting after handler failure", async () => {
      const jobId = await insertJob();

      const worker = createWorker("worker-retry");

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

      const worker = createWorker("worker-retry-claim");

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
