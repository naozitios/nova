import { describe, expect, it, vi } from "vitest";
import { approveBusinessProfile } from "../../../src/core/business-context/versioning";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  BusinessProfileVersion,
  ServiceResult,
  JsonValue,
} from "../../../src/core/business-context/types";
import { ProfileVersionStatus } from "../../../src/core/business-context/types";

// ─── Mock repository factory ──────────────────────────────────────────────────

function createMockRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  return {
    createBusiness: vi.fn(),
    getBusiness: vi.fn(),
    listBusinesses: vi.fn(),
    updateBusiness: vi.fn(),
    createOnboardingSession: vi.fn(),
    getOnboardingSession: vi.fn(),
    listOnboardingSessions: vi.fn(),
    updateOnboardingSession: vi.fn(),
    createContextSource: vi.fn(),
    getContextSource: vi.fn(),
    listContextSources: vi.fn(),
    updateContextSource: vi.fn(),
    createSourceDocument: vi.fn(),
    getSourceDocument: vi.fn(),
    listSourceDocuments: vi.fn(),
    getSourceDocumentByHash: vi.fn(),
    updateSourceDocument: vi.fn(),
    createContextFact: vi.fn(),
    getContextFact: vi.fn(),
    listContextFacts: vi.fn(),
    updateContextFact: vi.fn(),
    createContextConflict: vi.fn(),
    getContextConflict: vi.fn(),
    listContextConflicts: vi.fn(),
    resolveContextConflict: vi.fn(),
    createOnboardingQuestion: vi.fn(),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn(),
    answerOnboardingQuestion: vi.fn(),
    createProfileVersion: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "pv-1",
        workspaceId: "ws-1",
        businessId: "biz-1",
        version: 1,
        profile: {},
        profileMarkdown: null,
        status: ProfileVersionStatus.CURRENT,
        changeSummary: "Initial approved profile",
        createdBy: "user-1",
        createdAt: new Date(),
        approvedBy: "user-1",
        approvedAt: new Date(),
      },
    } as ServiceResult<BusinessProfileVersion>),
    getProfileVersion: vi.fn(),
    listProfileVersions: vi.fn(),
    getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    approveProfileVersion: vi.fn(),
    restoreProfileVersion: vi.fn(),
    createContextJob: vi.fn(),
    getContextJob: vi.fn(),
    getContextJobByIdempotencyKey: vi.fn(),
    listContextJobs: vi.fn(),
    claimRunnableJobs: vi.fn(),
    updateContextJob: vi.fn(),
    createProcessingRun: vi.fn(),
    getProcessingRun: vi.fn(),
    listProcessingRuns: vi.fn(),
    updateProcessingRun: vi.fn(),
    createStageEvent: vi.fn(),
    listStageEvents: vi.fn(),
    createQualityGateResult: vi.fn(),
    listQualityGateResults: vi.fn(),
    getCircuitBreaker: vi.fn(),
    upsertCircuitBreaker: vi.fn(),
    createAuditLog: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    listAuditLogs: vi.fn(),
    ...overrides,
  } as RepositoryPort;
}

// ─── approveBusinessProfile ───────────────────────────────────────────────────

describe("versioning.approveBusinessProfile", () => {
  it("creates first version when no current version exists", async () => {
    const repo = createMockRepo();
    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    };

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", profile, "user-1");

    expect(result.ok).toBe(true);
    expect(repo.getCurrentProfileVersion).toHaveBeenCalledOnce();
    expect(repo.supersedeProfileVersions).not.toHaveBeenCalled();
    expect(repo.createProfileVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        status: ProfileVersionStatus.CURRENT,
      }),
    );
    expect(repo.createAuditLog).toHaveBeenCalledOnce();
  });

  it("supersedes existing version and creates next version", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-old",
      workspaceId: "ws-1",
      businessId: "biz-1",
      version: 1,
      profile: { business: { name: "Old" } },
      profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT,
      changeSummary: null,
      createdBy: "user-1",
      createdAt: new Date(),
      approvedBy: "user-1",
      approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: currentVersion,
      }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "pv-new",
          version: 2,
          status: ProfileVersionStatus.CURRENT,
          profile: {},
          createdBy: "user-1",
          createdAt: new Date(),
        },
      }),
    });

    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
    };

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", profile, "user-1");

    expect(result.ok).toBe(true);
    expect(repo.supersedeProfileVersions).toHaveBeenCalledOnce();
    expect(repo.createProfileVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
      }),
    );
  });

  it("emits audit log with before/after state", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "profile.approved",
        entityType: "business_profile_version",
        before: null,
        after: expect.objectContaining({ version: 1, status: ProfileVersionStatus.CURRENT }),
      }),
    );
  });

  it("returns error when supersede fails", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-old",
      workspaceId: "ws-1",
      businessId: "biz-1",
      version: 1,
      profile: {},
      profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT,
      changeSummary: null,
      createdBy: "user-1",
      createdAt: new Date(),
      approvedBy: null,
      approvedAt: null,
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: currentVersion,
      }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Supersede failed" },
      }),
    });

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB_ERROR");
    }
  });

  it("returns error when create version fails", async () => {
    const repo = createMockRepo({
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "CONSTRAINT", message: "Version already exists" },
      }),
    });

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(result.ok).toBe(false);
  });

  it("audit log records null before state for first version", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        before: null,
      }),
    );
  });
});
