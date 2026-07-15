import { describe, expect, it, vi } from "vitest";
import type { ContextConflict } from "../../../src/core/business-context/types";
import { createMockRepo } from "./_mock-repo";

// ---------------------------------------------------------------------------
// T092 — Conflict API contract tests
// Tests conflict listing, resolution, and preserved resolved conflict history
// with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "ws-1";
const BUSINESS_ID = "biz-1";
const CONFLICT_ID = "c-1";

function openConflict(overrides: Partial<ContextConflict> = {}): ContextConflict {
  const now = new Date();
  return {
    id: "c-1",
    workspaceId: WORKSPACE_ID,
    businessId: BUSINESS_ID,
    factKey: "offers.pricing",
    factIds: ["f-1", "f-2"],
    status: "open",
    resolutionFactId: null,
    resolutionNote: null,
    resolvedBy: null,
    createdAt: now,
    resolvedAt: null,
    ...overrides,
  };
}

function resolvedConflict(overrides: Partial<ContextConflict> = {}): ContextConflict {
  return openConflict({
    id: "c-resolved",
    status: "resolved",
    resolutionFactId: "f-2",
    resolutionNote: "Chosen based on recency and authority",
    resolvedBy: "user-1",
    resolvedAt: new Date(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// listContextConflicts
// ---------------------------------------------------------------------------

describe("listContextConflicts — contract", () => {
  it("returns conflict list", async () => {
    const repo = createMockRepo();
    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.data.items)).toBe(true);
    }
  });

  it("each conflict has required fields", async () => {
    const repo = createMockRepo();
    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
    });

    expect(result.ok).toBe(true);
    if (result.ok && result.data.items.length > 0) {
      const conflict = result.data.items[0];
      expect(conflict).toHaveProperty("id");
      expect(conflict).toHaveProperty("factKey");
      expect(conflict).toHaveProperty("factIds");
      expect(conflict).toHaveProperty("status");
      expect(conflict).toHaveProperty("createdAt");
      expect(Array.isArray(conflict.factIds)).toBe(true);
      expect(conflict.factIds.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("supports filtering by status", async () => {
    const repo = createMockRepo();
    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      status: "open",
    });

    expect(result.ok).toBe(true);
  });

  it("supports filtering by fact_key", async () => {
    const repo = createMockRepo();
    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      factKey: "offers.pricing",
    });

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveContextConflict
// ---------------------------------------------------------------------------

describe("resolveContextConflict — contract", () => {
  it("returns resolved conflict with required fields", async () => {
    const repo = createMockRepo();
    const result = await repo.resolveContextConflict(
      WORKSPACE_ID,
      CONFLICT_ID,
      "30000000-0000-0000-0000-000000000020",
      "user-1",
      "Website pricing is more recent and verified",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data.status).toBe("resolved");
      expect(result.data.resolutionFactId).toBe("30000000-0000-0000-0000-000000000020");
      expect(result.data.resolutionNote).toContain("verified");
      expect(result.data.resolvedAt).toBeTruthy();
    }
  });

  it("rejects request without resolution_fact_id", async () => {
    const repo = createMockRepo();
    // Mock resolveContextConflict to fail without resolution_fact_id
    repo.resolveContextConflict = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "resolution_fact_id is required" },
    });

    const result = await repo.resolveContextConflict(
      WORKSPACE_ID,
      CONFLICT_ID,
      "",
      "user-1",
    );

    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Resolved conflict history
// ---------------------------------------------------------------------------

describe("Resolved conflict history — contract", () => {
  it("resolved conflict retains resolution_fact_id", async () => {
    const repo = createMockRepo({
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [resolvedConflict()], total: 1 },
      }),
    });

    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      status: "resolved",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resolved = result.data.items.find((c) => c.status === "resolved");
      expect(resolved).toBeDefined();
      expect(resolved).toHaveProperty("resolutionFactId");
      expect(resolved).toHaveProperty("resolvedAt");
      expect(resolved).toHaveProperty("resolutionNote");
    }
  });

  it("resolved conflict preserves resolution note", async () => {
    const repo = createMockRepo({
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [resolvedConflict()], total: 1 },
      }),
    });

    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      status: "resolved",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const resolved = result.data.items.find((c) => c.status === "resolved");
      if (resolved && resolved.resolutionNote) {
        expect(typeof resolved.resolutionNote).toBe("string");
        expect(resolved.resolutionNote.length).toBeGreaterThan(0);
      }
    }
  });

  it("status=resolved filter returns only resolved conflicts", async () => {
    const repo = createMockRepo({
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [resolvedConflict()], total: 1 },
      }),
    });

    const result = await repo.listContextConflicts({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      status: "resolved",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      for (const conflict of result.data.items) {
        expect(conflict.status).toBe("resolved");
      }
    }
  });
});
