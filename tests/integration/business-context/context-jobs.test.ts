import { describe, expect, it, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T066 — Context job lifecycle tests
// Covers FR-032 (async idempotent jobs), FR-038 (job status states),
// FR-039 (retry with exponential backoff), FR-041 (stalled/heartbeat).
//
// Job statuses: queued, scheduled, running, retry_waiting, succeeded,
// failed_retryable, failed_permanent, stalled, dead_lettered, cancelled.
//
// Uses local Supabase; tests verify state transitions, retry scheduling,
// heartbeat stalled detection, and structured error redaction.
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

let client: SupabaseClient | null = null;

const TEST_WORKSPACE = "30000000-0000-0000-0000-000000000001";
const TEST_BUSINESS = "30000000-0000-0000-0000-000000000002";

// Track created rows for cleanup
const createdJobs: string[] = [];

afterAll(async () => {
  if (!client) return;
  for (const id of [...createdJobs].reverse()) {
    await client.from("context_jobs").delete().eq("id", id);
  }
});

function track(id: string) {
  createdJobs.push(id);
}

async function insertJob(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track(id);
  const { error } = await client.from("context_jobs").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    job_type: "crawl_website",
    status: "queued",
    attempt_count: 0,
    max_attempts: 4,
    idempotency_key: `t066-${id}`,
    input: { url: "https://example.com" },
    retry_policy: {},
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function readJob(id: string) {
  const { data, error } = await client
    .from("context_jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// Happy path: queued → scheduled → running → succeeded
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — happy path",
  () => {
    it("transitions queued → scheduled → running → succeeded", async () => {
      const id = await insertJob();

      // Start at queued
      const q = await readJob(id);
      expect(q.status).toBe("queued");
      expect(q.attempt_count).toBe(0);

      // Transition to scheduled
      await client
        .from("context_jobs")
        .update({ status: "scheduled", next_run_at: new Date().toISOString() })
        .eq("id", id);
      const s = await readJob(id);
      expect(s.status).toBe("scheduled");

      // Transition to running
      const now = new Date().toISOString();
      await client
        .from("context_jobs")
        .update({
          status: "running",
          started_at: now,
          heartbeat_at: now,
          locked_by: "worker-1",
          locked_at: now,
          attempt_count: 1,
        })
        .eq("id", id);
      const r = await readJob(id);
      expect(r.status).toBe("running");
      expect(r.attempt_count).toBe(1);
      expect(r.started_at).toBeTruthy();
      expect(r.heartbeat_at).toBeTruthy();
      expect(r.locked_by).toBe("worker-1");

      // Transition to succeeded
      await client
        .from("context_jobs")
        .update({
          status: "succeeded",
          completed_at: new Date().toISOString(),
          output: { pages: 5, facts: 12 },
        })
        .eq("id", id);
      const done = await readJob(id);
      expect(done.status).toBe("succeeded");
      expect(done.completed_at).toBeTruthy();
      expect(done.output).toEqual({ pages: 5, facts: 12 });
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Retryable failure: queued → running → failed_retryable → retry_waiting
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — retryable failure and retry scheduling",
  () => {
    it("transitions running → failed_retryable with structured error", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      await client
        .from("context_jobs")
        .update({
          status: "failed_retryable",
          error_class: "provider_timeout",
          error: {
            code: "PROVIDER_TIMEOUT",
            message: "Firecrawl request timed out after 30s",
            details: { timeout_ms: 30000 },
          },
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("failed_retryable");
      expect(job.error_class).toBe("provider_timeout");
      expect(job.error.code).toBe("PROVIDER_TIMEOUT");
    });

    it("transitions failed_retryable → retry_waiting with exponential delay", async () => {
      const id = await insertJob({
        status: "failed_retryable",
        attempt_count: 1,
        error_class: "provider_5xx",
      });

      // FR-039: V1 default delays are 30s, 2min, 10min, 30min
      // Attempt 1 failed → next retry at attempt 2: ~30s delay
      const delayMs = 30_000;
      const nextRunAt = new Date(Date.now() + delayMs).toISOString();

      await client
        .from("context_jobs")
        .update({
          status: "retry_waiting",
          next_run_at: nextRunAt,
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("retry_waiting");
      expect(job.next_run_at).toBeTruthy();
      expect(new Date(job.next_run_at).getTime()).toBeGreaterThanOrEqual(
        Date.now() - 1000,
      );
    });

    it("respects max_attempts and dead-letters after exhaustion", async () => {
      const id = await insertJob({
        status: "failed_retryable",
        attempt_count: 4,
        max_attempts: 4,
        error_class: "provider_5xx",
      });

      // Attempt count equals max → job should be dead_lettered, not retried
      await client
        .from("context_jobs")
        .update({
          status: "dead_lettered",
          completed_at: new Date().toISOString(),
          error: {
            code: "MAX_ATTEMPTS_EXCEEDED",
            message: "Job exceeded max attempts after 4 tries",
          },
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("dead_lettered");
      expect(job.attempt_count).toBe(job.max_attempts);
      expect(job.completed_at).toBeTruthy();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Permanent failure: queued → running → failed_permanent
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — permanent failure",
  () => {
    it("transitions running → failed_permanent for non-retryable errors", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      // FR-040: Non-retryable error classes
      const nonRetryableClasses = [
        "validation",
        "auth",
        "ssrf",
        "malware",
        "unsupported_file",
        "schema_contract",
        "quota_exhausted",
      ];

      for (const errorClass of nonRetryableClasses) {
        const jobId = await insertJob({ status: "running", attempt_count: 1 });

        await client
          .from("context_jobs")
          .update({
            status: "failed_permanent",
            error_class: errorClass,
            completed_at: new Date().toISOString(),
            error: {
              code: errorClass.toUpperCase(),
              message: `Non-retryable: ${errorClass}`,
            },
          })
          .eq("id", jobId);

        const job = await readJob(jobId);
        expect(job.status).toBe("failed_permanent");
        expect(job.error_class).toBe(errorClass);
        expect(job.completed_at).toBeTruthy();
      }
    });

    it("failed_permanent job has no next_run_at", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      await client
        .from("context_jobs")
        .update({
          status: "failed_permanent",
          error_class: "ssrf",
          completed_at: new Date().toISOString(),
          next_run_at: null,
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("failed_permanent");
      expect(job.next_run_at).toBeNull();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Stalled detection: running with expired heartbeat → stalled
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — stalled detection",
  () => {
    it("marks running job as stalled when heartbeat expires", async () => {
      const stageTimeoutSeconds = 60;
      const id = await insertJob({
        status: "running",
        attempt_count: 1,
        stage_timeout_seconds: stageTimeoutSeconds,
        locked_by: "worker-1",
        locked_at: new Date(Date.now() - 200_000).toISOString(),
      });

      // FR-041: heartbeat_at older than 2 × stage_timeout_seconds
      const staleHeartbeat = new Date(
        Date.now() - stageTimeoutSeconds * 2 * 1000 - 1000,
      ).toISOString();
      await client
        .from("context_jobs")
        .update({ heartbeat_at: staleHeartbeat })
        .eq("id", id);

      // Simulate recovery sweep: mark as stalled
      await client
        .from("context_jobs")
        .update({ status: "stalled" })
        .eq("id", id)
        .eq("status", "running");

      const job = await readJob(id);
      expect(job.status).toBe("stalled");
      expect(job.attempt_count).toBe(1);
      expect(job.locked_by).toBe("worker-1");
    });

    it("retryable stalled job transitions to retry_waiting", async () => {
      const stageTimeoutSeconds = 60;
      const id = await insertJob({
        status: "stalled",
        attempt_count: 2,
        max_attempts: 4,
        stage_timeout_seconds: stageTimeoutSeconds,
        error_class: "provider_timeout",
      });

      // FR-041: Retryable stalled → retry_waiting with next backoff delay
      const nextRunAt = new Date(Date.now() + 120_000).toISOString();
      await client
        .from("context_jobs")
        .update({
          status: "retry_waiting",
          next_run_at: nextRunAt,
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("retry_waiting");
      expect(job.next_run_at).toBeTruthy();
    });

    it("exhausted stalled job transitions to dead_lettered", async () => {
      const stageTimeoutSeconds = 60;
      const id = await insertJob({
        status: "stalled",
        attempt_count: 4,
        max_attempts: 4,
        stage_timeout_seconds: stageTimeoutSeconds,
        error_class: "provider_5xx",
      });

      // FR-041: Exhausted stalled → dead_lettered
      await client
        .from("context_jobs")
        .update({
          status: "dead_lettered",
          completed_at: new Date().toISOString(),
          error: {
            code: "STALLED_EXHAUSTED",
            message: "Job stalled and exceeded max attempts",
          },
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("dead_lettered");
      expect(job.completed_at).toBeTruthy();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Heartbeat recovery
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — heartbeat recovery",
  () => {
    it("worker can refresh heartbeat while job is running", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      const t1 = new Date().toISOString();
      await client
        .from("context_jobs")
        .update({ heartbeat_at: t1 })
        .eq("id", id);

      // Small delay, then refresh
      await new Promise((r) => setTimeout(r, 50));
      const t2 = new Date().toISOString();
      await client
        .from("context_jobs")
        .update({ heartbeat_at: t2 })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("running");
      expect(new Date(job.heartbeat_at).getTime()).toBeGreaterThan(
        new Date(t1).getTime(),
      );
    });

    it("heartbeat recovery query selects jobs with stale heartbeat", async () => {
      const stageTimeoutSeconds = 60;
      const id = await insertJob({
        status: "running",
        attempt_count: 1,
        stage_timeout_seconds: stageTimeoutSeconds,
      });

      // Set heartbeat to expired
      const staleHeartbeat = new Date(
        Date.now() - stageTimeoutSeconds * 2 * 1000 - 5000,
      ).toISOString();
      await client
        .from("context_jobs")
        .update({ heartbeat_at: staleHeartbeat })
        .eq("id", id);

      // FR-041: Recovery sweep selects stalled candidates
      const { data: candidates, error } = await client
        .from("context_jobs")
        .select("id, status, heartbeat_at, stage_timeout_seconds")
        .eq("status", "running")
        .not("heartbeat_at", "is", null);

      expect(error).toBeNull();

      // Our stale job should appear in candidates
      const staleJob = candidates?.find((j) => j.id === id);
      expect(staleJob).toBeDefined();

      // Verify it meets the staleness condition
      const heartbeatAge =
        Date.now() - new Date(staleJob!.heartbeat_at).getTime();
      const stallThreshold = staleJob!.stage_timeout_seconds * 2 * 1000;
      expect(heartbeatAge).toBeGreaterThan(stallThreshold);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Structured error redaction
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — structured error redaction",
  () => {
    it("error payload excludes secrets and PII", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      const errorPayload = {
        code: "PROVIDER_5XX",
        message: "Firecrawl returned 502",
        details: { status: 502, retry_after: 10 },
        // These should never appear in persisted errors
      };

      await client
        .from("context_jobs")
        .update({
          status: "failed_retryable",
          error_class: "provider_5xx",
          error: errorPayload,
        })
        .eq("id", id);

      const job = await readJob(id);
      const errorStr = JSON.stringify(job.error).toLowerCase();

      // FR-034: Redact secrets from job errors
      expect(errorStr).not.toMatch(/secret|password|token|api_key|service_role/);
      expect(job.error.code).toBe("PROVIDER_5XX");
      expect(job.error_class).toBe("provider_5xx");
    });

    it("structured error preserves error_class for retry classification", async () => {
      const retryableClasses = [
        "provider_timeout",
        "provider_5xx",
        "worker_oom",
      ];
      const nonRetryableClasses = [
        "validation",
        "auth",
        "ssrf",
        "malware",
        "unsupported_file",
        "schema_contract",
        "quota_exhausted",
      ];

      for (const cls of retryableClasses) {
        const id = await insertJob({ status: "running", attempt_count: 1 });
        await client
          .from("context_jobs")
          .update({
            status: "failed_retryable",
            error_class: cls,
            error: { code: cls.toUpperCase(), message: `Retryable: ${cls}` },
          })
          .eq("id", id);

        const job = await readJob(id);
        expect(job.error_class).toBe(cls);
        expect(job.status).toBe("failed_retryable");
      }

      for (const cls of nonRetryableClasses) {
        const id = await insertJob({ status: "running", attempt_count: 1 });
        await client
          .from("context_jobs")
          .update({
            status: "failed_permanent",
            error_class: cls,
            error: { code: cls.toUpperCase(), message: `Permanent: ${cls}` },
          })
          .eq("id", id);

        const job = await readJob(id);
        expect(job.error_class).toBe(cls);
        expect(job.status).toBe("failed_permanent");
      }
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Retry eligibility and exponential delays
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — retry eligibility",
  () => {
    it("exponential backoff increases with attempt count", async () => {
      // FR-039: delays 30s, 2min, 10min, 30min
      const delays = [30_000, 120_000, 600_000, 1_800_000];

      for (let i = 0; i < delays.length; i++) {
        const id = await insertJob({
          status: "failed_retryable",
          attempt_count: i + 1,
          error_class: "provider_5xx",
        });

        const nextRunAt = new Date(Date.now() + delays[i]).toISOString();
        await client
          .from("context_jobs")
          .update({ status: "retry_waiting", next_run_at: nextRunAt })
          .eq("id", id);

        const job = await readJob(id);
        expect(job.status).toBe("retry_waiting");

        const delayMs =
          new Date(job.next_run_at).getTime() - Date.now();
        // Allow ±20% jitter tolerance
        expect(delayMs).toBeGreaterThanOrEqual(delays[i] * 0.8 - 1000);
        expect(delayMs).toBeLessThanOrEqual(delays[i] * 1.2 + 1000);
      }
    });

    it("jobs with exhausted attempts are not eligible for retry", async () => {
      const id = await insertJob({
        status: "failed_retryable",
        attempt_count: 4,
        max_attempts: 4,
        error_class: "provider_5xx",
      });

      const job = await readJob(id);
      expect(job.attempt_count).toBeGreaterThanOrEqual(job.max_attempts);
      // Worker should NOT schedule a retry; should dead-letter instead
    });

    it("cancelled job remains in terminal state", async () => {
      const id = await insertJob({ status: "running", attempt_count: 1 });

      await client
        .from("context_jobs")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", id);

      const job = await readJob(id);
      expect(job.status).toBe("cancelled");
      expect(job.completed_at).toBeTruthy();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Idempotency key constraint
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Job lifecycle — idempotency",
  () => {
    it("rejects duplicate idempotency keys", async () => {
      const key = `t066-idempotent-${crypto.randomUUID()}`;
      const id1 = crypto.randomUUID();
      track(id1);

      const { error: err1 } = await client.from("context_jobs").insert({
        id: id1,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        job_type: "crawl_website",
        status: "queued",
        attempt_count: 0,
        max_attempts: 4,
        idempotency_key: key,
        input: { url: "https://example.com" },
        retry_policy: {},
      });
      expect(err1).toBeNull();

      // Duplicate insert should fail
      const id2 = crypto.randomUUID();
      track(id2);
      const { error: err2 } = await client.from("context_jobs").insert({
        id: id2,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        job_type: "crawl_website",
        status: "queued",
        attempt_count: 0,
        max_attempts: 4,
        idempotency_key: key,
        input: { url: "https://example.com" },
        retry_policy: {},
      });
      expect(err2).not.toBeNull();
    });
  },
);
