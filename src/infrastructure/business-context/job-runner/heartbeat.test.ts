import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { startHeartbeat } from './heartbeat'

function fakeJob(overrides: Partial<ContextJob> = {}): ContextJob {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    jobType: 'source_processing',
    status: 'running',
    attemptCount: 1,
    idempotencyKey: 'idem-1',
    input: {},
    output: null,
    error: null,
    errorClass: null,
    lockedBy: 'worker-1',
    lockedAt: new Date(),
    heartbeatAt: null,
    startedAt: new Date(),
    nextRunAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ContextJob
}

function fakeRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  return {
    createContextJob: vi.fn(),
    getContextJob: vi.fn(),
    getContextJobByIdempotencyKey: vi.fn(),
    listContextJobs: vi.fn(),
    claimRunnableJobs: vi.fn(),
    updateContextJob: vi.fn().mockResolvedValue({ ok: true, data: fakeJob() } as any),
    createStageEvent: vi.fn(),
    listStageEvents: vi.fn(),
    createSource: vi.fn(),
    getSource: vi.fn(),
    listSources: vi.fn(),
    updateSource: vi.fn(),
    createFact: vi.fn(),
    listFacts: vi.fn(),
    getQualityGateResult: vi.fn(),
    createQualityGateResult: vi.fn(),
    getCircuitBreakerState: vi.fn(),
    upsertCircuitBreakerState: vi.fn(),
    createAuditEntry: vi.fn(),
    listAuditEntries: vi.fn(),
    createProcessingRun: vi.fn(),
    getProcessingRun: vi.fn(),
    listProcessingRuns: vi.fn(),
    updateProcessingRun: vi.fn(),
    createConflict: vi.fn(),
    listConflicts: vi.fn(),
    getProfile: vi.fn(),
    createProfile: vi.fn(),
    listProfiles: vi.fn(),
    updateProfile: vi.fn(),
    createBusiness: vi.fn(),
    getBusiness: vi.fn(),
    listBusinesses: vi.fn(),
    updateBusiness: vi.fn(),
    createMetaConnection: vi.fn(),
    getMetaConnection: vi.fn(),
    listMetaConnections: vi.fn(),
    updateMetaConnection: vi.fn(),
    createOnboarding: vi.fn(),
    getOnboarding: vi.fn(),
    listOnboardings: vi.fn(),
    updateOnboarding: vi.fn(),
    ...overrides,
  } as unknown as RepositoryPort
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('startHeartbeat', () => {
  it('calls updateContextJob on each interval tick', async () => {
    const repo = fakeRepo()
    const job = fakeJob()
    const isActive = () => true

    startHeartbeat(job, repo, isActive)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).toHaveBeenCalledTimes(2)
  })

  it('does not call updateContextJob when isActive returns false', async () => {
    const repo = fakeRepo()
    const job = fakeJob()
    const isActive = () => false

    startHeartbeat(job, repo, isActive)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('does not produce unhandled rejection when repo.updateContextJob throws', async () => {
    const repo = fakeRepo({
      updateContextJob: vi.fn().mockRejectedValue(new Error('db down')),
    })
    const job = fakeJob()
    const isActive = () => true

    startHeartbeat(job, repo, isActive)

    // advance multiple ticks — first throws, second should still run
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(repo.updateContextJob).toHaveBeenCalledTimes(2)
  })

  it('stop() clears the interval — no further calls', async () => {
    const repo = fakeRepo()
    const job = fakeJob()
    const isActive = () => true

    const { stop } = startHeartbeat(job, repo, isActive)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).toHaveBeenCalledTimes(1)

    stop()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).toHaveBeenCalledTimes(1) // no new call
  })

  it('stop() clears the interval even when repo is failing', async () => {
    const repo = fakeRepo({
      updateContextJob: vi.fn().mockRejectedValue(new Error('db down')),
    })
    const job = fakeJob()
    const isActive = () => true

    const { stop } = startHeartbeat(job, repo, isActive)

    await vi.advanceTimersByTimeAsync(30_000) // throws, swallowed
    stop()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(repo.updateContextJob).toHaveBeenCalledTimes(1) // no second call
  })
})
