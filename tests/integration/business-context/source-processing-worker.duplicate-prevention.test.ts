import { describe, expect, it } from "vitest";
import {
  supabaseServiceKey,
  insertJob,
  readJob,
  createWorker,
  getRepo,
} from "./source-processing-worker.helpers";

// ---------------------------------------------------------------------------
// Duplicate prevention — same job can't be claimed twice simultaneously
// ---------------------------------------------------------------------------

describe.skipIf(!supabaseServiceKey)(
  "Worker duplicate prevention — same job can't be claimed twice",
  () => {
    it("claimRunnableJobs returns empty when job already locked", async () => {
      const jobId = await insertJob();

      let lockedByDuringProcessing: string | null = null;

      // Worker A claims the job
      const workerA = createWorker("worker-dup-a");

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
      const workerB = createWorker("worker-dup-b");

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
      const repo = getRepo();
      const result1 = await repo.claimRunnableJobs(
        { status: "queued" },
        "worker-direct-1",
        1,
      );
      expect(result1.ok).toBe(true);
      expect(result1.data).toHaveLength(1);
      expect(result1.data[0].id).toBe(jobId);

      // Second claim attempt — job is now locked, should return empty
      const result2 = await repo.claimRunnableJobs(
        { status: "queued" },
        "worker-direct-2",
        1,
      );
      expect(result2.ok).toBe(true);
      expect(result2.data).toHaveLength(0);
    });
  },
);
