import { describe, expect, it, vi } from "vitest";
import {
  createBusiness,
  createSession,
  getSession,
  submitAnswers,
  compileOnboardingDraft,
  approveV1,
  type CreateBusinessInput,
} from "@/core/business-context/service";
import type { RepositoryPort } from "@/core/business-context/repository.port";
import type { Business, OnboardingSession, ContextSource } from "@/core/business-context/types";
import { OnboardingStatus } from "@/core/business-context/types";
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
});

describe("createSession", () => {
  it("creates session when business exists", async () => {
    const createSessionSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSession("biz-1"),
    });
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: makeBusiness() }),
      createOnboardingSession: createSessionSpy,
    });
    const r = await createSession(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(true);
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
  });

  it("returns NOT_FOUND when business missing", async () => {
    const repo = createFakeRepository({
      getBusiness: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });
    const r = await createSession(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
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
    });
    const r = await submitAnswers(repo, "biz-1", "ws-1", "user-1", {
      answers: [{ factKey: "business.name", answer: "Acme" }],
    });
    expect(r.ok).toBe(true);
    expect(createSessionSpy).toHaveBeenCalledTimes(1);
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
            { id: "q-1", factKey: "business", status: "answered", answer: { name: "Acme" } },
          ],
          total: 1,
        },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });
    const r = await approveV1(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PROFILE_INCOMPLETE");
  });

  it("blocks approval when open conflicts exist", async () => {
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
        data: { items: [{ id: "c-1", status: "open" }], total: 1 },
      }),
    });
    const r = await approveV1(repo, "biz-1", "ws-1", "user-1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("PROFILE_INCOMPLETE");
  });
});
