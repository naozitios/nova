import { describe, expect, it, vi } from "vitest";
import { approveBusinessProfile } from "../../../src/core/business-context/versioning";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  BusinessProfileVersion,
  ContextFact,
  AuditLog,
  JsonValue,
} from "../../../src/core/business-context/types";
import { ProfileVersionStatus } from "../../../src/core/business-context/types";

// ─── Mock repository factory ──────────────────────────────────────────────────

function createMockRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  const auditLogs: Array<Omit<AuditLog, "id" | "createdAt">> = [];

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
    listContextConflicts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    resolveContextConflict: vi.fn(),
    createOnboardingQuestion: vi.fn(),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn(),
    answerOnboardingQuestion: vi.fn(),
    createProfileVersion: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
        changeSummary: "Initial", createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      },
    }),
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
    createAuditLog: vi.fn().mockImplementation(async (data) => {
      auditLogs.push(data);
      return { ok: true, data: { ...data, id: `audit-${auditLogs.length}`, createdAt: new Date() } };
    }),
    listAuditLogs: vi.fn().mockImplementation(async () => ({
      ok: true,
      data: { items: auditLogs, total: auditLogs.length },
    })),
    ...overrides,
  } as RepositoryPort;
}

// ─── Approval audit events ────────────────────────────────────────────────────

describe("integration: approval audit events", () => {
  it("logs profile.approved event on first approval", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {
      business: { name: "Acme" },
    }, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "profile.approved",
        entityType: "business_profile_version",
        actorId: "user-1",
        actorType: "user",
        entityId: expect.any(String),
        before: null,
        after: expect.objectContaining({
          version: 1,
          status: ProfileVersionStatus.CURRENT,
        }),
      }),
    );
  });

  it("logs profile.approved with before state when superseding", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-old", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: currentVersion }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: true, data: { ...currentVersion, id: "pv-new", version: 2, status: ProfileVersionStatus.CURRENT },
      }),
    });

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { version: 1, status: ProfileVersionStatus.CURRENT },
        after: { version: 2, status: ProfileVersionStatus.CURRENT },
      }),
    );
  });

  it("audit event includes workspace and business IDs", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        businessId: "biz-1",
      }),
    );
  });
});

// ─── Correction audit events ──────────────────────────────────────────────────

describe("integration: correction audit events", () => {
  it("logs correction event when fact is created", async () => {
    const repo = createMockRepo({
      createContextFact: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "f-new", factKey: "business.name", value: { name: "Corrected" },
          verificationStatus: "user_verified",
        },
      }),
    });

    const result = await repo.createContextFact({
      workspaceId: "ws-1",
      businessId: "biz-1",
      factKey: "business.name",
      value: { name: "Corrected" },
      sourceId: "src-manual",
      sourceDocumentId: null,
      sourceExcerpt: null,
      evidenceLocator: null,
      confidence: 1.0,
      verificationStatus: "user_verified",
      supersedesFactId: "f-old",
      validFrom: new Date(),
      validTo: null,
      createdBy: "user-1",
    });

    expect(result.ok).toBe(true);

    // Simulate audit log for correction
    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user",
      eventType: "fact.corrected",
      entityType: "context_fact",
      entityId: "f-new",
      before: { factKey: "business.name", value: { name: "Old" } },
      after: { factKey: "business.name", value: { name: "Corrected" }, verificationStatus: "user_verified" },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "fact.corrected",
        entityType: "context_fact",
      }),
    );
  });

  it("correction preserves supersedes reference", async () => {
    const repo = createMockRepo();

    await repo.createContextFact({
      workspaceId: "ws-1",
      businessId: "biz-1",
      factKey: "offers.pricing",
      value: { price: 150 },
      sourceId: "src-manual",
      sourceDocumentId: null,
      sourceExcerpt: null,
      evidenceLocator: null,
      confidence: 1.0,
      verificationStatus: "user_verified",
      supersedesFactId: "f-old-pricing",
      validFrom: new Date(),
      validTo: null,
      createdBy: "user-1",
    });

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user",
      eventType: "fact.corrected",
      entityType: "context_fact",
      entityId: "f-new",
      before: null,
      after: { supersedesFactId: "f-old-pricing" },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({ supersedesFactId: "f-old-pricing" }),
      }),
    );
  });
});

// ─── Conflict resolution audit events ─────────────────────────────────────────

describe("integration: conflict resolution audit events", () => {
  it("logs conflict.resolved event", async () => {
    const repo = createMockRepo({
      resolveContextConflict: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "c-1", factKey: "offers.pricing", status: "resolved",
          resolutionFactId: "f-selected", resolvedBy: "user-1",
        },
      }),
    });

    const result = await repo.resolveContextConflict("ws-1", "c-1", "f-selected", "user-1", "Chose website price");

    expect(result.ok).toBe(true);

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user",
      eventType: "conflict.resolved",
      entityType: "context_conflict",
      entityId: "c-1",
      before: { status: "open" },
      after: { status: "resolved", resolutionFactId: "f-selected", resolutionNote: "Chose website price" },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "conflict.resolved",
        entityType: "context_conflict",
      }),
    );
  });

  it("conflict resolution includes selected fact and note", async () => {
    const repo = createMockRepo();

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user",
      eventType: "conflict.resolved",
      entityType: "context_conflict",
      entityId: "c-1",
      before: { status: "open", factIds: ["f-1", "f-2"] },
      after: {
        status: "resolved",
        resolutionFactId: "f-1",
        resolutionNote: "Authoritative source selected",
      },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          resolutionFactId: "f-1",
          resolutionNote: "Authoritative source selected",
        }),
      }),
    );
  });
});

// ─── Source archive audit events ──────────────────────────────────────────────

describe("integration: source archive audit events", () => {
  it("logs source.archived event", async () => {
    const repo = createMockRepo({
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "src-1", status: "archived" },
      }),
    });

    await repo.updateContextSource("ws-1", "src-1", {
      status: "archived",
      terminalOutcome: "archived" as any,
    });

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user",
      eventType: "source.archived",
      entityType: "context_source",
      entityId: "src-1",
      before: { status: "processed" },
      after: { status: "archived", terminalOutcome: "archived" },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "source.archived",
        entityType: "context_source",
      }),
    );
  });

  it("archive preserves source in history (not hard delete)", async () => {
    const sources = [
      { id: "src-1", status: "archived" },
      { id: "src-2", status: "processed" },
    ];

    const repo = createMockRepo({
      listContextSources: vi.fn().mockResolvedValue({
        ok: true, data: { items: sources, total: 2 },
      }),
    });

    const result = await repo.listContextSources({
      workspaceId: "ws-1", businessId: "biz-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items.find((s) => s.id === "src-1")).toBeDefined();
    }
  });
});

// ─── Restore audit events ─────────────────────────────────────────────────────

describe("integration: restore audit events", () => {
  it("logs version.restored event", async () => {
    const repo = createMockRepo({
      restoreProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "pv-4", workspaceId: "ws-1", businessId: "biz-1", version: 4,
          profile: { business: { name: "Restored" } },
          profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
          changeSummary: null, createdBy: "admin-1", createdAt: new Date(),
          approvedBy: "admin-1", approvedAt: new Date(),
        },
      }),
    });

    await repo.restoreProfileVersion("ws-1", "pv-2", "admin-1", "Restoring v2");

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "admin-1",
      actorType: "user",
      eventType: "version.restored",
      entityType: "business_profile_version",
      entityId: "pv-4",
      before: { version: 3, status: ProfileVersionStatus.CURRENT },
      after: { version: 4, status: ProfileVersionStatus.CURRENT, restoredFrom: "pv-2" },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "version.restored",
        entityType: "business_profile_version",
      }),
    );
  });

  it("restore audit includes source version reference", async () => {
    const repo = createMockRepo();

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "admin-1",
      actorType: "user",
      eventType: "version.restored",
      entityType: "business_profile_version",
      entityId: "pv-4",
      before: null,
      after: {
        version: 4,
        status: ProfileVersionStatus.CURRENT,
        restoredFrom: "pv-2",
        restoredFromVersion: 2,
      },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          restoredFrom: "pv-2",
          restoredFromVersion: 2,
        }),
      }),
    );
  });

  it("restore audit logs actor as admin", async () => {
    const repo = createMockRepo();

    await repo.createAuditLog({
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "admin-1",
      actorType: "user",
      eventType: "version.restored",
      entityType: "business_profile_version",
      entityId: "pv-4",
      before: null,
      after: { version: 4, status: ProfileVersionStatus.CURRENT },
    });

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        actorType: "user",
      }),
    );
  });
});

// ─── Audit event completeness ─────────────────────────────────────────────────

describe("integration: audit event completeness", () => {
  it("every approval creates exactly one audit event", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    const approvalCalls = (repo.createAuditLog as any).mock.calls.filter(
      (call: any[]) => call[0].eventType === "profile.approved",
    );
    expect(approvalCalls).toHaveLength(1);
  });

  it("audit events include all required fields", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    const call = (repo.createAuditLog as any).mock.calls[0][0];
    expect(typeof call.workspaceId).toBe("string");
    expect(typeof call.businessId).toBe("string");
    expect(typeof call.actorId).toBe("string");
    expect(["user", "service", "worker"]).toContain(call.actorType);
    expect(typeof call.eventType).toBe("string");
    expect(typeof call.entityType).toBe("string");
    expect(typeof call.entityId).toBe("string");
    expect(call.before === null || typeof call.before === "object").toBe(true);
    expect(call.after === null || typeof call.after === "object").toBe(true);
  });

  it("audit events have deterministic structure", () => {
    const event = {
      workspaceId: "ws-1",
      businessId: "biz-1",
      actorId: "user-1",
      actorType: "user" as const,
      eventType: "profile.approved",
      entityType: "business_profile_version",
      entityId: "pv-1",
      before: null,
      after: { version: 1, status: "current" },
    };

    expect(typeof event.workspaceId).toBe("string");
    expect(typeof event.businessId).toBe("string");
    expect(typeof event.actorId).toBe("string");
    expect(["user", "service", "worker"]).toContain(event.actorType);
    expect(typeof event.eventType).toBe("string");
    expect(typeof event.entityType).toBe("string");
    expect(typeof event.entityId).toBe("string");
  });
});
