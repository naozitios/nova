import { describe, expect, it } from "vitest";
import {
  CircuitBreakerAdapter,
  DEFAULT_BREAKER_CONFIG,
  type BreakerSnapshot,
} from "@/infrastructure/business-context/circuit-breaker";

class FakeDb {
  rows: Map<string, Record<string, unknown>> = new Map();

  from(table: string) {
    return {
      select: () => ({
        eq: (_col: string, val: string) => ({
          maybeSingle: async () => {
            const key = `${table}:${val}`;
            return { data: this.rows.get(key) ?? null, error: null };
          },
          single: async () => {
            const key = `${table}:${val}`;
            const row = this.rows.get(key);
            return { data: row ?? null, error: row ? null : { message: "not found" } };
          },
        }),
      }),
      upsert: (row: Record<string, unknown>) => {
        const key = `${table}:${row.id ?? row.provider ?? ""}`;
        this.rows.set(key, row);
        return { error: null };
      },
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, val: string) => {
          const key = `${table}:${val}`;
          const existing = this.rows.get(key);
          if (existing) this.rows.set(key, { ...existing, ...patch });
          return { error: null };
        },
      }),
    };
  }
}

function snapshot(provider: string, overrides: Partial<BreakerSnapshot> = {}): BreakerSnapshot {
  return {
    id: `cb-${provider}`,
    workspaceId: null,
    provider,
    state: "closed",
    failureCount: 0,
    successCount: 0,
    timeoutCount: 0,
    quotaExhausted: false,
    failureWindowStartedAt: new Date().toISOString(),
    openedAt: null,
    halfOpenAfter: null,
    lastFailureAt: null,
    lastSuccessAt: null,
    ...overrides,
  };
}

describe("CircuitBreakerAdapter", () => {
  it("creates a closed breaker on first read", async () => {
    const db = new FakeDb();
    const adapter = new CircuitBreakerAdapter(db as unknown as never, DEFAULT_BREAKER_CONFIG);
    const state = await adapter.getState(null, "firecrawl");
    expect(state.state).toBe("closed");
    expect(state.failureCount).toBe(0);
  });

  it("trips to open after consecutive timeouts exceed threshold", async () => {
    const db = new FakeDb();
    db.rows.set("context_provider_circuit_breakers:firecrawl", snapshot("firecrawl"));
    const adapter = new CircuitBreakerAdapter(db as unknown as never, DEFAULT_BREAKER_CONFIG);
    for (let i = 0; i < DEFAULT_BREAKER_CONFIG.consecutiveTimeoutThreshold; i++) {
      await adapter.recordFailure(null, "firecrawl", { isTimeout: true });
    }
    const state = await adapter.getState(null, "firecrawl");
    expect(state.state).toBe("open");
  });

  it("trips to open on quota exhausted regardless of counts", async () => {
    const db = new FakeDb();
    db.rows.set("context_provider_circuit_breakers:firecrawl", snapshot("firecrawl"));
    const adapter = new CircuitBreakerAdapter(db as unknown as never, DEFAULT_BREAKER_CONFIG);
    await adapter.markQuotaExhausted(null, "firecrawl");
    const state = await adapter.getState(null, "firecrawl");
    expect(state.state).toBe("open");
  });

  it("moves to half_open when half_open_after has passed", async () => {
    const past = new Date(Date.now() - DEFAULT_BREAKER_CONFIG.halfOpenAfterMs - 1000).toISOString();
    const db = new FakeDb();
    db.rows.set(
      "context_provider_circuit_breakers:firecrawl",
      snapshot("firecrawl", { state: "open", openedAt: past, halfOpenAfter: past })
    );
    const adapter = new CircuitBreakerAdapter(db as unknown as never, DEFAULT_BREAKER_CONFIG);
    const state = await adapter.getState(null, "firecrawl");
    expect(state.state).toBe("half_open");
  });

  it("closes breaker on successful probe in half_open", async () => {
    const db = new FakeDb();
    db.rows.set(
      "context_provider_circuit_breakers:firecrawl",
      snapshot("firecrawl", { state: "half_open" })
    );
    const adapter = new CircuitBreakerAdapter(db as unknown as never, DEFAULT_BREAKER_CONFIG);
    await adapter.recordSuccess(null, "firecrawl");
    const state = await adapter.getState(null, "firecrawl");
    expect(state.state).toBe("closed");
  });
});
