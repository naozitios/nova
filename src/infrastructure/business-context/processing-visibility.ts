import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ProcessingRun,
  ServiceResult,
  SourceProcessingStage,
  StageEvent,
  StageEventStatus,
} from '@/core/business-context/types'
import { getSupabaseServiceClient } from './supabase-client'
import type { JsonValue } from '@/core/business-context/types'

/** Cast Supabase JSON to JsonValue. */
function asJson(v: unknown): JsonValue {
  return v as JsonValue
}

function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface StageEventInput {
  workspaceId: string
  businessId: string
  runId: string
  jobId?: string | null
  sourceId: string
  stage: SourceProcessingStage
  status: StageEventStatus
  attempt: number
  workerId?: string | null
  provider?: string | null
  providerRequestId?: string | null
  startedAt: Date
  completedAt?: Date | null
  durationMs?: number | null
  pagesProcessed?: number
  slidesProcessed?: number
  bytesProcessed?: number
  documentsCreated?: number
  factsExtracted?: number
  warningsCount?: number
  creditsConsumed?: number
  errorClass?: string | null
  error?: unknown
  metadata?: Record<string, unknown>
}

export interface ProcessingRunUpdate {
  workspaceId: string
  runId: string
  status?: string
  currentStage?: SourceProcessingStage
  terminalOutcome?: string
  attemptCount?: number
  pagesProcessed?: number
  slidesProcessed?: number
  documentsCreated?: number
  factsExtracted?: number
  warningsCount?: number
  creditsConsumed?: number
  qualitySummary?: Record<string, unknown>
  completedAt?: Date | null
}

// ─── Error patterns to strip from error payloads ────────────────────────────

const SENSITIVE_PATTERNS = [
  /secret/i,
  /password/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
]

function redactError(error: unknown): Record<string, unknown> | null {
  if (!error || typeof error !== 'object') return null

  const raw = error as Record<string, unknown>
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      const containsSensitive = SENSITIVE_PATTERNS.some((p) => p.test(key) || p.test(value))
      if (containsSensitive) continue
      result[key] = value
    } else {
      result[key] = value
    }
  }

  return result
}

// ─── Processing visibility writer ───────────────────────────────────────────

export class ProcessingVisibilityWriter {
  private db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseServiceClient()
  }

  /**
   * Create a new processing run record.
   */
  async createRun(
    data: Omit<ProcessingRun, 'id'>,
  ): Promise<ServiceResult<ProcessingRun>> {
    const { data: row, error } = await this.db
      .from('context_processing_runs')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_id: data.sourceId,
        job_id: data.jobId,
        pipeline_type: data.pipelineType,
        status: data.status,
        current_stage: data.currentStage,
        terminal_outcome: data.terminalOutcome,
        attempt_count: data.attemptCount,
        pages_processed: data.pagesProcessed,
        slides_processed: data.slidesProcessed,
        documents_created: data.documentsCreated,
        facts_extracted: data.factsExtracted,
        warnings_count: data.warningsCount,
        credits_consumed: data.creditsConsumed,
        quality_summary: data.qualitySummary,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'CREATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapRun(row) }
  }

  /**
   * Append a stage event for a processing run. Errors are redacted before storage.
   */
  async appendStageEvent(
    input: StageEventInput,
  ): Promise<ServiceResult<StageEvent>> {
    const { data: row, error } = await this.db
      .from('context_processing_stage_events')
      .insert({
        workspace_id: input.workspaceId,
        business_id: input.businessId,
        run_id: input.runId,
        job_id: input.jobId ?? null,
        source_id: input.sourceId,
        stage: input.stage,
        status: input.status,
        attempt: input.attempt,
        worker_id: input.workerId ?? null,
        provider: input.provider ?? null,
        provider_request_id: input.providerRequestId ?? null,
        started_at: input.startedAt.toISOString(),
        completed_at: input.completedAt?.toISOString() ?? null,
        duration_ms: input.durationMs ?? null,
        pages_processed: input.pagesProcessed ?? 0,
        slides_processed: input.slidesProcessed ?? 0,
        bytes_processed: input.bytesProcessed ?? 0,
        documents_created: input.documentsCreated ?? 0,
        facts_extracted: input.factsExtracted ?? 0,
        warnings_count: input.warningsCount ?? 0,
        credits_consumed: input.creditsConsumed ?? 0,
        error_class: input.errorClass ?? null,
        error: redactError(input.error),
        metadata: input.metadata ?? {},
      })
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'CREATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapEvent(row) }
  }

  /**
   * Update aggregate counters on a processing run.
   */
  async updateRunCounters(
    update: ProcessingRunUpdate,
  ): Promise<ServiceResult<ProcessingRun>> {
    const set: Record<string, unknown> = {}
    if (update.status !== undefined) set.status = update.status
    if (update.currentStage !== undefined) set.current_stage = update.currentStage
    if (update.terminalOutcome !== undefined) set.terminal_outcome = update.terminalOutcome
    if (update.attemptCount !== undefined) set.attempt_count = update.attemptCount
    if (update.pagesProcessed !== undefined) set.pages_processed = update.pagesProcessed
    if (update.slidesProcessed !== undefined) set.slides_processed = update.slidesProcessed
    if (update.documentsCreated !== undefined) set.documents_created = update.documentsCreated
    if (update.factsExtracted !== undefined) set.facts_extracted = update.factsExtracted
    if (update.warningsCount !== undefined) set.warnings_count = update.warningsCount
    if (update.creditsConsumed !== undefined) set.credits_consumed = update.creditsConsumed
    if (update.qualitySummary !== undefined) set.quality_summary = update.qualitySummary
    if (update.completedAt !== undefined) set.completed_at = update.completedAt?.toISOString() ?? null

    const { data: row, error } = await this.db
      .from('context_processing_runs')
      .update(set)
      .eq('workspace_id', update.workspaceId)
      .eq('id', update.runId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapRun(row) }
  }

  // ─── Mapping helpers ─────────────────────────────────────────────────────

  private mapRun(r: Record<string, unknown>): ProcessingRun {
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

  private mapEvent(r: Record<string, unknown>): StageEvent {
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
}
