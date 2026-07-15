import { describe, expect, it, vi } from "vitest";
import {
  createSession,
  getSession,
} from "../../../src/core/business-context/service/onboarding.service";
import { createMockRepo } from "./_mock-repo";

// ---------------------------------------------------------------------------
// T049 — Contract test: onboarding session create/get
// Tests createSession and getSession with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const BUSINESS_ID = "biz-1";
const WORKSPACE_ID = "ws-1";
const USER_ID = "user-1";

describe("createSession — contract", () => {
  it("creates session with status 'created' and required fields", async () => {
    const repo = createMockRepo();
    const result = await createSession(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data.status).toBe("created");
      expect(result.data.businessId).toBe(BUSINESS_ID);
      expect(result.data).toHaveProperty("workspaceId");
      expect(result.data).toHaveProperty("startedBy");
      expect(result.data).toHaveProperty("startedAt");
    }
  });

  it("returns error when business not found", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({
        ok: true,
        data: null,
      }),
    });

    const result = await createSession(repo, "nonexistent", WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns error on repository failure", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Connection failed" },
      }),
    });

    const result = await createSession(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
  });
});

describe("getSession — contract", () => {
  it("returns current onboarding session", async () => {
    const repo = createMockRepo();
    const result = await getSession(repo, BUSINESS_ID, WORKSPACE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("status");
      expect(result.data?.businessId).toBe(BUSINESS_ID);
      expect(result.data).toHaveProperty("workspaceId");
    }
  });

  it("returns null when no session exists", async () => {
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    const result = await getSession(repo, BUSINESS_ID, WORKSPACE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it("returns error on repository failure", async () => {
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Connection failed" },
      }),
    });

    const result = await getSession(repo, BUSINESS_ID, WORKSPACE_ID);

    expect(result.ok).toBe(false);
  });
});
