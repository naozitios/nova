import { vi } from "vitest";
import type { RepositoryPort } from "../../../src/core/business-context/repository.port";
import type { ContextFact, ContextJob } from "../../../src/core/business-context/types";
import {
  createBusinessData,
  createOnboardingSessionData,
} from "./_mock-business-fixture";
import {
  createContextSourceData,
  createContextSourceFromId,
  createArchivedSourceData,
  createContextConflictData,
  createContextConflictListData,
  createResolvedConflictData,
  createProfileVersionData,
} from "./_mock-context-fixture";

export function createMockRepo(
  overrides: Partial<RepositoryPort> = {},
): RepositoryPort {
  const now = new Date();
  return {
    // Businesses
    createBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: createBusinessData(now),
    }),
    getBusiness: vi.fn().mockResolvedValue({
      ok: true,
      data: createBusinessData(now),
    }),
    listBusinesses: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateBusiness: vi.fn(),

    // Onboarding sessions
    createOnboardingSession: vi.fn().mockResolvedValue({
      ok: true,
      data: createOnboardingSessionData(now),
    }),
    getOnboardingSession: vi.fn(),
    listOnboardingSessions: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [createOnboardingSessionData(now)],
        total: 1,
      },
    }),
    updateOnboardingSession: vi.fn(),

    // Context sources
    createContextSource: vi.fn().mockImplementation((data) =>
      Promise.resolve({
        ok: true,
        data: { id: `src-${Date.now()}`, ...data, createdAt: now },
      }),
    ),
    getContextSource: vi.fn().mockImplementation((_wsId, sourceId) =>
      Promise.resolve({
        ok: true,
        data: createContextSourceFromId(sourceId, now),
      }),
    ),
    listContextSources: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [createContextSourceData(now)], total: 1 },
    }),
    updateContextSource: vi.fn().mockImplementation((_wsId, _srcId, data) =>
      Promise.resolve({
        ok: true,
        data: { id: "src-1", ...data, createdAt: now },
      }),
    ),
    archiveSource: vi.fn().mockImplementation((_wsId, _srcId) =>
      Promise.resolve({
        ok: true,
        data: createArchivedSourceData(now),
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
        data: createContextConflictData(conflictId, now),
      }),
    ),
    listContextConflicts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: createContextConflictListData(now), total: 1 },
    }),
    resolveContextConflict: vi.fn().mockImplementation(
      (_wsId, conflictId, resFactId, _resolvedBy, note) =>
        Promise.resolve({
          ok: true,
          data: createResolvedConflictData(conflictId, resFactId, note, now),
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

    // Atomic onboarding approval (RPC)
    approveOnboardingV1: vi.fn().mockResolvedValue({
      ok: true,
      data: createProfileVersionData(now),
    }),

    // Profile versions
    createProfileVersion: vi.fn().mockResolvedValue({
      ok: true,
      data: createProfileVersionData(now),
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
        data: { id: `job-${Date.now()}`, ...data, createdAt: now } as ContextJob,
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
