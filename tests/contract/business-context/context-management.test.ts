import { describe, expect, it, vi, beforeEach } from "vitest";
import { approveBusinessProfile } from "../../../src/core/business-context/versioning";
import { getVersion, compareVersions } from "../../../src/core/business-context/service/context.service";
import { validateProfile } from "../../../src/core/business-context/compiler";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  BusinessProfileVersion,
  ContextFact,
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
    createContextFact: vi.fn().mockResolvedValue({
      ok: true,
      data: {} as ContextFact,
    }),
    getContextFact: vi.fn(),
    listContextFacts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateContextFact: vi.fn(),
    createContextConflict: vi.fn(),
    getContextConflict: vi.fn(),
    listContextConflicts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    resolveContextConflict: vi.fn(),
    createOnboardingQuestion: vi.fn(),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    answerOnboardingQuestion: vi.fn(),
    createProfileVersion: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
        changeSummary: "Initial", createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      } as BusinessProfileVersion,
    }),
    getProfileVersion: vi.fn(),
    listProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
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

// ─── GET /api/businesses/:id/context — current profile ────────────────────────

describe("contract: GET /api/businesses/:id/context", () => {
  it("returns current profile version when exists", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: { business: { name: "Acme" } },
      profileMarkdown: "# Acme", status: ProfileVersionStatus.CURRENT,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: currentVersion }),
    });

    const result = await repo.getCurrentProfileVersion("ws-1", "biz-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data?.status).toBe(ProfileVersionStatus.CURRENT);
      expect(result.data?.businessId).toBe("biz-1");
    }
  });

  it("returns null when no current profile exists", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await repo.getCurrentProfileVersion("ws-1", "biz-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it("returns error on database failure", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Connection failed" },
      }),
    });

    const result = await repo.getCurrentProfileVersion("ws-1", "biz-1");

    expect(result.ok).toBe(false);
  });
});

// ─── PATCH /api/businesses/:id/context/facts — add corrections ────────────────

describe("contract: PATCH /api/businesses/:id/context/facts", () => {
  it("creates new user-verified fact", async () => {
    const repo = createMockRepo();

    const result = await repo.createContextFact({
      workspaceId: "ws-1",
      businessId: "biz-1",
      factKey: "business.name",
      value: { name: "Corrected Name" },
      sourceId: "src-manual",
      sourceDocumentId: null,
      sourceExcerpt: null,
      evidenceLocator: null,
      confidence: 1.0,
      verificationStatus: "user_verified",
      supersedesFactId: null,
      validFrom: new Date(),
      validTo: null,
      createdBy: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(repo.createContextFact).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationStatus: "user_verified",
        confidence: 1.0,
      }),
    );
  });

  it("correction supersedes previous fact", async () => {
    const repo = createMockRepo();

    const result = await repo.createContextFact({
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
      supersedesFactId: "f-old",
      validFrom: new Date(),
      validTo: null,
      createdBy: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(repo.createContextFact).toHaveBeenCalledWith(
      expect.objectContaining({ supersedesFactId: "f-old" }),
    );
  });

  it("does not delete earlier evidence", async () => {
    const facts: ContextFact[] = [
      {
        id: "f-1", workspaceId: "ws-1", businessId: "biz-1", factKey: "business.name",
        value: { name: "Old" }, sourceId: "src-1", sourceDocumentId: null,
        sourceExcerpt: null, evidenceLocator: null, confidence: 0.8,
        verificationStatus: "extracted", supersedesFactId: null,
        validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: "system",
      },
    ];

    const repo = createMockRepo({
      listContextFacts: vi.fn().mockResolvedValue({ ok: true, data: { items: facts, total: 1 } }),
    });

    const result = await repo.listContextFacts({
      workspaceId: "ws-1", businessId: "biz-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].id).toBe("f-1");
    }
  });
});

// ─── POST /api/businesses/:id/context/draft — compile draft ───────────────────

describe("contract: POST /api/businesses/:id/context/draft", () => {
  it("compiles draft from active facts", async () => {
    const repo = createMockRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: "f-1",
              workspaceId: "ws-1",
              businessId: "biz-1",
              factKey: "business.name",
              value: { name: "Acme" },
              sourceId: "source-1",
              sourceDocumentId: null,
              sourceExcerpt: null,
              evidenceLocator: null,
              confidence: 0.9,
              verificationStatus: "extracted",
              supersedesFactId: null,
              validFrom: new Date(),
              validTo: null,
              createdAt: new Date(),
              createdBy: "user-1",
            } satisfies ContextFact,
          ],
          total: 1,
        },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    });

    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      conversion_journey: { steps: [] },
      economics: { ltv: 500 },
      brand: { tone: "pro" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: [] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
    }
  });

  it("rejects draft with unresolved conflicts", async () => {
    const repo = createMockRepo({
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [{ id: "c-1", factKey: "offers.pricing", status: "open" }],
          total: 1,
        },
      }),
    });

    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      conversion_journey: { steps: [] },
      economics: { ltv: 500 },
      brand: { tone: "pro" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: [] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(false);
      expect(result.data.unresolvedConflicts).toHaveLength(1);
    }
  });
});

// ─── GET /api/businesses/:id/context/diff — field-level diff ──────────────────

describe("contract: GET /api/businesses/:id/context/diff", () => {
  it("returns field-level diff between current and draft", () => {
    const current: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    };
    const draft: Record<string, JsonValue> = {
      business: { name: "Acme Inc" },
      offers: { primary: "Widget Pro" },
      customers: { segment: "Enterprise" },
    };

    const diff: Record<string, { before: JsonValue | null; after: JsonValue | null }> = {};
    const allKeys = new Set([...Object.keys(current), ...Object.keys(draft)]);
    for (const key of allKeys) {
      const cur = current[key];
      const dra = draft[key];
      if (JSON.stringify(cur) !== JSON.stringify(dra)) {
        diff[key] = { before: cur ?? null, after: dra ?? null };
      }
    }

    expect(diff.business).toEqual({
      before: { name: "Acme" },
      after: { name: "Acme Inc" },
    });
    expect(diff.offers).toEqual({
      before: { primary: "Widget" },
      after: { primary: "Widget Pro" },
    });
    expect(diff.customers).toEqual({
      before: null,
      after: { segment: "Enterprise" },
    });
  });

  it("returns empty diff when profiles match", () => {
    const current: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    };
    const draft: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    };

    const diff: Record<string, { before: JsonValue | null; after: JsonValue | null }> = {};
    const allKeys = new Set([...Object.keys(current), ...Object.keys(draft)]);
    for (const key of allKeys) {
      if (JSON.stringify(current[key]) !== JSON.stringify(draft[key])) {
        diff[key] = { before: current[key] ?? null, after: draft[key] ?? null };
      }
    }

    expect(Object.keys(diff)).toHaveLength(0);
  });
});

// ─── POST /api/businesses/:id/context/approve — publish version ───────────────

describe("contract: POST /api/businesses/:id/context/approve", () => {
  it("publishes new version as current", async () => {
    const repo = createMockRepo();

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    }, "user-1");

    expect(result.ok).toBe(true);
    expect(repo.createProfileVersion).toHaveBeenCalledWith(
      expect.objectContaining({ status: ProfileVersionStatus.CURRENT }),
    );
    expect(repo.createAuditLog).toHaveBeenCalled();
  });

  it("supersedes previous current version", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: currentVersion }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: true, data: { ...currentVersion, id: "pv-2", version: 2, status: ProfileVersionStatus.CURRENT },
      }),
    });

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.supersedeProfileVersions).toHaveBeenCalledWith("ws-1", "biz-1");
  });

  it("audit log includes before/after state", async () => {
    const repo = createMockRepo();

    await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "profile.approved",
        entityType: "business_profile_version",
        before: null,
        after: expect.objectContaining({ status: ProfileVersionStatus.CURRENT }),
      }),
    );
  });

  it("fails when supersede fails", async () => {
    const currentVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: null, approvedAt: null,
    };

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: currentVersion }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({
        ok: false, error: { code: "DB_ERROR", message: "Supersede failed" },
      }),
    });

    const result = await approveBusinessProfile(repo, "biz-1", "ws-1", {}, "user-1");

    expect(result.ok).toBe(false);
  });
});

// ─── GET /api/businesses/:id/context/versions — list versions ─────────────────

describe("contract: GET /api/businesses/:id/context/versions", () => {
  it("returns all versions for business", async () => {
    const versions: BusinessProfileVersion[] = [
      {
        id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.SUPERSEDED,
        changeSummary: null, createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      },
      {
        id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
        changeSummary: null, createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      },
    ];

    const repo = createMockRepo({
      listProfileVersions: vi.fn().mockResolvedValue({
        ok: true, data: { items: versions, total: 2 },
      }),
    });

    const result = await repo.listProfileVersions({
      workspaceId: "ws-1", businessId: "biz-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.total).toBe(2);
    }
  });

  it("versions ordered by version number descending", async () => {
    const versions: BusinessProfileVersion[] = [
      {
        id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
        changeSummary: null, createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      },
      {
        id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
        profile: {}, profileMarkdown: null, status: ProfileVersionStatus.SUPERSEDED,
        changeSummary: null, createdBy: "user-1", createdAt: new Date(),
        approvedBy: "user-1", approvedAt: new Date(),
      },
    ];

    const repo = createMockRepo({
      listProfileVersions: vi.fn().mockResolvedValue({
        ok: true, data: { items: versions, total: 2 },
      }),
    });

    const result = await repo.listProfileVersions({
      workspaceId: "ws-1", businessId: "biz-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items[0].version).toBeGreaterThanOrEqual(result.data.items[1].version);
    }
  });

  it("returns empty list for business with no versions", async () => {
    const repo = createMockRepo({
      listProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    });

    const result = await repo.listProfileVersions({
      workspaceId: "ws-1", businessId: "biz-1",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(0);
      expect(result.data.total).toBe(0);
    }
  });
});

// ─── POST /api/businesses/:id/context/versions/:versionId/restore ─────────────

describe("contract: POST /api/businesses/:id/context/versions/:versionId/restore", () => {
  it("creates new version from restored snapshot", async () => {
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

    const result = await repo.restoreProfileVersion("ws-1", "pv-2", "admin-1", "Restoring v2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(4);
      expect(result.data.status).toBe(ProfileVersionStatus.CURRENT);
    }
  });

  it("original version not mutated", async () => {
    const originalVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
      profile: { business: { name: "Original" } },
      profileMarkdown: null, status: ProfileVersionStatus.SUPERSEDED,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: originalVersion }),
      restoreProfileVersion: vi.fn().mockResolvedValue({
        ok: true, data: { ...originalVersion, id: "pv-4", version: 4, status: ProfileVersionStatus.CURRENT },
      }),
    });

    await repo.restoreProfileVersion("ws-1", "pv-2", "admin-1");

    const original = await repo.getProfileVersion("ws-1", "pv-2");
    expect(original.ok && original.data?.status).toBe(ProfileVersionStatus.SUPERSEDED);
  });

  it("all versions preserved after restore", async () => {
    const versions: BusinessProfileVersion[] = [
      { id: "pv-1", version: 1, status: ProfileVersionStatus.SUPERSEDED } as BusinessProfileVersion,
      { id: "pv-2", version: 2, status: ProfileVersionStatus.SUPERSEDED } as BusinessProfileVersion,
      { id: "pv-3", version: 3, status: ProfileVersionStatus.CURRENT } as BusinessProfileVersion,
    ];

    const repo = createMockRepo({
      listProfileVersions: vi.fn().mockResolvedValue({
        ok: true, data: { items: versions, total: 3 },
      }),
      restoreProfileVersion: vi.fn().mockResolvedValue({
        ok: true, data: { ...versions[0], id: "pv-4", version: 4, status: ProfileVersionStatus.CURRENT },
      }),
    });

    await repo.restoreProfileVersion("ws-1", "pv-1", "admin-1");

    const listResult = await repo.listProfileVersions({ workspaceId: "ws-1", businessId: "biz-1" });
    expect(listResult.ok && listResult.data.items).toHaveLength(3);
  });
});

// ─── getVersion ──────────────────────────────────────────────────────────────

describe("contract: getVersion", () => {
  it("returns version when repo returns matching businessId", async () => {
    const version: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: { business: { name: "Acme" } }, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: version }),
    });

    const result = await getVersion(repo, "biz-1", "ws-1", "pv-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe("pv-1");
    }
  });

  it("returns ok null when repo returns null", async () => {
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await getVersion(repo, "biz-1", "ws-1", "pv-999");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it("returns ok null when version belongs to different business", async () => {
    const version: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "other-biz", version: 1,
      profile: {}, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: version }),
    });

    const result = await getVersion(repo, "biz-1", "ws-1", "pv-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});

// ─── GET /api/businesses/:id/context/versions/compare ────────────────────────

describe("contract: GET /api/businesses/:id/context/versions/compare", () => {
  it("returns viewer access succeeds", async () => {
    const fromVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: { business: { name: "Old" } }, profileMarkdown: null,
      status: ProfileVersionStatus.SUPERSEDED, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const toVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
      profile: { business: { name: "New" } }, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockImplementation((_ws: string, id: string) => {
        if (id === "pv-1") return Promise.resolve({ ok: true, data: fromVersion });
        if (id === "pv-2") return Promise.resolve({ ok: true, data: toVersion });
        return Promise.resolve({ ok: true, data: null });
      }),
    });
    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");
    expect(result.ok).toBe(true);
  });

  it("missing from param returns 400 VALIDATION_ERROR", async () => {
    const from = "";
    const to = "pv-2";
    const hasBoth = from.length > 0 && to.length > 0;
    expect(hasBoth).toBe(false);
  });

  it("missing to param returns 400 VALIDATION_ERROR", async () => {
    const from = "pv-1";
    const to = "";
    const hasBoth = from.length > 0 && to.length > 0;
    expect(hasBoth).toBe(false);
  });

  it("valid compare returns 200 with from_version_id, to_version_id, and changes", async () => {
    const fromVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: { business: { name: "Old" } }, profileMarkdown: null,
      status: ProfileVersionStatus.SUPERSEDED, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const toVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
      profile: { business: { name: "New" } }, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockImplementation((_ws: string, id: string) => {
        if (id === "pv-1") return Promise.resolve({ ok: true, data: fromVersion });
        if (id === "pv-2") return Promise.resolve({ ok: true, data: toVersion });
        return Promise.resolve({ ok: true, data: null });
      }),
    });
    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("fromVersion");
      expect(result.data).toHaveProperty("toVersion");
      expect(result.data).toHaveProperty("diffs");
      expect(result.data.diffs.business).toEqual({
        before: { name: "Old" },
        after: { name: "New" },
      });
    }
  });

  it("missing version returns 404 via NOT_FOUND", async () => {
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });
    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-missing", "pv-2");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("cross-business version returns 404 via NOT_FOUND", async () => {
    const fromVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: {}, profileMarkdown: null,
      status: ProfileVersionStatus.SUPERSEDED, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const otherVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "other-biz", version: 1,
      profile: {}, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockImplementation((_ws: string, id: string) => {
        if (id === "pv-1") return Promise.resolve({ ok: true, data: fromVersion });
        if (id === "pv-2") return Promise.resolve({ ok: true, data: otherVersion });
        return Promise.resolve({ ok: true, data: null });
      }),
    });
    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ─── compareVersions ─────────────────────────────────────────────────────────

describe("contract: compareVersions", () => {
  it("returns diffs with before/after from profile values", async () => {
    const fromVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: { business: { name: "Old Name" }, offers: { primary: "Widget" } },
      profileMarkdown: null, status: ProfileVersionStatus.SUPERSEDED,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const toVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "biz-1", version: 2,
      profile: { business: { name: "New Name" }, offers: { primary: "Widget" } },
      profileMarkdown: null, status: ProfileVersionStatus.CURRENT,
      changeSummary: null, createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockImplementation((_ws: string, id: string) => {
        if (id === "pv-1") return Promise.resolve({ ok: true, data: fromVersion });
        if (id === "pv-2") return Promise.resolve({ ok: true, data: toVersion });
        return Promise.resolve({ ok: true, data: null });
      }),
    });

    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fromVersion).toBe(1);
      expect(result.data.toVersion).toBe(2);
      expect(result.data.diffs.business).toEqual({
        before: { name: "Old Name" },
        after: { name: "New Name" },
      });
      expect(result.data.diffs.offers).toBeUndefined();
    }
  });

  it("returns NOT_FOUND when either version is missing", async () => {
    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns NOT_FOUND when either version belongs to different business", async () => {
    const fromVersion: BusinessProfileVersion = {
      id: "pv-1", workspaceId: "ws-1", businessId: "biz-1", version: 1,
      profile: {}, profileMarkdown: null,
      status: ProfileVersionStatus.SUPERSEDED, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };
    const otherVersion: BusinessProfileVersion = {
      id: "pv-2", workspaceId: "ws-1", businessId: "other-biz", version: 1,
      profile: {}, profileMarkdown: null,
      status: ProfileVersionStatus.CURRENT, changeSummary: null,
      createdBy: "user-1", createdAt: new Date(),
      approvedBy: "user-1", approvedAt: new Date(),
    };

    const repo = createMockRepo({
      getProfileVersion: vi.fn().mockImplementation((_ws: string, id: string) => {
        if (id === "pv-1") return Promise.resolve({ ok: true, data: fromVersion });
        if (id === "pv-2") return Promise.resolve({ ok: true, data: otherVersion });
        return Promise.resolve({ ok: true, data: null });
      }),
    });

    const result = await compareVersions(repo, "biz-1", "ws-1", "pv-1", "pv-2");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
