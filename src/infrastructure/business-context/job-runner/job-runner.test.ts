import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { JobRunner } from './job-runner'

vi.mock('./lease', () => ({
  claimJobs: vi.fn(),
}))

vi.mock('./dead-letter', () => ({
  sweepStalled: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./execution', () => ({
  dispatchJob: vi.fn(),
}))

vi.mock('./errors', () => ({
  sanitizeError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

function makeJob(overrides: Partial<ContextJob> = {}): ContextJob {
  return {
    id: overrides.id ?? 'job-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    jobType: 'source_processing',
    status: 'queued',
    input: {},
    attemptCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ContextJob
}

function makeRepo(): RepositoryPort {
  return {
    claimRunnableJobs: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    updateContextJob: vi.fn().mockResolvedValue({ ok: true }),
  } as unknown as RepositoryPort
}

async function waitForCall(mock: ReturnType<typeof vi.fn>): Promise<void> {
  await new Promise<void>((resolve) => {
    const check = () => {
      if (mock.mock.calls.length > 0) resolve()
      else setTimeout(check, 5)
    }
    check()
  })
}

describe('JobRunner', () => {
  let runner: JobRunner

  afterEach(async () => {
    vi.clearAllMocks()
    await new Promise((r) => setTimeout(r, 5))
  })

  describe('B11 shutdown race — state machine', () => {
    it('claim resolving during grace window: dispatches and stop waits drain', async () => {
      const { claimJobs } = await import('./lease')
      const { dispatchJob } = await import('./execution')
      const mockedClaim = vi.mocked(claimJobs)
      const mockedDispatch = vi.mocked(dispatchJob)

      const job = makeJob({ id: 'grace-job' })
      let claimResolve: ((jobs: ContextJob[]) => void) | null = null
      mockedClaim.mockImplementation(
        () => new Promise<ContextJob[]>((r) => { claimResolve = r }),
      )

      let handlerDone = false
      mockedDispatch.mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 60))
        handlerDone = true
      })

      runner = new JobRunner(makeRepo(), {
        pollIntervalMs: 10_000,
        stallSweepIntervalMs: 10_000,
        shutdownTimeoutMs: 5_000,
        maxConcurrency: 5,
      })
      runner.start()

      const cyclePromise = (runner as any).pollCycle() as Promise<void>
      await waitForCall(mockedClaim)

      const stopPromise = runner.stop()
      let stopResolved = false
      stopPromise.then(() => { stopResolved = true })

      // Grace window open — stop must not resolve yet
      await new Promise((r) => setTimeout(r, 30))
      expect(stopResolved).toBe(false)

      // Claim resolves within grace — dispatch fires
      claimResolve!([job])
      await waitForCall(mockedDispatch)
      expect(mockedDispatch).toHaveBeenCalled()

      // Handler still running — stop must wait for it
      await new Promise((r) => setTimeout(r, 20))
      expect(stopResolved).toBe(false)
      expect(handlerDone).toBe(false)

      // Handler completes — stop resolves
      await Promise.all([cyclePromise, stopPromise])
      expect(handlerDone).toBe(true)
      expect(stopResolved).toBe(true)
    })

    it('claim resolving after deadline: no dispatch', async () => {
      const { claimJobs } = await import('./lease')
      const { dispatchJob } = await import('./execution')
      const mockedClaim = vi.mocked(claimJobs)
      const mockedDispatch = vi.mocked(dispatchJob)

      const job = makeJob({ id: 'late-job' })
      let claimResolve: ((jobs: ContextJob[]) => void) | null = null
      mockedClaim.mockImplementation(
        () => new Promise<ContextJob[]>((r) => { claimResolve = r }),
      )
      mockedDispatch.mockResolvedValue(undefined)

      const repo = makeRepo()
      runner = new JobRunner(repo, {
        pollIntervalMs: 10_000,
        stallSweepIntervalMs: 10_000,
        shutdownTimeoutMs: 50,
        maxConcurrency: 5,
      })
      runner.start()

      const cyclePromise = (runner as any).pollCycle() as Promise<void>
      await waitForCall(mockedClaim)

      const stopPromise = runner.stop()
      await stopPromise

      // Claim resolves after stop returned — dispatch must NOT happen
      claimResolve!([job])
      await new Promise((r) => setTimeout(r, 100))
      await cyclePromise

      expect(mockedDispatch).not.toHaveBeenCalled()

      // Each late-claimed job must be restored to full queued runnable state
      expect(repo.updateContextJob).toHaveBeenCalledWith(
        job.workspaceId,
        job.id,
        {
          status: 'queued',
          startedAt: null,
          lockedBy: null,
          lockedAt: null,
          heartbeatAt: null,
        },
      )
    })

    it('restart after stop: new claims dispatch', async () => {
      const { claimJobs } = await import('./lease')
      const { dispatchJob } = await import('./execution')
      const mockedClaim = vi.mocked(claimJobs)
      const mockedDispatch = vi.mocked(dispatchJob)

      const job = makeJob({ id: 'restart-job' })
      mockedClaim
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([job])
      mockedDispatch.mockResolvedValue(undefined)

      runner = new JobRunner(makeRepo(), {
        pollIntervalMs: 10_000,
        stallSweepIntervalMs: 10_000,
        shutdownTimeoutMs: 5_000,
        maxConcurrency: 5,
      })

      // First cycle — no jobs claimed
      runner.start()
      const cycle1 = (runner as any).pollCycle() as Promise<void>
      await cycle1
      expect(mockedClaim).toHaveBeenCalledTimes(1)
      expect(mockedDispatch).not.toHaveBeenCalled()

      await runner.stop()
      vi.clearAllMocks()

      // Restart — must dispatch fresh claim
      mockedClaim.mockResolvedValueOnce([job])
      mockedDispatch.mockResolvedValue(undefined)
      runner.start()
      const cycle2 = (runner as any).pollCycle() as Promise<void>
      await waitForCall(mockedDispatch)
      await cycle2

      expect(mockedClaim).toHaveBeenCalledTimes(1)
      expect(mockedDispatch).toHaveBeenCalled()
      await runner.stop()
    })
  })
})
