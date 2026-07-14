import { describe, expect, it, vi } from "vitest";
import {
  validateProfile,
  checkRequiredFieldsFulfilled,
} from "../../../src/core/business-context/compiler";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type {
  OnboardingQuestion,
  ContextConflict,
  ServiceResult,
  JsonValue,
} from "../../../src/core/business-context/types";

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
    listContextConflicts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    resolveContextConflict: vi.fn(),
    createOnboardingQuestion: vi.fn(),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
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

// ─── validateProfile ──────────────────────────────────────────────────────────

describe("compiler.validateProfile", () => {
  it("returns valid when all required sections are present", async () => {
    const repo = createMockRepo();
    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      conversion_journey: { steps: ["awareness", "consideration"] },
      economics: { ltv: 500 },
      brand: { tone: "professional" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: ["revenue"] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
      expect(result.data.missingSections).toHaveLength(0);
    }
  });

  it("returns invalid when sections are missing", async () => {
    const repo = createMockRepo();
    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
      // Missing: customers, conversion_journey, economics, brand, creative_capacity, measurement
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(false);
      expect(result.data.missingSections).toContain("customers");
      expect(result.data.missingSections).toContain("conversion_journey");
      expect(result.data.missingSections).toContain("economics");
      expect(result.data.missingSections).toContain("brand");
      expect(result.data.missingSections).toContain("creative_capacity");
      expect(result.data.missingSections).toContain("measurement");
    }
  });

  it("treats empty objects as missing", async () => {
    const repo = createMockRepo();
    const profile: Record<string, JsonValue> = {
      business: {},
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      conversion_journey: { steps: [] },
      economics: { ltv: 500 },
      brand: { tone: "professional" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: ["revenue"] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(false);
      expect(result.data.missingSections).toContain("business");
    }
  });

  it("blocks approval when open conflicts exist", async () => {
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
      brand: { tone: "professional" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: ["revenue"] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(false);
      expect(result.data.unresolvedConflicts).toHaveLength(1);
    }
  });

  it("passes when no open conflicts", async () => {
    const repo = createMockRepo({
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    const profile: Record<string, JsonValue> = {
      business: { name: "Acme" },
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      conversion_journey: { steps: [] },
      economics: { ltv: 500 },
      brand: { tone: "professional" },
      creative_capacity: { capacity: "high" },
      measurement: { kpis: ["revenue"] },
    };

    const result = await validateProfile(repo, "biz-1", "ws-1", profile);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
      expect(result.data.unresolvedConflicts).toHaveLength(0);
    }
  });
});

// ─── checkRequiredFieldsFulfilled ─────────────────────────────────────────────

describe("compiler.checkRequiredFieldsFulfilled", () => {
  it("returns fulfilled when all required sections have answers", async () => {
    const questions: OnboardingQuestion[] = [
      { id: "q-1", factKey: "business", status: "answered", answer: { name: "Acme" } } as OnboardingQuestion,
      { id: "q-2", factKey: "offers", status: "answered", answer: { primary: "Widget" } } as OnboardingQuestion,
      { id: "q-3", factKey: "customers", status: "answered", answer: { segment: "B2B" } } as OnboardingQuestion,
      { id: "q-4", factKey: "conversion_journey", status: "answered", answer: { steps: [] } } as OnboardingQuestion,
      { id: "q-5", factKey: "economics", status: "answered", answer: { ltv: 500 } } as OnboardingQuestion,
      { id: "q-6", factKey: "brand", status: "answered", answer: { tone: "pro" } } as OnboardingQuestion,
      { id: "q-7", factKey: "creative_capacity", status: "answered", answer: { cap: "high" } } as OnboardingQuestion,
      { id: "q-8", factKey: "measurement", status: "answered", answer: { kpis: [] } } as OnboardingQuestion,
    ];

    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
    });

    const result = await checkRequiredFieldsFulfilled(repo, "sess-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fulfilled).toBe(true);
      expect(result.data.missingFields).toHaveLength(0);
    }
  });

  it("returns missing fields when sections are not answered", async () => {
    const questions: OnboardingQuestion[] = [
      { id: "q-1", factKey: "business", status: "answered", answer: { name: "Acme" } } as OnboardingQuestion,
      { id: "q-2", factKey: "offers", status: "answered", answer: { primary: "Widget" } } as OnboardingQuestion,
      // Missing: customers, conversion_journey, economics, brand, creative_capacity, measurement
    ];

    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
    });

    const result = await checkRequiredFieldsFulfilled(repo, "sess-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fulfilled).toBe(false);
      expect(result.data.missingFields).toContain("customers");
      expect(result.data.missingFields).toContain("conversion_journey");
      expect(result.data.missingFields).toContain("economics");
      expect(result.data.missingFields).toContain("brand");
      expect(result.data.missingFields).toContain("creative_capacity");
      expect(result.data.missingFields).toContain("measurement");
    }
  });

  it("treats open questions as not fulfilled", async () => {
    const questions: OnboardingQuestion[] = [
      { id: "q-1", factKey: "business", status: "open", answer: null } as OnboardingQuestion,
      { id: "q-2", factKey: "offers", status: "dismissed", answer: null } as OnboardingQuestion,
    ];

    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: questions, total: questions.length },
      }),
    });

    const result = await checkRequiredFieldsFulfilled(repo, "sess-1", "ws-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.fulfilled).toBe(false);
      expect(result.data.missingFields).toContain("business");
      expect(result.data.missingFields).toContain("offers");
    }
  });
});
