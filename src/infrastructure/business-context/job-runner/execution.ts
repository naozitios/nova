// ─── Execution ────────────────────────────────────────────────────────────
//
// The per-job execute path. Owns heartbeat lifecycle, the handler call,
// success / failure recording, and the post-handler stage-event fan-out.
// Kept separate from the JobRunner facade so the facade stays a thin
// lifecycle manager and the execution flow is testable in isolation.

import type {
  ContextJob,
  SourceProcessingStage,
} from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import type { CircuitBreakerAdapter } from '../circuit-breaker'
import type { ProcessingVisibilityWriter } from '../processing-visibility'
import type { JobHandler } from './handlers/extract.handler'
import { startHeartbeat } from './heartbeat'
import { applyRetryDecision } from './retry'
import { markNoHandler } from './dead-letter'
import { emitStageEvent } from './stage-events'
import { extractErrorClass, sanitizeError } from './errors'

export interface ExecutionContext {
  job: ContextJob
  handler: JobHandler
  repo: RepositoryPort
  breaker: CircuitBreakerAdapter
  visibility: ProcessingVisibilityWriter
  workerId: string
  providerOverride: string | undefined
  isActive: () => boolean
}

export async function executeJob(ctx: ExecutionContext): Promise<void> {
  const { job, handler, repo, breaker, visibility, workerId, providerOverride, isActive } = ctx
  const attempt = job.attemptCount + 1
  const startedAt = new Date()
  const sourceStage = (job.stage as SourceProcessingStage) ?? 'queued'

  // FR-043: Emit started stage event.
  await emitStageEvent(visibility, {
    workspaceId: job.workspaceId,
    businessId: job.businessId,
    runId: job.id,
    jobId: job.id,
    sourceId: (job.input.sourceId as string) ?? '',
    stage: sourceStage,
    status: 'started',
    attempt,
    workerId,
    startedAt,
  })

  const heartbeatTimer = startHeartbeat(job, repo, isActive)

  try {
    const result = await handler(job)
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    clearInterval(heartbeatTimer)

    await repo.updateContextJob(job.workspaceId, job.id, {
      status: 'succeeded',
      output: result.output ?? null,
      completedAt,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })

    // FR-043: Emit succeeded stage event.
    await emitStageEvent(visibility, {
      workspaceId: job.workspaceId,
      businessId: job.businessId,
      runId: job.id,
      jobId: job.id,
      sourceId: (job.input.sourceId as string) ?? '',
      stage: sourceStage,
      status: 'succeeded',
      attempt,
      workerId,
      startedAt,
      completedAt,
      durationMs,
    })

    // FR-042: Record success on circuit breaker.
    if (providerOverride) {
      await breaker.recordSuccess(null, providerOverride)
    }

    // Emit any additional stage events from the handler.
    if (result.stageEvents) {
      for (const evt of result.stageEvents) {
        await emitStageEvent(visibility, {
          ...evt,
          workspaceId: job.workspaceId,
          businessId: job.businessId,
          runId: job.id,
          jobId: job.id,
          sourceId: (job.input.sourceId as string) ?? '',
        })
      }
    }
  } catch (err) {
    clearInterval(heartbeatTimer)
    await handleJobFailure({
      job,
      err,
      attempt,
      startedAt,
      sourceStage,
      repo,
      breaker,
      visibility,
      workerId,
      providerOverride,
    })
  }
}

interface FailureContext extends Omit<ExecutionContext, 'handler' | 'isActive'> {
  err: unknown
  attempt: number
  startedAt: Date
  sourceStage: SourceProcessingStage
}

async function handleJobFailure(ctx: FailureContext): Promise<void> {
  const { job, err, attempt, startedAt, sourceStage, repo, breaker, visibility, workerId, providerOverride } = ctx
  const completedAt = new Date()
  const durationMs = completedAt.getTime() - startedAt.getTime()
  const errorRecord = sanitizeError(err)
  const errorClass = extractErrorClass(err)

  // FR-042: Record failure on circuit breaker.
  if (providerOverride) {
    const isTimeout = errorClass === 'provider_timeout'
    await breaker.recordFailure(null, providerOverride, isTimeout)
  }

  await applyRetryDecision({
    job,
    attempt,
    startedAt,
    errorClass,
    errorRecord,
    durationMs,
    sourceStage,
    workerId,
    repo,
    visibility,
  })
}

/**
 * Top-level dispatch: look up the handler, run it, or fail-fast with
 * NO_HANDLER if no handler is registered.
 */
export async function dispatchJob(
  job: ContextJob,
  handlers: Map<string, JobHandler>,
  deps: Omit<ExecutionContext, 'job' | 'handler'>,
): Promise<void> {
  const handler = handlers.get(job.jobType)
  if (!handler) {
    await markNoHandler(job, deps.repo)
    return
  }
  await executeJob({ ...deps, job, handler })
}
