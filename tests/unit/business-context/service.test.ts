import { describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  createSession,
  getSession,
  submitAnswers,
  compileOnboardingDraft,
  approveV1,
  type CreateBusinessInput,
  type SubmitAnswersInput,
} from "../../../src/core/business-context/service";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  Business,
  OnboardingSession,
  ContextSource,
  OnboardingQuestion,
  BusinessProfileVersion,
  ContextConflict,
  ServiceResult,
  JsonValue,
} from "../../../src/core/business-context/types";
import { OnboardingStatus, ProfileVersionStatus } from "../../../src/core/business-context/types";

// ─── Mock repository factory ──────────────────────────────────────────────────

function createMockRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  return {
    createBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "biz-1", workspaceId: "ws-1", name: "Test", websiteUrl: null, status: "active", createdAt: new Date(), updatedAt: new Date() },
    } as ServiceResult<Business>),
    getBusiness: vi.fn().mockResolvedValue({ ok: true, data: null }),
    listBusinesses: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateBusiness: vi.fn(),
    createOnboardingSession: vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "sess-1", workspaceId: "ws-1", businessId: "biz-1", status: OnboardingStatus.CREATED, currentStep: null, startedBy: "user-1", startedAt: new Date(), completedAt: null, error: null },
    } as ServiceResult<OnboardingSession>),
    getOnboardingSession: vi.fn(),
    listOnboardingSessions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateOnboardingSession: vi.fn(),
    createContextSource: vi.fn().mockResolvedValue({ ok: true, data: {} } as ServiceResult<ContextSource>),
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
    createOnboardingQuestion: vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "q-1", status: "answered" },
    } as ServiceResult<OnboardingQuestion>),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    answerOnboardingQuestion: vi.fn(),
    createProfileVersion: vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "pv-1", version: 1, status: ProfileVersionStatus.CURRENT, profile: {}, createdBy: "user-1", createdAt: new Date() },
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

// ─── createBusiness ───────────────────────────────────────────────────────────

describe("service.createBusiness", () => {
  it("creates business and initial sources", async () => {
    const repo = createMockRepo();
    const input: CreateBusinessInput = {
      workspaceId: "ws-1",
      name: "Acme Corp",
      primaryMarket: "US",
      primaryAdvertisingObjective: "conversions",
      primaryBusinessOutcome: "revenue_growth",
      approximateMonthlyMetaBudget: 10000,
      initialSources: [
        { sourceType: "website", sourceName: "Company Website", externalReference: "https://acme.example.com" },
      ],
    };

    const result = await createBusiness(repo, input);

    expect(result.ok).toBe(true);
    expect(repo.createBusiness).toHaveBeenCalledOnce();
    expect(repo.createBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws-1",
        name: "Acme Corp",
        status: "active",
      }),
    );
    expect(repo.createContextSource).toHaveBeenCalledOnce();
  });

  it("creates multiple initial sources", async () => {
    const repo = createMockRepo();
    const input: CreateBusinessInput = {
      workspaceId: "ws-1",
      name: "Acme Corp",
      primaryMarket: "US",
      primaryAdvertisingObjective: "conversions",
      primaryBusinessOutcome: "revenue_growth",
      approximateMonthlyMetaBudget: 10000,
      initialSources: [
        { sourceType: "website", sourceName: "Website" },
        { sourceType: "brand_deck", sourceName: "Brand Deck" },
      ],
    };

    await createBusiness(repo, input);

    expect(repo.createContextSource).toHaveBeenCalledTimes(2);
  });

  it("returns error when business creation fails", async () => {
    const repo = createMockRepo({
      createBusiness: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Connection failed" },
      }),
    });

    const result = await createBusiness(repo, {
      workspaceId: "ws-1",
      name: "Acme",
      primaryMarket: "US",
      primaryAdvertisingObjective: "conversions",
      primaryBusinessOutcome: "revenue_growth",
      approximateMonthlyMetaBudget: 10000,
      initialSources: [],
    });

    expect(result.ok).toBe(false);
  });
});

// ─── createSession ────────────────────────────────────────────────────────────

describe("service.createSession", () => {
  it("creates session when business exists", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "biz-1", workspaceId: "ws-1", name: "Test" },
      }),
    });

    const result = await createSession(repo, "biz-1", "ws-1", "user-1");

    expect(result.ok).toBe(true);
    expect(repo.createOnboardingSession).toHaveBeenCalledOnce();
  });

  it("returns NOT_FOUND when business does not exist", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await createSession(repo, "biz-1", "ws-1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ─── getSession ───────────────────────────────────────────────────────────────

describe("service.getSession", () => {
  it("returns session when one exists", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.CREATED };
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
    });

    const result = await getSession(repo, "biz-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(session);
    }
  });

  it("returns null when no session exists", async () => {
    const repo = createMockRepo();
    const result = await getSession(repo, "biz-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});

// ─── submitAnswers ────────────────────────────────────────────────────────────

describe("service.submitAnswers", () => {
  it("creates answered questions from input", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.CREATED };
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
    });

    const input: SubmitAnswersInput = {
      answers: [
        { factKey: "business.name", answer: "Acme Corp" },
        { factKey: "offers.primary", answer: { name: "Widget", price: 99 } },
      ],
    };

    const result = await submitAnswers(repo, "biz-1", "ws-1", "user-1", input);

    expect(result.ok).toBe(true);
    expect(repo.createOnboardingQuestion).toHaveBeenCalledTimes(2);
  });

  it("creates session if none exists", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "biz-1", workspaceId: "ws-1", name: "Test" },
      }),
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      createOnboardingSession: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "sess-new", businessId: "biz-1", status: OnboardingStatus.CREATED },
      }),
    });

    const input: SubmitAnswersInput = {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    };

    const result = await submitAnswers(repo, "biz-1", "ws-1", "user-1", input);

    expect(result.ok).toBe(true);
    expect(repo.createOnboardingSession).toHaveBeenCalledOnce();
  });
});

// ─── compileOnboardingDraft ───────────────────────────────────────────────────

describe("service.compileOnboardingDraft", () => {
  it("compiles profile from answered questions", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.AWAITING_ANSWERS };
    const questions = [
      { factKey: "business.name", status: "answered", answer: "Acme Corp" as JsonValue },
      { factKey: "offers.primary", status: "answered", answer: { name: "Widget" } as JsonValue },
      { factKey: "brand.tone", status: "open", answer: null },
    ];

    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
    });

    const result = await compileOnboardingDraft(repo, "biz-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        "business.name": "Acme Corp",
        "offers.primary": { name: "Widget" },
      });
    }
  });

  it("returns NO_SESSION when no session exists", async () => {
    const repo = createMockRepo();
    const result = await compileOnboardingDraft(repo, "biz-1", "ws-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_SESSION");
    }
  });
});

// ─── approveV1 ────────────────────────────────────────────────────────────────

describe("service.approveV1", () => {
  it("approves profile when validation passes", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.READY_FOR_APPROVAL };
    const questions = [
      { factKey: "business", status: "answered", answer: { name: "Acme" } as JsonValue },
      { factKey: "offers", status: "answered", answer: { primary: "Widget" } as JsonValue },
      { factKey: "customers", status: "answered", answer: { segment: "B2B" } as JsonValue },
      { factKey: "conversion_journey", status: "answered", answer: { steps: [] } as JsonValue },
      { factKey: "economics", status: "answered", answer: { ltv: 500 } as JsonValue },
      { factKey: "brand", status: "answered", answer: { tone: "professional" } as JsonValue },
      { factKey: "creative_capacity", status: "answered", answer: { capacity: "high" } as JsonValue },
      { factKey: "measurement", status: "answered", answer: { kpis: ["revenue"] } as JsonValue },
    ];

    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "pv-1", version: 1, status: ProfileVersionStatus.CURRENT, profile: {}, createdBy: "user-1", createdAt: new Date() },
      }),
    });

    const result = await approveV1(repo, "biz-1", "ws-1", "user-1");

    expect(result.ok).toBe(true);
    expect(repo.createProfileVersion).toHaveBeenCalledOnce();
    expect(repo.createAuditLog).toHaveBeenCalledOnce();
  });

  it("rejects approval when required sections are missing", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.AWAITING_ANSWERS };
    const questions = [
      { factKey: "business", status: "answered", answer: { name: "Acme" } as JsonValue },
      // Missing other required sections
    ];

    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    const result = await approveV1(repo, "biz-1", "ws-1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROFILE_INCOMPLETE");
    }
  });

  it("rejects approval when open conflicts exist", async () => {
    const session = { id: "sess-1", businessId: "biz-1", status: OnboardingStatus.READY_FOR_APPROVAL };
    const questions = [
      { factKey: "business", status: "answered", answer: { name: "Acme" } as JsonValue },
      { factKey: "offers", status: "answered", answer: { primary: "Widget" } as JsonValue },
      { factKey: "customers", status: "answered", answer: { segment: "B2B" } as JsonValue },
      { factKey: "conversion_journey", status: "answered", answer: { steps: [] } as JsonValue },
      { factKey: "economics", status: "answered", answer: { ltv: 500 } as JsonValue },
      { factKey: "brand", status: "answered", answer: { tone: "professional" } as JsonValue },
      { factKey: "creative_capacity", status: "answered", answer: { capacity: "high" } as JsonValue },
      { factKey: "measurement", status: "answered", answer: { kpis: ["revenue"] } as JsonValue },
    ];
    const conflicts = [
      { id: "c-1", factKey: "offers.pricing", status: "open" as const },
    ];

    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: conflicts, total: conflicts.length },
      }),
    });

    const result = await approveV1(repo, "biz-1", "ws-1", "user-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROFILE_INCOMPLETE");
    }
  });
});
