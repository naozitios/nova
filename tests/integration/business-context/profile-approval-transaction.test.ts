import { describe, expect, it, vi } from "vitest";
import { approveBusinessProfile } from "../../../src/core/business-context/versioning";
import type { BusinessProfileVersion } from "../../../src/core/business-context/types";
import { ProfileVersionStatus } from "../../../src/core/business-context/types";
import { createMockRepo } from "../../contract/business-context/_mock-repo";

// ---------------------------------------------------------------------------
// T051 — Integration test: atomic v1 approval
// Validates no duplicate current versions after approval and transaction
// rollback on failure per spec FR-026 and FR-027.
// Tests core functions with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "ws-1";
const BUSINESS_ID = "biz-1";
const USER_ID = "user-1";

function currentVersion(overrides: Partial<BusinessProfileVersion> = {}): BusinessProfileVersion {
  return {
    id: "pv-1",
    workspaceId: WORKSPACE_ID,
    businessId: BUSINESS_ID,
    version: 1,
    profile: { business: { name: "Existing" } },
    profileMarkdown: null,
    status: ProfileVersionStatus.CURRENT,
    changeSummary: null,
    createdBy: "user-1",
    createdAt: new Date(),
    approvedBy: "user-1",
    approvedAt: new Date(),
    ...overrides,
  };
}

describe("Atomic approval — no duplicate current versions", () => {
  it("creates exactly one current profile version after approval", async () => {
    const repo = createMockRepo();
    const result = await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      { business: { name: "Acme" } },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe(ProfileVersionStatus.CURRENT);
      expect(result.data.version).toBe(1);
    }

    expect(repo.createProfileVersion).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProfileVersionStatus.CURRENT }),
    );
  });

  it("returns BusinessProfileVersion schema on success", async () => {
    const repo = createMockRepo();
    const result = await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      { business: { name: "Acme" } },
      USER_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("businessId");
      expect(result.data).toHaveProperty("version");
      expect(result.data).toHaveProperty("profile");
      expect(result.data).toHaveProperty("status");
      expect(result.data).toHaveProperty("createdBy");
      expect(result.data).toHaveProperty("createdAt");
      expect(typeof result.data.version).toBe("number");
      expect(typeof result.data.profile).toBe("object");
    }
  });
});

describe("Atomic approval — transaction rollback on failure", () => {
  it("does not create partial profile version on approval failure", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: currentVersion(),
      }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Supersede failed" },
      }),
    });

    const result = await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      {},
      USER_ID,
    );

    expect(result.ok).toBe(false);
    // createProfileVersion should not be called if supersede failed
    expect(repo.createProfileVersion).not.toHaveBeenCalled();
  });

  it("preserves existing current version when approval fails", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: currentVersion(),
      }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Supersede failed" },
      }),
    });

    const result = await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      {},
      USER_ID,
    );

    expect(result.ok).toBe(false);
    expect(repo.createProfileVersion).not.toHaveBeenCalled();
  });

  it("returns structured error on approval failure", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: currentVersion(),
      }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "SUPERSEDE_FAILED", message: "Could not supersede" },
      }),
    });

    const result = await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      {},
      USER_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
      expect(typeof result.error.code).toBe("string");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("audit log records approval attempt", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(
      repo,
      BUSINESS_ID,
      WORKSPACE_ID,
      { business: { name: "Acme" } },
      USER_ID,
    );

    expect(repo.createAuditLog).toHaveBeenCalled();
  });
});
