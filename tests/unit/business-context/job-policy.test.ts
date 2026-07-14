import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T022 — Job policy pure-function tests
// Self-contained: defines types and functions inline.
// Tests classify retryable vs permanent errors, backoff math, max attempts,
// stuck heartbeat transitions, and dead-letter transitions.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

type JobStatus =
  | "queued"
  | "scheduled"
  | "running"
  | "retry_waiting"
  | "succeeded"
  | "failed_retryable"
  | "failed_permanent"
  | "stalled"
  | "dead_lettered"
  | "cancelled";

type ErrorClass =
  | "validation"
  | "auth"
  | "ssrf"
  | "malware"
  | "unsupported_file"
  | "provider_timeout"
  | "provider_5xx"
  | "quota_exhausted"
  | "schema_contract"
  | "worker_oom"
  | "unknown";

interface JobRecord {
  id: string;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  error_class: ErrorClass | null;
  heartbeat_at: string | null;
  stage_timeout_seconds: number | null;
}

// ── Functions under test (expected signatures) ─────────────────────────────

const RETRYABLE_ERROR_CLASSES: ErrorClass[] = [
  "provider_timeout",
  "provider_5xx",
  "worker_oom",
];

const PERMANENT_ERROR_CLASSES: ErrorClass[] = [
  "validation",
  "auth",
  "ssrf",
  "malware",
  "unsupported_file",
  "quota_exhausted",
  "schema_contract",
];

const DEFAULT_DELAYS_MS = [30_000, 120_000, 600_000, 1_800_000];
const MAX_ATTEMPTS_DEFAULT = 4;
const JITTER_RATIO = 0.2;

function isRetryableError(errorClass: ErrorClass | null): boolean {
  if (errorClass === null) return false;
  return RETRYABLE_ERROR_CLASSES.includes(errorClass);
}

function isPermanentError(errorClass: ErrorClass | null): boolean {
  if (errorClass === null) return false;
  return PERMANENT_ERROR_CLASSES.includes(errorClass);
}

function computeBackoffDelayMs(attemptIndex: number): number {
  const baseDelay = DEFAULT_DELAYS_MS[Math.min(attemptIndex, DEFAULT_DELAYS_MS.length - 1)];
  const jitter = baseDelay * JITTER_RATIO;
  return baseDelay + (Math.random() * 2 - 1) * jitter;
}

function classifyJobAfterError(
  job: JobRecord,
): { next_status: JobStatus; next_run_at: string | null } {
  if (!isRetryableError(job.error_class)) {
    return { next_status: "failed_permanent", next_run_at: null };
  }
  if (job.attempt_count >= job.max_attempts) {
    return { next_status: "dead_lettered", next_run_at: null };
  }
  const delayMs = computeBackoffDelayMs(job.attempt_count);
  const nextRunAt = new Date(Date.now() + delayMs).toISOString();
  return { next_status: "retry_waiting", next_run_at: nextRunAt };
}

function checkStalledJob(job: JobRecord, now: Date): JobStatus {
  if (job.status !== "running") return job.status;
  if (!job.heartbeat_at || !job.stage_timeout_seconds) return job.status;

  const heartbeatAgeMs = now.getTime() - new Date(job.heartbeat_at).getTime();
  const stallThresholdMs = 2 * job.stage_timeout_seconds * 1000;

  if (heartbeatAgeMs <= stallThresholdMs) return job.status;

  // Stalled — recoverable if retries remain
  if (job.attempt_count < job.max_attempts) {
    return "retry_waiting";
  }
  return "dead_lettered";
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("isRetryableError", () => {
  it("returns true for provider_timeout", () => {
    expect(isRetryableError("provider_timeout")).toBe(true);
  });

  it("returns true for provider_5xx", () => {
    expect(isRetryableError("provider_5xx")).toBe(true);
  });

  it("returns true for worker_oom", () => {
    expect(isRetryableError("worker_oom")).toBe(true);
  });

  it("returns false for validation", () => {
    expect(isRetryableError("validation")).toBe(false);
  });

  it("returns false for auth", () => {
    expect(isRetryableError("auth")).toBe(false);
  });

  it("returns false for ssrf", () => {
    expect(isRetryableError("ssrf")).toBe(false);
  });

  it("returns false for malware", () => {
    expect(isRetryableError("malware")).toBe(false);
  });

  it("returns false for unsupported_file", () => {
    expect(isRetryableError("unsupported_file")).toBe(false);
  });

  it("returns false for quota_exhausted", () => {
    expect(isRetryableError("quota_exhausted")).toBe(false);
  });

  it("returns false for schema_contract", () => {
    expect(isRetryableError("schema_contract")).toBe(false);
  });

  it("returns false for unknown", () => {
    expect(isRetryableError("unknown")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isRetryableError(null)).toBe(false);
  });
});

describe("isPermanentError", () => {
  it("returns true for all permanent error classes", () => {
    for (const cls of PERMANENT_ERROR_CLASSES) {
      expect(isPermanentError(cls)).toBe(true);
    }
  });

  it("returns false for retryable error classes", () => {
    for (const cls of RETRYABLE_ERROR_CLASSES) {
      expect(isPermanentError(cls)).toBe(false);
    }
  });

  it("returns false for unknown and null", () => {
    expect(isPermanentError("unknown")).toBe(false);
    expect(isPermanentError(null)).toBe(false);
  });
});

describe("computeBackoffDelayMs", () => {
  it("returns a value within jitter bounds for attempt 0", () => {
    const delay = computeBackoffDelayMs(0);
    const base = DEFAULT_DELAYS_MS[0];
    const jitter = base * JITTER_RATIO;
    expect(delay).toBeGreaterThanOrEqual(base - jitter);
    expect(delay).toBeLessThanOrEqual(base + jitter);
  });

  it("returns a value within jitter bounds for attempt 1", () => {
    const delay = computeBackoffDelayMs(1);
    const base = DEFAULT_DELAYS_MS[1];
    const jitter = base * JITTER_RATIO;
    expect(delay).toBeGreaterThanOrEqual(base - jitter);
    expect(delay).toBeLessThanOrEqual(base + jitter);
  });

  it("returns a value within jitter bounds for attempt 2", () => {
    const delay = computeBackoffDelayMs(2);
    const base = DEFAULT_DELAYS_MS[2];
    const jitter = base * JITTER_RATIO;
    expect(delay).toBeGreaterThanOrEqual(base - jitter);
    expect(delay).toBeLessThanOrEqual(base + jitter);
  });

  it("caps at last delay for attempts beyond array length", () => {
    const delay = computeBackoffDelayMs(10);
    const base = DEFAULT_DELAYS_MS[DEFAULT_DELAYS_MS.length - 1];
    const jitter = base * JITTER_RATIO;
    expect(delay).toBeGreaterThanOrEqual(base - jitter);
    expect(delay).toBeLessThanOrEqual(base + jitter);
  });

  it("delays are monotonically non-decreasing on average", () => {
    const samples = 200;
    const avg0 = averageDelay(0, samples);
    const avg1 = averageDelay(1, samples);
    const avg2 = averageDelay(2, samples);
    expect(avg1).toBeGreaterThan(avg0);
    expect(avg2).toBeGreaterThan(avg1);
  });
});

function averageDelay(attempt: number, samples: number): number {
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    sum += computeBackoffDelayMs(attempt);
  }
  return sum / samples;
}

describe("classifyJobAfterError", () => {
  it("returns failed_permanent for permanent errors", () => {
    const job: JobRecord = {
      id: "j1",
      status: "running",
      attempt_count: 1,
      max_attempts: 4,
      error_class: "validation",
      heartbeat_at: null,
      stage_timeout_seconds: null,
    };
    const result = classifyJobAfterError(job);
    expect(result.next_status).toBe("failed_permanent");
    expect(result.next_run_at).toBeNull();
  });

  it("returns dead_lettered when max attempts exhausted", () => {
    const job: JobRecord = {
      id: "j2",
      status: "running",
      attempt_count: 4,
      max_attempts: 4,
      error_class: "provider_5xx",
      heartbeat_at: null,
      stage_timeout_seconds: null,
    };
    const result = classifyJobAfterError(job);
    expect(result.next_status).toBe("dead_lettered");
    expect(result.next_run_at).toBeNull();
  });

  it("returns retry_waiting with future next_run_at when retries remain", () => {
    const now = new Date();
    const job: JobRecord = {
      id: "j3",
      status: "running",
      attempt_count: 1,
      max_attempts: 4,
      error_class: "provider_timeout",
      heartbeat_at: null,
      stage_timeout_seconds: null,
    };
    const result = classifyJobAfterError(job);
    expect(result.next_status).toBe("retry_waiting");
    expect(result.next_run_at).not.toBeNull();
    expect(new Date(result.next_run_at!).getTime()).toBeGreaterThan(now.getTime());
  });
});

describe("checkStalledJob", () => {
  it("marks running job as retry_waiting when heartbeat expired and retries remain", () => {
    const now = new Date("2026-01-15T10:10:00Z");
    const job: JobRecord = {
      id: "j4",
      status: "running",
      attempt_count: 1,
      max_attempts: 4,
      error_class: null,
      heartbeat_at: "2026-01-15T10:00:00Z",
      stage_timeout_seconds: 60, // 60s timeout → stall after 120s
    };
    // heartbeat age = 600s > 120s threshold
    expect(checkStalledJob(job, now)).toBe("retry_waiting");
  });

  it("marks running job as dead_lettered when heartbeat expired and no retries remain", () => {
    const now = new Date("2026-01-15T10:10:00Z");
    const job: JobRecord = {
      id: "j5",
      status: "running",
      attempt_count: 4,
      max_attempts: 4,
      error_class: null,
      heartbeat_at: "2026-01-15T10:00:00Z",
      stage_timeout_seconds: 60,
    };
    expect(checkStalledJob(job, now)).toBe("dead_lettered");
  });

  it("does not stall a job with a recent heartbeat", () => {
    const now = new Date("2026-01-15T10:02:00Z");
    const job: JobRecord = {
      id: "j6",
      status: "running",
      attempt_count: 1,
      max_attempts: 4,
      error_class: null,
      heartbeat_at: "2026-01-15T10:01:00Z",
      stage_timeout_seconds: 60, // threshold = 120s, age = 60s
    };
    expect(checkStalledJob(job, now)).toBe("running");
  });

  it("does not modify non-running jobs", () => {
    const now = new Date("2026-01-15T10:10:00Z");
    const job: JobRecord = {
      id: "j7",
      status: "queued",
      attempt_count: 0,
      max_attempts: 4,
      error_class: null,
      heartbeat_at: "2026-01-15T09:00:00Z",
      stage_timeout_seconds: 60,
    };
    expect(checkStalledJob(job, now)).toBe("queued");
  });

  it("does not stall when heartbeat_at is null", () => {
    const now = new Date("2026-01-15T10:10:00Z");
    const job: JobRecord = {
      id: "j8",
      status: "running",
      attempt_count: 1,
      max_attempts: 4,
      error_class: null,
      heartbeat_at: null,
      stage_timeout_seconds: 60,
    };
    expect(checkStalledJob(job, now)).toBe("running");
  });
});

describe("Default backoff schedule", () => {
  it("has exactly 4 delays matching FR-039", () => {
    expect(DEFAULT_DELAYS_MS).toHaveLength(4);
    expect(DEFAULT_DELAYS_MS[0]).toBe(30_000);
    expect(DEFAULT_DELAYS_MS[1]).toBe(120_000);
    expect(DEFAULT_DELAYS_MS[2]).toBe(600_000);
    expect(DEFAULT_DELAYS_MS[3]).toBe(1_800_000);
  });

  it("default max_attempts is 4", () => {
    expect(MAX_ATTEMPTS_DEFAULT).toBe(4);
  });

  it("jitter ratio is ±20%", () => {
    expect(JITTER_RATIO).toBe(0.2);
  });
});
