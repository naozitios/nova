import { describe, expect, it } from "vitest";
import {
  CircuitBreakerAdapter,
  DEFAULT_BREAKER_CONFIG,
  type BreakerSnapshot,
} from "@/infrastructure/business-context/circuit-breaker";

class FakeQuery {
  private filters: Array<[string, unknown]> = [];

  constructor(
    private db: FakeDb,
    private table: string,
    private patch: Record<string, unknown> | null = null,
    private preloaded: Record<string, unknown> | null = null,
  ) {}

  eq(col: string, val: unknown): this {
    this.filters.push([col, val]);
    return this;
  }

  is(col: string, val: unknown): this {
    this.filters.push([col, val]);
    return this;
  }

  select(): this {
    return this;
  }

  async single(): Promise<{ data: Record<string, unknown> | null; error: { code: string; message: string } | null }> {
    if (this.preloaded) return { data: this.preloaded, error: null };
    if (this.patch) {
      const r = this.db._findAndUpdate(this.table, this.filters, this.patch);
      if (!r) return { data: null, error: { code: "PGRST116", message: "not found" } };
      return { data: r, error: null };
    }
    const r = this.db._find(this.table, this.filters);
    if (!r) return { data: null, error: { code: "PGRST116", message: "not found" } };
    return { data: r, error: null };
  }

  async maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: null }> {
    if (this.preloaded) return { data: this.preloaded, error: null };
    const r = this.db._find(this.table, this.filters);
    return { data: r, error: null };
  }
}

class FakeDb {
  rows: Map<string, Record<string, unknown>> = new Map();

  from(table: string) {
    const db = this;
    return {
      select: () => new FakeQuery(db, table),
      upsert: (row: Record<string, unknown>) => {
        const key = `${table}:${row.id ?? row.provider ?? ""}`;
        db.rows.set(key, row);
        return new FakeQuery(db, table, null, row);
      },
      update: (patch: Record<string, unknown>) => new FakeQuery(db, table, patch),
    };
  }

  _find(table: string, filters: Array<[string, unknown]>): Record<string, unknown> | null {
    for (const [key, row] of this.rows.entries()) {
      if (!key.startsWith(`${table}:`)) continue;
      const normalized = this._normalize(row);
      if (filters.every(([c, v]) => (v === null ? normalized[c] == null : normalized[c] === v))) {
        return normalized;
      }
    }
    return null;
  }

  _findAndUpdate(
    table: string,
    filters: Array<[string, unknown]>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> | null {
    for (const [key, row] of this.rows.entries()) {
      if (!key.startsWith(`${table}:`)) continue;
      const normalized = this._normalize(row);
      if (filters.every(([c, v]) => (v === null ? normalized[c] == null : normalized[c] === v))) {
        const updated = { ...normalized, ...patch };
        this.rows.set(key, updated);
        return updated;
      }
    }
    return null;
  }

  _normalize(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const snake = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      out[snake] = v;
    }
    return out;
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
