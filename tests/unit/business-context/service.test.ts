import { describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  createSession,
  getSession,
  submitAnswers,
  compileOnboardingDraft,
  approveV1,
  getReadiness,
  type CreateBusinessInput,
} from "@/core/business-context/service";
import type { RepositoryPort } from "@/core/business-context/repository.port";
import type { Business, OnboardingSession, ContextSource, ContextFact } from "@/core/business-context/types";
import { OnboardingStatus, SourceType, VerificationStatus } from "@/core/business-context/types";
import { createFakeRepository } from "../../harness/test-repository";

function makeBusiness(): Business {
  return {
    id: "biz-1",
    workspaceId: "ws-1",
    name: "Acme",
    websiteUrl: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSession(businessId: string, status: OnboardingStatus = OnboardingStatus.CREATED): OnboardingSession {
  return {
    id: "sess-1",
    workspaceId: "ws-1",
    businessId,
    status,
    currentStep: null,
    startedBy: "user-1",
    startedAt: new Date(),
    completedAt: null,
    error: null,
  };
}

const fullInput: CreateBusinessInput = {
  workspaceId: "ws-1",
  name: "Acme",
  primaryMarket: "US",
  primaryAdvertisingObjective: "conversions",
  primaryBusinessOutcome: "revenue_growth",
  approximateMonthlyMetaBudget: 10000,
  initialSources: [
    { sourceType: "website", sourceName: "Acme Site" },
    { sourceType: "brand_deck", sourceName: "Brand Deck" },
  ],
};

describe("createBusiness", () => {
  it("creates business and registers all initial sources", async () => {
    const createBusinessSpy = vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() });
    const createSourceSpy = vi.fn().mockResolvedValue({ ok: true, data: {} as ContextSource });
    const repo = createFakeRepository({
      createBusiness: createBusinessSpy,
      createContextSource: createSourceSpy,
    });
    const r = await createBusiness(repo, fullInput);
    expect(r.ok).toBe(true);
    expect(createBusinessSpy).toHaveBeenCalledTimes(1);
    expect(createSourceSpy).toHaveBeenCalledTimes(2);
  });

  it("returns error when business creation fails", async () => {
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "boom" },
      }),
    });
    const r = await createBusiness(repo, { ...fullInput, initialSources: [] });
    expect(r.ok).toBe(false);
  });

  it("skips source creation when initialSources is empty", async () => {
    const createSourceSpy = vi.fn();
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: createSourceSpy,
    });
    await createBusiness(repo, { ...fullInput, initialSources: [] });
    expect(createSourceSpy).not.toHaveBeenCalled();
  });

  it("creates provenance source and five user-verified facts when createdBy provided", async () => {
    const sourceResult: ContextSource = {
      id: "src-prov-1",
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceType: "user_answer",
      sourceName: "Onboarding provenance",
      externalReference: null,
      status: "registered",
      currentStage: null,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    };
    const createSourceSpy = vi.fn().mockResolvedValue({ ok: true, data: sourceResult });
    const createFactSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: {} as ContextFact,
    });
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: createSourceSpy,
      createContextFact: createFactSpy,
    });

    const r = await createBusiness(repo, { ...fullInput, initialSources: [], createdBy: "user-1" });
    expect(r.ok).toBe(true);

    // One provenance source
    expect(createSourceSpy).toHaveBeenCalledTimes(1);
    expect(createSourceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "user_answer",
        sourceName: "Onboarding provenance",
      }),
    );

    // Five user-verified facts
    expect(createFactSpy).toHaveBeenCalledTimes(5);
    const factCalls = createFactSpy.mock.calls.map((c) => c[0]);
    expect(factCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: "business.name",
          value: "Acme",
          sourceId: "src-prov-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
        expect.objectContaining({
          factKey: "market.primary",
          value: "US",
          sourceId: "src-prov-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
        expect.objectContaining({
          factKey: "advertising.primary_objective",
          value: "conversions",
          sourceId: "src-prov-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
        expect.objectContaining({
          factKey: "business.primary_outcome",
          value: "revenue_growth",
          sourceId: "src-prov-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
        expect.objectContaining({
          factKey: "economics.monthly_meta_budget",
          value: 10000,
          sourceId: "src-prov-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
      ]),
    );
  });

  it("returns error when provenance source creation fails", async () => {
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "source insert failed" },
      }),
    });
    const r = await createBusiness(repo, { ...fullInput, createdBy: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });

  it("returns error when fact creation fails", async () => {
    const sourceResult: ContextSource = {
      id: "src-prov-2",
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceType: "user_answer",
      sourceName: "Onboarding provenance",
      externalReference: null,
      status: "registered",
      currentStage: null,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    };
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: vi.fn().mockResolvedValue({ ok: true, data: sourceResult }),
      createContextFact: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "fact insert failed" },
      }),
    });
    const r = await createBusiness(repo, { ...fullInput, createdBy: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });

  it("returns error when initial source creation fails and skips provenance", async () => {
    const createSourceSpy = vi.fn()
      .mockResolvedValueOnce({ ok: true, data: { id: "src-ok" } as ContextSource })
      .mockResolvedValueOnce({ ok: false, error: { code: "DB_ERROR", message: "second source failed" } });
    const createFactSpy = vi.fn();
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: createSourceSpy,
      createContextFact: createFactSpy,
    });
    const r = await createBusiness(repo, { ...fullInput, createdBy: "user-1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
    expect(createFactSpy).not.toHaveBeenCalled();
  });

  it("retains legacy behavior when createdBy omitted", async () => {
    const createSourceSpy = vi.fn().mockResolvedValue({ ok: true, data: {} as ContextSource });
    const createFactSpy = vi.fn();
    const repo = createFakeRepository({
      createBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createContextSource: createSourceSpy,
      createContextFact: createFactSpy,
    });
    await createBusiness(repo, { ...fullInput, initialSources: [] });
    // Only initialSources loop runs (0 sources) — no provenance, no facts
    expect(createSourceSpy).not.toHaveBeenCalled();
    expect(createFactSpy).not.toHaveBeenCalled();
  });
});

describe("createSession", () => {
  it("creates session when business exists", async () => {
    const createSessionSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSession("biz-1"),
    });
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      createOnboardingSession: createSessionSpy,
    });
    const r = await createSession(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(true);
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND when business missing", async () => {
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: null }),
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await createSession(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("replays existing session when one already exists", async () => {
    const existingSession = makeSession("biz-1");
    const createOnboardingSessionSpy = vi.fn();
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [existingSession], total: 1 },
      }),
      createOnboardingSession: createOnboardingSessionSpy,
    });
    const r = await createSession(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(existingSession);
    expect(createOnboardingSessionSpy).not.toHaveBeenCalled();
  });
});

describe("getSession", () => {
  it("returns the most recent session when one exists", async () => {
    const s = makeSession("biz-1");
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [s], total: 1 },
      }),
    });
    const r = await getSession(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(s);
  });

  it("returns null when no session", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await getSession(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });
});

describe("submitAnswers", () => {
  it("creates a question per answer using existing session", async () => {
    const createQ = vi.fn().mockResolvedValue({ ok: true, data: { id: "q-1" } });
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      createOnboardingQuestion: createQ,
      createContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "src-prov-def" } as ContextSource,
      }),
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [
        { factKey: "business.name", answer: "Acme" },
        { factKey: "offers.primary", answer: { name: "Widget" } },
      ],
    });
    expect(r.ok).toBe(true);
    expect(createQ).toHaveBeenCalledTimes(2);
  });

  it("creates a session first when none exists", async () => {
    const createSessionSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSession("biz-1"),
    });
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      createOnboardingSession: createSessionSpy,
      createOnboardingQuestion: vi.fn().mockResolvedValue({ ok: true, data: { id: "q-1" } }),
      createContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "src-prov-def" } as ContextSource,
      }),
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(true);
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
  });

  it("creates provenance source and user-verified facts per answer", async () => {
    const createSourceSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { id: "src-prov-ans-1" } as ContextSource,
    });
    const createFactSpy = vi.fn().mockResolvedValue({ ok: true, data: {} as ContextFact });
    const createQ = vi.fn().mockResolvedValue({ ok: true, data: { id: "q-1" } });
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      createOnboardingQuestion: createQ,
      createContextSource: createSourceSpy,
      createContextFact: createFactSpy,
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [
        { factKey: "business.name", answer: "Acme" },
        { factKey: "offers.primary", answer: { name: "Widget" } },
      ],
    });
    expect(r.ok).toBe(true);

    // One provenance source
    expect(createSourceSpy).toHaveBeenCalledTimes(1);
    expect(createSourceSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "user_answer",
        metadata: { sessionId: "sess-1" },
      }),
    );

    // Two user-verified facts
    expect(createFactSpy).toHaveBeenCalledTimes(2);
    const factCalls = createFactSpy.mock.calls.map((c) => c[0]);
    expect(factCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          factKey: "business.name",
          value: "Acme",
          sourceId: "src-prov-ans-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
        expect.objectContaining({
          factKey: "offers.primary",
          value: { name: "Widget" },
          sourceId: "src-prov-ans-1",
          verificationStatus: VerificationStatus.USER_VERIFIED,
        }),
      ]),
    );
  });

  it("returns error when provenance source creation fails", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      createContextSource: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "source insert failed" },
      }),
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });

  it("returns error when createOnboardingQuestion fails", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      createContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "src-prov-qfail" } as ContextSource,
      }),
      createOnboardingQuestion: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "question insert failed" },
      }),
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });
  it("returns error when fact creation fails", async () => {
    const sourceResult: ContextSource = {
      id: "src-prov-ans-2",
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceType: "user_answer",
      sourceName: "User answer provenance",
      externalReference: null,
      status: "registered",
      currentStage: null,
      terminalOutcome: null,
      metadata: { sessionId: "sess-1" },
      collectedAt: new Date(),
    };
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      createContextSource: vi.fn().mockResolvedValue({ ok: true, data: sourceResult }),
      createContextFact: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "fact insert failed" },
      }),
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });

  it("updates session to READY_FOR_APPROVAL after successful answer submission", async () => {
    const existingSession = makeSession("biz-1");
    const updateOnboardingSessionSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { ...existingSession, status: OnboardingStatus.READY_FOR_APPROVAL, currentStep: "approval" },
    });
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [existingSession], total: 1 },
      }),
      createContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "src-prov-1" } as ContextSource,
      }),
      createOnboardingQuestion: vi.fn().mockResolvedValue({ ok: true, data: { id: "q-1" } }),
      createContextFact: vi.fn().mockResolvedValue({ ok: true, data: {} as ContextFact }),
      updateOnboardingSession: updateOnboardingSessionSpy,
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(true);
    expect(updateOnboardingSessionSpy).toHaveBeenCalledWith(
      "ws-1",
      existingSession.id,
      { status: OnboardingStatus.READY_FOR_APPROVAL, currentStep: "approval" },
    );
  });

  it("does not advance session when no answers are submitted", async () => {
    const updateOnboardingSessionSpy = vi.fn();
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [makeSession("biz-1")], total: 1 },
      }),
      updateOnboardingSession: updateOnboardingSessionSpy,
    });

    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [],
    });

    expect(r.ok).toBe(true);
    expect(updateOnboardingSessionSpy).not.toHaveBeenCalled();
  });
});

describe("compileOnboardingDraft", () => {
  it("returns profile built from answered questions", async () => {
    const session = makeSession("biz-1", OnboardingStatus.AWAITING_ANSWERS);
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            { id: "q-1", factKey: "business.name", status: "answered", answer: "Acme" },
            { id: "q-2", factKey: "offers.primary", status: "answered", answer: "Widget" },
            { id: "q-3", factKey: "brand.tone", status: "open", answer: null },
          ],
          total: 3,
        },
      }),
    });
    const r = await compileOnboardingDraft(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.data as Record<string, unknown>)["business.name"]).toBe("Acme");
    }
  });

  it("returns NO_SESSION when no session exists", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await compileOnboardingDraft(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NO_SESSION");
  });
});

describe("approveV1", () => {
  it("approves v1 with all required sections present", async () => {
    const session = makeSession("biz-1", OnboardingStatus.READY_FOR_APPROVAL);
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            { id: "q-1", factKey: "business", status: "answered", answer: { name: "Acme" } },
            { id: "q-2", factKey: "offers", status: "answered", answer: { primary: "Widget" } },
            { id: "q-3", factKey: "customers", status: "answered", answer: { segment: "B2B" } },
            { id: "q-4", factKey: "conversion_journey", status: "answered", answer: { steps: [] } },
            { id: "q-5", factKey: "economics", status: "answered", answer: { ltv: 100 } },
            { id: "q-6", factKey: "brand", status: "answered", answer: { tone: "pro" } },
            { id: "q-7", factKey: "creative_capacity", status: "answered", answer: { cap: "high" } },
            { id: "q-8", factKey: "measurement", status: "answered", answer: { kpis: [] } },
          ],
          total: 8,
        },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
      supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "pv-1",
          workspaceId: "ws-1",
          businessId: "biz-1",
          version: 1,
          profile: {},
          profileMarkdown: null,
          status: "current",
          changeSummary: null,
          createdBy: "user-1",
          createdAt: new Date(),
          approvedBy: "user-1",
          approvedAt: new Date(),
        },
      }),
      createAuditLog: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    });
    const r = await approveV1(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(true);
  });

  it("blocks approval when required sections missing", async () => {
    const repo = createFakeRepository({
      approveOnboardingV1: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "Missing required sections: offers, customers",
          details: { missingSections: ["offers", "customers"], unresolvedConflicts: 0 },
        },
      }),
    });
    const r = await approveV1(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PROFILE_INCOMPLETE");
  });

  it("blocks approval when open conflicts exist", async () => {
    const repo = createFakeRepository({
      approveOnboardingV1: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "Missing required sections: ",
          details: { missingSections: [], unresolvedConflicts: 1 },
        },
      }),
    });
    const r = await approveV1(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PROFILE_INCOMPLETE");
  });
});

describe("getReadiness", () => {
  it("returns readiness DTO when session exists", async () => {
    const session = makeSession("biz-1", OnboardingStatus.AWAITING_REVIEW);
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listContextSources: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      listContextJobs: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
      listQualityGateResults: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await getReadiness(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toBeDefined();
      expect(r.data!.session.id).toBe("sess-1");
      expect(r.data!.session.status).toBe("awaiting_review");
      expect(r.data!.routeStage).toBeDefined();
      expect(Array.isArray(r.data!.blockers)).toBe(true);
      expect(Array.isArray(r.data!.sectionReadiness)).toBe(true);
      expect(typeof r.data!.approvalReady).toBe("boolean");
    }
  });

  it("returns null when no session", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await getReadiness(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toBeNull();
  });

  it("propagates repo errors", async () => {
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "boom" },
      }),
    });
    const r = await getReadiness(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("DB_ERROR");
  });

  it("loads sources, facts, conflicts, jobs, questions, version, quality gates in parallel", async () => {
    const session = makeSession("biz-1");
    const listSourcesSpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const listFactsSpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const listConflictsSpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const listJobsSpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const listQuestionsSpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const getCurrentVersionSpy = vi.fn().mockResolvedValue({ ok: true, data: null });
    const listQualitySpy = vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } });
    const repo = createFakeRepository({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [session], total: 1 },
      }),
      listContextSources: listSourcesSpy,
      listContextFacts: listFactsSpy,
      listContextConflicts: listConflictsSpy,
      listContextJobs: listJobsSpy,
      listOnboardingQuestions: listQuestionsSpy,
      getCurrentProfileVersion: getCurrentVersionSpy,
      listQualityGateResults: listQualitySpy,
    });
    const r = await getReadiness(repo, "biz-1", "ws-1");
    expect(r.ok).toBe(true);
    expect(listSourcesSpy).toHaveBeenCalledOnce();
    expect(listFactsSpy).toHaveBeenCalledOnce();
    expect(listConflictsSpy).toHaveBeenCalledOnce();
    expect(listJobsSpy).toHaveBeenCalledOnce();
    expect(listQuestionsSpy).toHaveBeenCalledOnce();
    expect(getCurrentVersionSpy).toHaveBeenCalledOnce();
    expect(listQualitySpy).toHaveBeenCalledOnce();
  });
});
