import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T025 — Circuit breaker pure-function tests
// Self-contained: defines types and functions inline.
// Tests closed→open thresholds, quota exhaustion, half-open probe
// success, and half-open probe failure.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

type CircuitBreakerState = "closed" | "open" | "half_open";

interface CircuitBreakerConfig {
  failure_threshold: number;
  failure_window_ms: number;
  failure_rate_min: number; // 0-1, minimum failure rate to trip
  consecutive_timeout_threshold: number;
  half_open_after_ms: number;
}

interface CircuitBreaker {
  provider: string;
  state: CircuitBreakerState;
  failure_count: number;
  success_count: number;
  timeout_count: number;
  quota_exhausted: boolean;
  opened_at: number | null;
  half_open_after: number | null;
  last_failure_at: number | null;
  last_success_at: number | null;
  recent_failures: number[]; // timestamps of failures in window
  recent_timeouts: number[]; // timestamps of timeouts in window
}

// ── Default config (FR-042 / data-model.md) ───────────────────────────────

const DEFAULT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failure_threshold: 5,
  failure_window_ms: 10 * 60 * 1000, // 10 minutes
  failure_rate_min: 0.5, // 50%
  consecutive_timeout_threshold: 3,
  half_open_after_ms: 5 * 60 * 1000, // 5 minutes
};

// ── Functions under test ───────────────────────────────────────────────────

function createBreaker(provider: string): CircuitBreaker {
  return {
    provider,
    state: "closed",
    failure_count: 0,
    success_count: 0,
    timeout_count: 0,
    quota_exhausted: false,
    opened_at: null,
    half_open_after: null,
    last_failure_at: null,
    last_success_at: null,
    recent_failures: [],
    recent_timeouts: [],
  };
}

function shouldTrip(breaker: CircuitBreaker, config: CircuitBreakerConfig, now: number): boolean {
  if (breaker.quota_exhausted) return true;

  // Check failure threshold + rate in window
  const windowStart = now - config.failure_window_ms;
  const failuresInWindow = breaker.recent_failures.filter((ts) => ts > windowStart);
  const totalAttempts = failuresInWindow.length + breaker.success_count;

  if (failuresInWindow.length >= config.failure_threshold && totalAttempts > 0) {
    const failureRate = failuresInWindow.length / totalAttempts;
    if (failureRate >= config.failure_rate_min) return true;
  }

  // Check consecutive timeouts
  const timeoutsInWindow = breaker.recent_timeouts.filter((ts) => ts > windowStart);
  if (timeoutsInWindow.length >= config.consecutive_timeout_threshold) return true;

  return false;
}

function recordFailure(breaker: CircuitBreaker, now: number, isTimeout: boolean): CircuitBreaker {
  const updated = { ...breaker, failure_count: breaker.failure_count + 1, last_failure_at: now };
  updated.recent_failures = [...breaker.recent_failures, now];
  if (isTimeout) {
    updated.timeout_count = breaker.timeout_count + 1;
    updated.recent_timeouts = [...breaker.recent_timeouts, now];
  }
  return updated;
}

function recordSuccess(breaker: CircuitBreaker, now: number): CircuitBreaker {
  return {
    ...breaker,
    success_count: breaker.success_count + 1,
    last_success_at: now,
  };
}

function tripBreaker(breaker: CircuitBreaker, now: number): CircuitBreaker {
  return {
    ...breaker,
    state: "open",
    opened_at: now,
    half_open_after: now + DEFAULT_BREAKER_CONFIG.half_open_after_ms,
  };
}

function checkAndTrip(
  breaker: CircuitBreaker,
  config: CircuitBreakerConfig,
  now: number,
): CircuitBreaker {
  if (breaker.state !== "closed") return breaker;
  if (!shouldTrip(breaker, config, now)) return breaker;
  return tripBreaker(breaker, now);
}

function handleProbeResult(
  breaker: CircuitBreaker,
  success: boolean,
  now: number,
): CircuitBreaker {
  if (breaker.state !== "half_open") return breaker;
  if (success) {
    return {
      ...breaker,
      state: "closed",
      failure_count: 0,
      timeout_count: 0,
      recent_failures: [],
      recent_timeouts: [],
      half_open_after: null,
    };
  }
  return tripBreaker(breaker, now);
}

function checkHalfOpenTransition(
  breaker: CircuitBreaker,
  now: number,
): CircuitBreaker {
  if (breaker.state !== "open") return breaker;
  if (breaker.half_open_after !== null && now >= breaker.half_open_after) {
    return { ...breaker, state: "half_open" };
  }
  return breaker;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Circuit breaker — closed to open", () => {
  it("stays closed when failures are below threshold", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    for (let i = 0; i < 4; i++) {
      breaker = recordFailure(breaker, now + i * 1000, false);
    }
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now + 5000);
    expect(breaker.state).toBe("closed");
  });

  it("opens when failure count reaches threshold with sufficient failure rate", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    // 5 failures, 0 successes → 100% failure rate ≥ 50%
    for (let i = 0; i < 5; i++) {
      breaker = recordFailure(breaker, now + i * 1000, false);
    }
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now + 6000);
    expect(breaker.state).toBe("open");
    expect(breaker.opened_at).toBe(now + 6000);
  });

  it("stays closed when failures are in window but rate is below 50%", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    // 5 failures + 6 successes → 45% failure rate < 50%
    for (let i = 0; i < 5; i++) {
      breaker = recordFailure(breaker, now + i * 100, false);
    }
    for (let i = 0; i < 6; i++) {
      breaker = recordSuccess(breaker, now + 1000 + i * 100);
    }
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now + 2000);
    expect(breaker.state).toBe("closed");
  });

  it("opens on 3 consecutive timeouts regardless of failure rate", () => {
    const now = Date.now();
    let breaker = createBreaker("paddleocr");
    for (let i = 0; i < 3; i++) {
      breaker = recordFailure(breaker, now + i * 1000, true);
    }
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now + 4000);
    expect(breaker.state).toBe("open");
  });
});

describe("Circuit breaker — quota exhaustion", () => {
  it("opens immediately when quota_exhausted is set", () => {
    const now = Date.now();
    let breaker = createBreaker("meta");
    breaker.quota_exhausted = true;
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now);
    expect(breaker.state).toBe("open");
  });

  it("opens even with zero failures when quota is exhausted", () => {
    const now = Date.now();
    let breaker = createBreaker("meta");
    breaker.quota_exhausted = true;
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now);
    expect(breaker.failure_count).toBe(0);
    expect(breaker.state).toBe("open");
  });
});

describe("Circuit breaker — half-open probe success", () => {
  it("transitions from open to half_open when half_open_after has passed", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker = tripBreaker(breaker, now);
    expect(breaker.state).toBe("open");

    const laterNow = now + DEFAULT_BREAKER_CONFIG.half_open_after_ms + 1;
    breaker = checkHalfOpenTransition(breaker, laterNow);
    expect(breaker.state).toBe("half_open");
  });

  it("stays open when half_open_after has not yet passed", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker = tripBreaker(breaker, now);

    const laterNow = now + DEFAULT_BREAKER_CONFIG.half_open_after_ms - 1;
    breaker = checkHalfOpenTransition(breaker, laterNow);
    expect(breaker.state).toBe("open");
  });

  it("closes on successful probe in half_open state", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker = tripBreaker(breaker, now);
    breaker.state = "half_open";

    breaker = handleProbeResult(breaker, true, now + 1000);
    expect(breaker.state).toBe("closed");
    expect(breaker.failure_count).toBe(0);
    expect(breaker.timeout_count).toBe(0);
    expect(breaker.recent_failures).toHaveLength(0);
    expect(breaker.recent_timeouts).toHaveLength(0);
  });
});

describe("Circuit breaker — half-open probe failure", () => {
  it("reopens on failed probe in half_open state", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker = tripBreaker(breaker, now);
    breaker.state = "half_open";

    breaker = handleProbeResult(breaker, false, now + 1000);
    expect(breaker.state).toBe("open");
    expect(breaker.opened_at).toBe(now + 1000);
  });
});

describe("Circuit breaker — state invariants", () => {
  it("does not trip an already-open breaker", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker = tripBreaker(breaker, now);
    expect(breaker.state).toBe("open");

    // More failures shouldn't change state
    breaker = recordFailure(breaker, now + 1000, false);
    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now + 2000);
    expect(breaker.state).toBe("open");
  });

  it("does not affect half_open from checkAndTrip", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker.state = "half_open";

    breaker = checkAndTrip(breaker, DEFAULT_BREAKER_CONFIG, now);
    expect(breaker.state).toBe("half_open");
  });

  it("does not transition non-open breakers via checkHalfOpenTransition", () => {
    const now = Date.now();
    let breaker = createBreaker("firecrawl");
    breaker.state = "closed";

    breaker = checkHalfOpenTransition(breaker, now + 999999);
    expect(breaker.state).toBe("closed");
  });
});

describe("Default breaker config", () => {
  it("matches FR-042 requirements", () => {
    expect(DEFAULT_BREAKER_CONFIG.failure_threshold).toBe(5);
    expect(DEFAULT_BREAKER_CONFIG.failure_window_ms).toBe(10 * 60 * 1000);
    expect(DEFAULT_BREAKER_CONFIG.failure_rate_min).toBe(0.5);
    expect(DEFAULT_BREAKER_CONFIG.consecutive_timeout_threshold).toBe(3);
    expect(DEFAULT_BREAKER_CONFIG.half_open_after_ms).toBe(5 * 60 * 1000);
  });
});
