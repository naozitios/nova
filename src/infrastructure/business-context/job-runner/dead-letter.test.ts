import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest'
import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { markNoHandler, sweepStalled, recoverStalled } from './dead-letter'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fakeJob(overrides: Partial<ContextJob> = {}): ContextJob {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sessionId: null,
    jobType: 'source_processing',
    status: 'running',
    attemptCount: 1,
    maxAttempts: 4,
    idempotencyKey: 'idem-1',
    stage: null,
    input: {},
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: 'worker-1',
    lockedAt: new Date(),
    heartbeatAt: null,
    stageTimeoutSeconds: null,
    createdAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  } as ContextJob
}

function fakeRepo(overrides: Partial<Mocked<RepositoryPort>> = {}): Mocked<RepositoryPort> {
  return {
    createContextJob: vi.fn(),
    getContextJob: vi.fn(),
    getContextJobByIdempotencyKey: vi.fn(),
    listContextJobs: vi.fn(),
    claimRunnableJobs: vi.fn(),
    updateContextJob: vi.fn().mockResolvedValue({ ok: true, data: fakeJob() }),
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
  } as Mocked<RepositoryPort>
}

// ─── Tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('markNoHandler', () => {
  it('sets failed_permanent with NO_HANDLER error code', async () => {
    const repo = fakeRepo()
    const job = fakeJob({ jobType: 'unknown_type' })

    await markNoHandler(job, repo)

    expect(repo.updateContextJob).toHaveBeenCalledOnce()
    const [workspaceId, jobId, patch] = repo.updateContextJob.mock.calls[0]
    expect(workspaceId).toBe('ws-1')
    expect(jobId).toBe('job-1')
    expect(patch.status).toBe('failed_permanent')
    expect(patch.errorClass).toBe('validation')
    expect(patch.error).toEqual({
      code: 'NO_HANDLER',
      message: 'No handler registered for job type: unknown_type',
    })
    expect(patch.completedAt).toBeInstanceOf(Date)
    expect(patch.lockedBy).toBeNull()
    expect(patch.lockedAt).toBeNull()
    expect(patch.heartbeatAt).toBeNull()
  })
})

describe('sweepStalled', () => {
  it('returns early when claimRunnableJobs fails', async () => {
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: false, error: 'db error' }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    expect(repo.claimRunnableJobs).toHaveBeenCalledOnce()
    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('returns early when no candidates returned', async () => {
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('skips jobs missing stageTimeoutSeconds', async () => {
    const job = fakeJob({ stageTimeoutSeconds: null, heartbeatAt: new Date() })
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [job] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('skips jobs missing heartbeatAt', async () => {
    const job = fakeJob({ stageTimeoutSeconds: 60, heartbeatAt: null })
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [job] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('skips jobs that are not actually stalled (recent heartbeat)', async () => {
    const now = new Date()
    const recentHeartbeat = new Date(now.getTime() - 1000) // 1s ago, timeout 60s → not stalled
    const job = fakeJob({
      stageTimeoutSeconds: 60,
      heartbeatAt: recentHeartbeat,
    })
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [job] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    expect(repo.updateContextJob).not.toHaveBeenCalled()
  })

  it('dead-letters stalled job when attempts exhausted', async () => {
    const now = new Date()
    const oldHeartbeat = new Date(now.getTime() - 200_000) // well past stall threshold
    const job = fakeJob({
      attemptCount: 4,
      maxAttempts: 4,
      stageTimeoutSeconds: 60,
      heartbeatAt: oldHeartbeat,
    })
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [job] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    const [, , patch] = repo.updateContextJob.mock.calls[0]
    expect(patch.status).toBe('dead_lettered')
    expect(patch.errorClass).toBe('provider_timeout')
    expect(patch.error).toEqual({
      code: 'STALLED_EXHAUSTED',
      message: 'Job stalled and exceeded max attempts',
    })
    expect(patch.completedAt).toBeInstanceOf(Date)
    expect(patch.lockedBy).toBeNull()
  })

  it('retries stalled job with backoff when attempts remain', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    const now = new Date(1_000_000)
    const oldHeartbeat = new Date(now.getTime() - 200_000)
    const job = fakeJob({
      attemptCount: 1,
      maxAttempts: 4,
      stageTimeoutSeconds: 60,
      heartbeatAt: oldHeartbeat,
      retryPolicy: {},
    })
    const repo = fakeRepo({
      claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [job] }),
    })

    await sweepStalled(repo, 'worker-1', 10)

    const [, , patch] = repo.updateContextJob.mock.calls[0]
    expect(patch.status).toBe('retry_waiting')
    expect(patch.errorClass).toBe('provider_timeout')
    expect(patch.error).toEqual({
      code: 'STALLED_RETRY',
      message: 'Job stalled, scheduling retry',
    })
    expect(patch.nextRunAt).toBeInstanceOf(Date)
    expect((patch.nextRunAt as Date).getTime()).toBeGreaterThan(1_000_000)
    expect(patch.lockedBy).toBeNull()
    expect(patch.heartbeatAt).toBeNull()
  })
})

describe('recoverStalled', () => {
  it('dead-letters when attemptCount >= maxAttempts', async () => {
    const job = fakeJob({ attemptCount: 5, maxAttempts: 5 })
    const repo = fakeRepo()

    await recoverStalled(job, repo)

    const [, , patch] = repo.updateContextJob.mock.calls[0]
    expect(patch.status).toBe('dead_lettered')
    expect(patch.error).toEqual(
      expect.objectContaining({ code: 'STALLED_EXHAUSTED' }),
    )
  })

  it('schedules retry when attemptCount < maxAttempts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(500_000)

    const job = fakeJob({ attemptCount: 2, maxAttempts: 4, retryPolicy: {} })
    const repo = fakeRepo()

    await recoverStalled(job, repo)

    const [, , patch] = repo.updateContextJob.mock.calls[0]
    expect(patch.status).toBe('retry_waiting')
    expect(patch.nextRunAt).toBeInstanceOf(Date)
    expect(patch.error).toEqual(
      expect.objectContaining({ code: 'STALLED_RETRY' }),
    )
  })
})
