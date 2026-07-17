import { describe, expect, it, vi } from 'vitest'

import type { RepositoryPort } from '@/core/business-context/repository.port'
import type { ContextJob } from '@/core/business-context/types'
import type { CircuitBreakerAdapter } from '../breaker/circuit-breaker'
import type { ProcessingVisibilityWriter } from '../processing-visibility'
import { executeJob } from './execution'

const job: ContextJob = {
  id: 'job-1',
  workspaceId: 'workspace-1',
  businessId: 'business-1',
  sessionId: null,
  jobType: 'source_processing',
  status: 'running',
  attemptCount: 0,
  maxAttempts: 3,
  idempotencyKey: 'idem-1',
  stage: 'quality_checking',
  input: { sourceId: 'source-1' },
  output: null,
  error: null,
  errorClass: null,
  retryPolicy: {},
  nextRunAt: null,
  lockedBy: 'worker-1',
  lockedAt: new Date('2026-01-01T00:00:00.000Z'),
  heartbeatAt: new Date('2026-01-01T00:00:00.000Z'),
  stageTimeoutSeconds: 60,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  completedAt: null,
}

describe('executeJob', () => {
  it('maps user-action terminal source outcomes to failed permanent job status', async () => {
    const updateContextJob = vi.fn().mockResolvedValue({ ok: true, data: job })
    const appendStageEvent = vi.fn().mockResolvedValue({ ok: true, data: {} })

    await executeJob({
      job,
      handler: async () => ({ terminalStatus: 'blocked_needs_user_action' }),
      repo: { updateContextJob } as unknown as RepositoryPort,
      breaker: { recordSuccess: vi.fn() } as unknown as CircuitBreakerAdapter,
      visibility: { appendStageEvent } as unknown as ProcessingVisibilityWriter,
      workerId: 'worker-1',
      providerOverride: undefined,
      isActive: () => false,
    })

    expect(updateContextJob).toHaveBeenCalledWith(
      'workspace-1',
      'job-1',
      expect.objectContaining({ status: 'failed_permanent' }),
    )
  })
})
