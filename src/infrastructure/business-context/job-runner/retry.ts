// ─── Retry ────────────────────────────────────────────────────────────────
//
// Thin orchestration layer over the pure retry functions in core/job-policy.
// Decides between retry_waiting and failed_permanent, applies the chosen
// state to the job, and emits the corresponding stage event (FR-043).

import type { ContextJob, JsonValue } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import type { ProcessingVisibilityWriter } from '../processing-visibility'
import {
  calculateBackoffMs,
  defaultRetryPolicy,
  nextRetryStatus,
} from '@/core/business-context/job-policy'
import { emitStageEvent } from './stage-events'

export interface ApplyRetryParams {
  job: ContextJob
  attempt: number
  startedAt: Date
  errorClass: string | null
  errorRecord: JsonValue | null
  durationMs: number
  sourceStage: string
  workerId: string
  repo: RepositoryPort
  visibility: ProcessingVisibilityWriter
}

/**
 * Apply the next retry or permanent-failure transition for a job that just
 * failed. The decision is delegated to job-policy.nextRetryStatus; the side
 * effects (repo update + stage event) live here.
 */
export async function applyRetryDecision(
  params: ApplyRetryParams,
): Promise<void> {
  const {
    job, attempt, startedAt, errorClass, errorRecord,
    durationMs, sourceStage, workerId, repo, visibility,
  } = params

  const maxAttempts = job.maxAttempts
  const retryPolicy = { ...defaultRetryPolicy(), ...job.retryPolicy }
  const nextStatus = nextRetryStatus({ errorClass, attemptCount: attempt, maxAttempts })

  if (nextStatus === 'failed_permanent') {
    await repo.updateContextJob(job.workspaceId, job.id, {
      status: 'failed_permanent',
      errorClass,
      error: errorRecord,
      completedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })

    await emitStageEvent(visibility, {
      workspaceId: job.workspaceId,
      businessId: job.businessId,
      runId: job.id,
      jobId: job.id,
      sourceId: (job.input.sourceId as string) ?? '',
      stage: (sourceStage as ContextJob['stage']) ?? 'queued',
      status: 'failed_permanent',
      attempt,
      workerId,
      startedAt,
      completedAt: new Date(),
      durationMs,
      errorClass,
      error: errorRecord,
    })
  } else if (nextStatus === 'retry_waiting') {
    const backoffMs = calculateBackoffMs(attempt, retryPolicy)
    const nextRunAt = new Date(Date.now() + backoffMs)

    await repo.updateContextJob(job.workspaceId, job.id, {
      status: 'retry_waiting',
      attemptCount: attempt,
      nextRunAt,
      errorClass,
      error: errorRecord,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })

    await emitStageEvent(visibility, {
      workspaceId: job.workspaceId,
      businessId: job.businessId,
      runId: job.id,
      jobId: job.id,
      sourceId: (job.input.sourceId as string) ?? '',
      stage: (sourceStage as ContextJob['stage']) ?? 'queued',
      status: 'failed_retryable',
      attempt,
      workerId,
      startedAt,
      completedAt: new Date(),
      durationMs,
      errorClass,
      error: errorRecord,
    })
  }
}
