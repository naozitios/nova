// ─── Dead-letter ──────────────────────────────────────────────────────────
//
// Transitions jobs that have exhausted their attempts (or that have no
// registered handler) to terminal failure / dead-lettered states and emits
// the corresponding visibility events. Also owns the stall-recovery sweep
// (FR-041), which decides between retry_waiting and dead_lettered using
// job-policy.stalledRecoveryStatus.

import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import type { ProcessingVisibilityWriter } from '../processing-visibility'
import {
  calculateBackoffMs,
  defaultRetryPolicy,
  isJobStalled,
  stalledRecoveryStatus,
} from '@/core/business-context/job-policy'
import { emitStageEvent } from './stage-events'

/**
 * Mark a job as permanently failed with the NO_HANDLER reason. Used when no
 * handler is registered for the job type — never retried.
 */
export async function markNoHandler(
  job: ContextJob,
  repo: RepositoryPort,
): Promise<void> {
  await repo.updateContextJob(job.workspaceId, job.id, {
    status: 'failed_permanent',
    errorClass: 'validation',
    error: {
      code: 'NO_HANDLER',
      message: `No handler registered for job type: ${job.jobType}`,
    },
    completedAt: new Date(),
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
  })
}

/**
 * Stall sweep: find running jobs with stale heartbeats and either reschedule
 * them (retry_waiting) or dead-letter them based on attempt count (FR-041).
 */
export async function sweepStalled(
  repo: RepositoryPort,
  workerId: string,
  batchSize: number,
): Promise<void> {
  const now = new Date()
  const candidates = await repo.claimRunnableJobs(
    { status: 'running', heartbeatExpired: now },
    workerId,
    batchSize,
  )
  if (!candidates.ok) return

  for (const job of candidates.data) {
    if (!job.stageTimeoutSeconds || !job.heartbeatAt) continue
    if (isJobStalled({
      heartbeatAt: job.heartbeatAt,
      stageTimeoutSeconds: job.stageTimeoutSeconds,
      now,
    })) {
      await recoverStalled(job, repo)
    }
  }
}

/**
 * Apply the recovery transition for a single stalled job. The decision is
 * delegated to job-policy.stalledRecoveryStatus.
 */
export async function recoverStalled(
  job: ContextJob,
  repo: RepositoryPort,
): Promise<void> {
  const attempt = job.attemptCount
  const maxAttempts = job.maxAttempts
  const recoveryStatus = stalledRecoveryStatus({ attemptCount: attempt, maxAttempts })

  if (recoveryStatus === 'dead_lettered') {
    // FR-041: exhausted stalled → dead_lettered.
    await repo.updateContextJob(job.workspaceId, job.id, {
      status: 'dead_lettered',
      errorClass: 'provider_timeout',
      error: {
        code: 'STALLED_EXHAUSTED',
        message: 'Job stalled and exceeded max attempts',
      },
      completedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })
  } else {
    // FR-041: retryable stalled → retry_waiting.
    const retryPolicy = { ...defaultRetryPolicy(), ...job.retryPolicy }
    const backoffMs = calculateBackoffMs(attempt, retryPolicy)
    const nextRunAt = new Date(Date.now() + backoffMs)

    await repo.updateContextJob(job.workspaceId, job.id, {
      status: 'retry_waiting',
      nextRunAt,
      errorClass: 'provider_timeout',
      error: {
        code: 'STALLED_RETRY',
        message: 'Job stalled, scheduling retry',
      },
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })
  }
}
