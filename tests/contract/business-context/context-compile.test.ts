import { describe, expect, it, vi } from "vitest";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  BusinessProfileVersion,
  ServiceResult,
  JsonValue,
} from "../../../src/core/business-context/types";
import { ProfileVersionStatus, ContextPurpose } from "../../../src/core/business-context/types";
import { compileContextForPurpose } from "../../../src/core/business-context/service";

// ─── Mock repository factory ──────────────────────────────────────────────────

function createMockRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  return {
    createBusiness: vi.fn(),
    getBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "biz-1", workspaceId: "ws-1" },
    }),
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
    createProfileVersion: vi.fn(),
    getProfileVersion: vi.fn(),
    listProfileVersions: vi.fn(),
    getCurrentProfileVersion: vi.fn(),
    supersedeProfileVersions: vi.fn(),
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
    createAuditLog: vi.fn(),
    listAuditLogs: vi.fn(),
    ...overrides,
  } as RepositoryPort;
}

function makeProfileVersion(
  profile: Record<string, JsonValue>,
  overrides: Partial<BusinessProfileVersion> = {},
): BusinessProfileVersion {
  return {
    id: "pv-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    version: 1,
    profile,
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

// ─── POST /api/businesses/:id/context/compile ─────────────────────────────────

describe("contract: POST /api/businesses/:id/context/compile", () => {
  it("returns purpose-scoped context from current profile version", async () => {
    const profileVersion = makeProfileVersion({
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      brand: { tone: "pro" },
      creative_capacity: { capacity: "high" },
      economics: { ltv: 500 },
      measurement: { kpis: [] },
      conversion_journey: { steps: [] },
    });

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: profileVersion }),
    });

    const result = await compileContextForPurpose(
      repo,
      "biz-1",
      "ws-1",
      ContextPurpose.CAMPAIGN_SETUP,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.purpose).toBe("campaign_setup");
      expect(result.data.business_context_version).toBe("pv-1");
      expect(result.data.context).toHaveProperty("offers");
      expect(result.data.context).toHaveProperty("customers");
      expect(result.data.context).toHaveProperty("brand");
      expect(result.data.context).toHaveProperty("creative_capacity");
      expect(result.data.context).not.toHaveProperty("economics");
      expect(typeof result.data.compiled_at).toBe("string");
    }
  });

  it("returns error when no current version exists", async () => {
    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await compileContextForPurpose(
      repo,
      "biz-1",
      "ws-1",
      ContextPurpose.CAMPAIGN_SETUP,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_CURRENT_VERSION");
    }
  });

  it("returns error when business not found", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await compileContextForPurpose(
      repo,
      "biz-1",
      "ws-1",
      ContextPurpose.CAMPAIGN_SETUP,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("returns unresolved_fields for missing sections", async () => {
    const profileVersion = makeProfileVersion({
      offers: { primary: "Widget" },
    });

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: profileVersion }),
    });

    const result = await compileContextForPurpose(
      repo,
      "biz-1",
      "ws-1",
      ContextPurpose.CAMPAIGN_SETUP,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.unresolved_fields).toEqual(
        expect.arrayContaining(["customers", "brand", "creative_capacity"]),
      );
    }
  });

  it("supports all six context purposes", async () => {
    const profileVersion = makeProfileVersion({
      offers: { primary: "W" },
      customers: { segment: "B2B" },
      brand: { tone: "pro" },
      creative_capacity: { cap: "high" },
      economics: { ltv: 500 },
      measurement: { kpis: [] },
      conversion_journey: { steps: [] },
    });

    const repo = createMockRepo({
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: profileVersion }),
    });

    for (const purpose of Object.values(ContextPurpose)) {
      const result = await compileContextForPurpose(repo, "biz-1", "ws-1", purpose);
      expect(result.ok).toBe(true);
    }
  });
});
