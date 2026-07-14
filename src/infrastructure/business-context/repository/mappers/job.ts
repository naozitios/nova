import type { ContextJob, ProcessingRun, StageEvent } from '@/core/business-context/types'
import { asJson, asJsonRecord, asJsonRecordOrNull, type Row } from './helpers'

export function mapContextJob(r: Row): ContextJob {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sessionId: (r.session_id as string) ?? null,
    jobType: r.job_type as string,
    status: r.status as ContextJob['status'],
    attemptCount: Number(r.attempt_count),
    maxAttempts: Number(r.max_attempts),
    idempotencyKey: r.idempotency_key as string,
    stage: (r.stage as ContextJob['stage']) ?? null,
    input: asJsonRecord(r.input),
    output: asJsonRecordOrNull(r.output),
    error: asJson(r.error),
    errorClass: (r.error_class as string) ?? null,
    retryPolicy: asJsonRecord(r.retry_policy),
    nextRunAt: r.next_run_at ? new Date(r.next_run_at as string) : null,
    lockedBy: (r.locked_by as string) ?? null,
    lockedAt: r.locked_at ? new Date(r.locked_at as string) : null,
    heartbeatAt: r.heartbeat_at ? new Date(r.heartbeat_at as string) : null,
    stageTimeoutSeconds: r.stage_timeout_seconds != null ? Number(r.stage_timeout_seconds) : null,
    createdAt: new Date(r.created_at as string),
    startedAt: r.started_at ? new Date(r.started_at as string) : null,
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
  }
}

export function mapProcessingRun(r: Row): ProcessingRun {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceId: r.source_id as string,
    jobId: (r.job_id as string) ?? null,
    pipelineType: r.pipeline_type as string,
    status: r.status as string,
    currentStage: r.current_stage as ProcessingRun['currentStage'],
    terminalOutcome: (r.terminal_outcome as ProcessingRun['terminalOutcome']) ?? null,
    attemptCount: Number(r.attempt_count),
    pagesProcessed: Number(r.pages_processed),
    slidesProcessed: Number(r.slides_processed),
    documentsCreated: Number(r.documents_created),
    factsExtracted: Number(r.facts_extracted),
    warningsCount: Number(r.warnings_count),
    creditsConsumed: Number(r.credits_consumed),
    qualitySummary: asJsonRecord(r.quality_summary),
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
  }
}

export function mapStageEvent(r: Row): StageEvent {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    runId: r.run_id as string,
    jobId: (r.job_id as string) ?? null,
    sourceId: r.source_id as string,
    stage: r.stage as StageEvent['stage'],
    status: r.status as StageEvent['status'],
    attempt: Number(r.attempt),
    workerId: (r.worker_id as string) ?? null,
    provider: (r.provider as string) ?? null,
    providerRequestId: (r.provider_request_id as string) ?? null,
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    pagesProcessed: Number(r.pages_processed),
    slidesProcessed: Number(r.slides_processed),
    bytesProcessed: Number(r.bytes_processed),
    documentsCreated: Number(r.documents_created),
    factsExtracted: Number(r.facts_extracted),
    warningsCount: Number(r.warnings_count),
    creditsConsumed: Number(r.credits_consumed),
    errorClass: (r.error_class as string) ?? null,
    error: asJson(r.error),
    metadata: asJsonRecord(r.metadata),
  }
}
