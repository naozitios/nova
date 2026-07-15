import { vi } from "vitest";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import { ProfileVersionStatus } from "../../../src/core/business-context/types";
import type {
  BusinessProfileVersion,
  ContextFact,
  ContextConflict,
  ContextSource,
  ContextJob,
  OnboardingSession,
  Business,
} from "../../../src/core/business-context/types";

export function createMockRepo(
  overrides: Partial<RepositoryPort> = {},
): RepositoryPort {
  const now = new Date();
  return {
    // Businesses
    createBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "biz-1",
        workspaceId: "ws-1",
        name: "Acme Corp",
        websiteUrl: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      } as Business,
    }),
    getBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "biz-1",
        workspaceId: "ws-1",
        name: "Acme Corp",
        websiteUrl: null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      } as Business,
    }),
    listBusinesses: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateBusiness: vi.fn(),

    // Onboarding sessions
    createOnboardingSession: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: "os-1",
        workspaceId: "ws-1",
        businessId: "biz-1",
        status: "created",
        currentStep: null,
        startedBy: "user-1",
        startedAt: now,
        completedAt: null,
        error: null,
      } as OnboardingSession,
    }),
    getOnboardingSession: vi.fn(),
    listOnboardingSessions: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "os-1",
            workspaceId: "ws-1",
            businessId: "biz-1",
            status: "created",
            currentStep: null,
            startedBy: "user-1",
            startedAt: now,
            completedAt: null,
            error: null,
          } as OnboardingSession,
        ],
        total: 1,
      },
    }),
    updateOnboardingSession: vi.fn(),

    // Context sources
    createContextSource: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        ok: true,
        data: {
          id: `src-${Date.now()}`,
          ...data,
          createdAt: now,
        } as ContextSource,
      }),
    ),
    getContextSource: vi.fn().mockImplementation((_wsId, sourceId) =>
      Promise.resolve({
        ok: true,
        data: sourceId === "00000000-0000-0000-0000-000000000099"
          ? null
          : ({
              id: sourceId,
              workspaceId: "ws-1",
              businessId: "biz-1",
              sourceType: "website",
              sourceName: "Company Website",
              externalReference: "https://acme.example.com",
              status: "registered",
              currentStage: null,
              terminalOutcome: null,
              metadata: {},
              collectedAt: now,
              createdAt: now,
            } as ContextSource),
      }),
    ),
    listContextSources: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "src-1",
            workspaceId: "ws-1",
            businessId: "biz-1",
            sourceType: "website",
            sourceName: "Company Website",
            externalReference: "https://acme.example.com",
            status: "registered",
            currentStage: null,
            terminalOutcome: null,
            metadata: {},
            collectedAt: now,
            createdAt: now,
          } as ContextSource,
        ],
        total: 1,
      },
    }),
    updateContextSource: vi.fn().mockImplementation((_wsId, _srcId, data) =>
      Promise.resolve({
        ok: true,
        data: { id: "src-1", ...data, createdAt: now } as ContextSource,
      }),
    ),
    archiveSource: vi.fn().mockImplementation((_wsId, _srcId) =>
      Promise.resolve({
        ok: true,
        data: {
          id: "src-1",
          workspaceId: "ws-1",
          businessId: "biz-1",
          sourceType: "website",
          sourceName: "Company Website",
          externalReference: "https://acme.example.com",
          status: "archived",
          currentStage: null,
          terminalOutcome: "archived",
          metadata: {},
          collectedAt: now,
          createdAt: now,
        } as ContextSource,
      }),
    ),

    // Source documents
    createSourceDocument: vi.fn(),
    getSourceDocument: vi.fn(),
    listSourceDocuments: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    getSourceDocumentByHash: vi.fn(),
    updateSourceDocument: vi.fn(),

    // Context facts
    createContextFact: vi.fn().mockResolvedValue({
      ok: true,
      data: {} as ContextFact,
    }),
    getContextFact: vi.fn(),
    listContextFacts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [], total: 0 },
    }),
    updateContextFact: vi.fn(),

    // Context conflicts
    createContextConflict: vi.fn(),
    getContextConflict: vi.fn().mockImplementation((_wsId, conflictId) =>
      Promise.resolve({
        ok: true,
        data: conflictId === "00000000-0000-0000-0000-000000000099"
          ? null
          : ({
              id: conflictId,
              workspaceId: "ws-1",
              businessId: "biz-1",
              factKey: "offers.pricing",
              factIds: ["f-1", "f-2"],
              status: "open",
              resolutionFactId: null,
              resolutionNote: null,
              resolvedBy: null,
              createdAt: now,
              resolvedAt: null,
            } as ContextConflict),
      }),
    ),
    listContextConflicts: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "c-1",
            workspaceId: "ws-1",
            businessId: "biz-1",
            factKey: "offers.pricing",
            factIds: ["f-1", "f-2"],
            status: "open",
            resolutionFactId: null,
            resolutionNote: null,
            resolvedBy: null,
            createdAt: now,
            resolvedAt: null,
          } as ContextConflict,
        ],
        total: 1,
      },
    }),
    resolveContextConflict: vi.fn().mockImplementation((_wsId, conflictId, resFactId, _resolvedBy, note) =>
      Promise.resolve({
        ok: true,
        data: {
          id: conflictId,
          workspaceId: "ws-1",
          businessId: "biz-1",
          factKey: "offers.pricing",
          factIds: ["f-1", "f-2"],
          status: "resolved",
          resolutionFactId: resFactId,
          resolutionNote: note ?? null,
          resolvedBy: "user-1",
          createdAt: now,
          resolvedAt: now,
        } as ContextConflict,
      }),
    ),

    // Onboarding questions
    createOnboardingQuestion: vi.fn(),
    getOnboardingQuestion: vi.fn(),
    listOnboardingQuestions: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [], total: 0 },
    }),
    answerOnboardingQuestion: vi.fn(),

    // Profile versions
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
        changeSummary: "Initial",
        createdBy: "user-1",
        createdAt: now,
        approvedBy: "user-1",
        approvedAt: now,
      } as BusinessProfileVersion,
    }),
    getProfileVersion: vi.fn(),
    listProfileVersions: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [], total: 0 },
    }),
    getCurrentProfileVersion: vi.fn().mockResolvedValue({ ok: true, data: null }),
    supersedeProfileVersions: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    approveProfileVersion: vi.fn(),
    restoreProfileVersion: vi.fn(),

    // Context jobs
    createContextJob: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        ok: true,
        data: {
          id: `job-${Date.now()}`,
          ...data,
          createdAt: now,
        } as ContextJob,
      }),
    ),
    getContextJob: vi.fn(),
    getContextJobByIdempotencyKey: vi.fn(),
    listContextJobs: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    claimRunnableJobs: vi.fn(),
    updateContextJob: vi.fn(),

    // Processing runs
    createProcessingRun: vi.fn(),
    getProcessingRun: vi.fn(),
    listProcessingRuns: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateProcessingRun: vi.fn(),

    // Stage events
    createStageEvent: vi.fn(),
    listStageEvents: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),

    // Quality gates
    createQualityGateResult: vi.fn(),
    listQualityGateResults: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),

    // Circuit breaker
    getCircuitBreaker: vi.fn(),
    upsertCircuitBreaker: vi.fn(),

    // Audit
    createAuditLog: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    listAuditLogs: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),

    ...overrides,
  } as RepositoryPort;
}
