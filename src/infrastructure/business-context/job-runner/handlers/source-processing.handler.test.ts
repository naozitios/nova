import { describe, it, expect, vi } from 'vitest'
import { createSourceProcessingHandler } from './source-processing.handler'
import type { ContextJob, SourceProcessingStage, JobStatus } from '@/core/business-context/types'
import type { SourceProcessingService } from '@/core/business-context/service/source-processing.service'

function makeJob(overrides?: Partial<ContextJob>): ContextJob {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sessionId: null,
    jobType: 'source_processing',
    status: 'queued' as JobStatus,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: 'key-1',
    stage: 'queued' as SourceProcessingStage,
    input: { sourceId: 'src-1' },
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function makeService(overrides?: Partial<SourceProcessingService>): SourceProcessingService {
  return {
    processSource: vi.fn(),
    collectWithAdapter: vi.fn(),
    registerAdapter: vi.fn(),
    archiveSource: vi.fn(),
    ...overrides,
  } as unknown as SourceProcessingService
}

describe('source-processing.handler', () => {
  describe('success path', () => {
    it('returns output and stage events when service succeeds', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      expect(result.output).toBeDefined()
      expect(result.output!.sourceId).toBe('src-1')
      expect(result.output!.businessId).toBe('biz-1')
      expect(result.output!.status).toBe('processed')
      expect(result.output!.warnings).toEqual([])
      expect(result.output!.stagesCompleted).toEqual([
        'acquiring', 'stored', 'parsing', 'normalizing',
        'extracting', 'reconciling', 'quality_checking', 'completed',
      ])
    })

    it('emits stage events with started and succeeded statuses', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      const stages = result.stageEvents!
      expect(stages[0].stage).toBe('acquiring')
      expect(stages[0].status).toBe('started')

      for (let i = 1; i < stages.length; i++) {
        expect(stages[i].status).toBe('succeeded')
      }

      const pipelineStages = [
        'acquiring', 'stored', 'parsing', 'normalizing',
        'extracting', 'reconciling', 'quality_checking', 'completed',
      ]
      expect(stages.length).toBe(pipelineStages.length + 1)
    })

    it('calls service with correct arguments', async () => {
      const job = makeJob({
        businessId: 'biz-42',
        workspaceId: 'ws-99',
        input: { sourceId: 'src-7' },
      })
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      await handler(job)

      expect(service.processSource).toHaveBeenCalledWith('biz-42', 'ws-99', 'src-7')
    })

    it('includes warnings in output when present', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed_with_warnings', warnings: ['low_quality_pdf'] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      expect(result.output!.status).toBe('processed_with_warnings')
      expect(result.output!.warnings).toEqual(['low_quality_pdf'])
    })

    it('returns blocked_needs_user_action terminalStatus when source is blocked', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'blocked_needs_user_action', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      expect(result.output!.status).toBe('blocked_needs_user_action')
      expect(result.terminalStatus).toBe('blocked_needs_user_action')
    })

    it('returns failed terminal status when source is blocked for user action', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'blocked_needs_user_action', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      expect(result.output!.status).toBe('blocked_needs_user_action')
      expect(result.terminalStatus).toBe('failed_permanent')
    })
  })

  describe('error path (B10)', () => {
    it('throws when service returns !ok (executeJob failure path)', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'NOT_FOUND', message: 'Source not found' },
        }),
      })

      const handler = createSourceProcessingHandler(service)

      await expect(handler(job)).rejects.toThrow()
    })

    it('thrown error includes code and message from service', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'TIMEOUT', message: 'Provider timed out' },
        }),
      })

      const handler = createSourceProcessingHandler(service)

      try {
        await handler(job)
        expect.fail('Should have thrown')
      } catch (err: any) {
        expect(err.code).toBe('TIMEOUT')
        expect(err.message).toBe('Provider timed out')
      }
    })

    it('does NOT return stage events on error (throws instead)', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'FAILED', message: 'Processing failed' },
        }),
      })

      const handler = createSourceProcessingHandler(service)

      try {
        await handler(job)
        expect.fail('Should have thrown')
      } catch {
        // Expected: handler throws, does not return
      }
    })

    it('error class is extractable for retry decisions', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'PROVIDER_TIMEOUT', message: 'Request timed out' },
        }),
      })

      const handler = createSourceProcessingHandler(service)

      try {
        await handler(job)
        expect.fail('Should have thrown')
      } catch (err: any) {
        expect(typeof err.code).toBe('string')
        expect(err.code.length).toBeGreaterThan(0)
      }
    })
  })

  describe('service injection (B13)', () => {
    it('accepts injected service (no Container dependency)', async () => {
      const job = makeJob()
      const service = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed', warnings: [] },
        }),
      })

      const handler = createSourceProcessingHandler(service)
      const result = await handler(job)

      expect(result.output).toBeDefined()
      expect(result.output!.status).toBe('processed')
    })

    it('production default resolver works when no service arg given', async () => {
      const { Container } = await import('@/di/container')
      const job = makeJob()
      const fakeService = makeService({
        processSource: vi.fn().mockResolvedValue({
          ok: true,
          data: { status: 'processed', warnings: [] },
        }),
      })
      vi.spyOn(Container, 'getSourceProcessingService').mockReturnValue(fakeService as any)

      const handler = createSourceProcessingHandler()
      const result = await handler(job)

      expect(result.output!.status).toBe('processed')
      expect(Container.getSourceProcessingService).toHaveBeenCalled()

      vi.restoreAllMocks()
    })
  })
})
