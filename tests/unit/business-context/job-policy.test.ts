import { describe, expect, it } from "vitest";
import {
  classifyError,
  isRetryableErrorClass,
  isNonRetryableErrorClass,
  calculateBackoffMs,
  isRetryEligible,
  nextRetryStatus,
  isJobStalled,
  heartbeatIntervalMs,
  stallThresholdMs,
} from "@/core/business-context/job-policy";
import type { RetryPolicy } from "@/core/business-context/types";

const basePolicy: Pick<RetryPolicy, "backoffBaseMs" | "backoffFactor" | "jitterPercent" | "backoffCapMs"> = {
  backoffBaseMs: 30_000,
  backoffFactor: 4,
  jitterPercent: 0.2,
  backoffCapMs: 30 * 60_000,
};

describe("classifyError", () => {
  it("classifies known retryable class", () => {
    expect(classifyError("provider_timeout")).toBe("retryable");
  });

  it("classifies known non-retryable class", () => {
    expect(classifyError("validation")).toBe("non_retryable");
  });

  it("classifies unknown class as unknown", () => {
    expect(classifyError("not_a_real_class")).toBe("unknown");
  });

  it("classifies null as unknown", () => {
    expect(classifyError(null)).toBe("unknown");
  });
});

describe("isRetryableErrorClass", () => {
  it("returns true for known retryable", () => {
    expect(isRetryableErrorClass("provider_5xx")).toBe(true);
  });
  it("returns true for null (unknown treated as retryable)", () => {
    expect(isRetryableErrorClass(null)).toBe(true);
  });
  it("returns false for known non-retryable", () => {
    expect(isRetryableErrorClass("validation")).toBe(false);
  });
});

describe("isNonRetryableErrorClass", () => {
  it("returns true for known permanent", () => {
    expect(isNonRetryableErrorClass("schema_contract")).toBe(true);
  });
  it("returns false for null", () => {
    expect(isNonRetryableErrorClass(null)).toBe(false);
  });
  it("returns false for retryable class", () => {
    expect(isNonRetryableErrorClass("provider_timeout")).toBe(false);
  });
});

describe("calculateBackoffMs", () => {
  it("first attempt stays within jitter band around base", () => {
    for (let i = 0; i < 50; i++) {
      const d = calculateBackoffMs(1, basePolicy);
      const base = basePolicy.backoffBaseMs;
      const jitter = base * basePolicy.jitterPercent;
      expect(d).toBeGreaterThanOrEqual(base - jitter - 1);
      expect(d).toBeLessThanOrEqual(base + jitter + 1);
    }
  });

  it("grows with attempt number", () => {
    const samples = 200;
    const avg = (n: number) => {
      let s = 0;
      for (let i = 0; i < samples; i++) s += calculateBackoffMs(n, basePolicy);
      return s / samples;
    };
    expect(avg(2)).toBeGreaterThan(avg(1));
    expect(avg(3)).toBeGreaterThan(avg(2));
  });

  it("caps at backoffCapMs for large attempts", () => {
    for (let i = 0; i < 20; i++) {
      expect(calculateBackoffMs(20, basePolicy)).toBeLessThanOrEqual(
        basePolicy.backoffCapMs + basePolicy.backoffCapMs * basePolicy.jitterPercent + 1
      );
    }
  });
});

describe("isRetryEligible", () => {
  it("returns true when retryable and attempts remain", () => {
    expect(
      isRetryEligible({ errorClass: "provider_timeout", attemptCount: 1, maxAttempts: 4 })
    ).toBe(true);
  });

  it("returns false when attempts exhausted", () => {
    expect(
      isRetryEligible({ errorClass: "provider_timeout", attemptCount: 4, maxAttempts: 4 })
    ).toBe(false);
  });

  it("returns false for known non-retryable", () => {
    expect(
      isRetryEligible({ errorClass: "validation", attemptCount: 1, maxAttempts: 4 })
    ).toBe(false);
  });
});

describe("nextRetryStatus", () => {
  it("returns failed_permanent for non-retryable", () => {
    expect(
      nextRetryStatus({ errorClass: "validation", attemptCount: 1, maxAttempts: 4 })
    ).toBe("failed_permanent");
  });

  it("returns failed_permanent when attempts exhausted", () => {
    expect(
      nextRetryStatus({ errorClass: "provider_timeout", attemptCount: 4, maxAttempts: 4 })
    ).toBe("failed_permanent");
  });

  it("returns retry_waiting for retryable with attempts left", () => {
    expect(
      nextRetryStatus({ errorClass: "provider_timeout", attemptCount: 1, maxAttempts: 4 })
    ).toBe("retry_waiting");
  });
});

describe("isJobStalled", () => {
  const now = new Date("2026-01-15T10:00:00Z");

  it("returns true when heartbeat is past stall threshold", () => {
    const heartbeatAt = new Date(now.getTime() - 200_000);
    expect(
      isJobStalled({ heartbeatAt, stageTimeoutSeconds: 60, now })
    ).toBe(true);
  });

  it("returns false when heartbeat is fresh", () => {
    const heartbeatAt = new Date(now.getTime() - 1000);
    expect(
      isJobStalled({ heartbeatAt, stageTimeoutSeconds: 60, now })
    ).toBe(false);
  });

  it("returns false when heartbeatAt is null", () => {
    expect(
      isJobStalled({ heartbeatAt: null, stageTimeoutSeconds: 60, now })
    ).toBe(false);
  });

  it("returns false when stageTimeoutSeconds is null", () => {
    const heartbeatAt = new Date(now.getTime() - 999_999_999);
    expect(
      isJobStalled({ heartbeatAt, stageTimeoutSeconds: null, now })
    ).toBe(false);
  });
});

describe("heartbeat helpers", () => {
  it("heartbeatIntervalMs returns 30s", () => {
    expect(heartbeatIntervalMs()).toBe(30_000);
  });

  it("stallThresholdMs is 2x stage timeout", () => {
    expect(stallThresholdMs(60)).toBe(120_000);
  });
});
