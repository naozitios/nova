import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContextJob,
  ProcessingRun,
  ServiceResult,
  StageEvent,
} from '@/core/business-context/types'
import type {
  JobFilter,
  PaginationParams,
  ProcessingRunFilter,
  RunnableJobFilter,
  SortParams,
  StageEventFilter,
} from '@/core/business-context/repository.port'
import {
  err,
  mapContextJob,
  mapProcessingRun,
  mapStageEvent,
  type Row,
} from './_shared'

// ─── ContextJob + ProcessingRun + StageEvent ────────────────────────────────

export class JobRepository {
  constructor(private db: SupabaseClient) {}

  // ── Context jobs ─────────────────────────────────────────────────────────

  async createContextJob(
    data: Omit<ContextJob, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextJob>> {
    const { data: row, error } = await this.db
      .from('context_jobs')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        session_id: data.sessionId,
        job_type: data.jobType,
        status: data.status,
        attempt_count: data.attemptCount,
        max_attempts: data.maxAttempts,
        idempotency_key: data.idempotencyKey,
        stage: data.stage,
        input: data.input,
        output: data.output,
        error: data.error,
        error_class: data.errorClass,
        retry_policy: data.retryPolicy,
        next_run_at: data.nextRunAt?.toISOString() ?? null,
        locked_by: data.lockedBy,
        locked_at: data.lockedAt?.toISOString() ?? null,
        heartbeat_at: data.heartbeatAt?.toISOString() ?? null,
        stage_timeout_seconds: data.stageTimeoutSeconds,
        started_at: data.startedAt?.toISOString() ?? null,
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextJob(row) }
  }

  async getContextJob(
    workspaceId: string,
    jobId: string,
  ): Promise<ServiceResult<ContextJob | null>> {
    const { data, error } = await this.db
      .from('context_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', jobId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextJob(data) : null }
  }

  async getContextJobByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ServiceResult<ContextJob | null>> {
    const { data, error } = await this.db
      .from('context_jobs')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextJob(data) : null }
  }

  async listContextJobs(
    filter: JobFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextJob[]; total: number }>> {
    let query = this.db
      .from('context_jobs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.jobType) query = query.eq('job_type', filter.jobType)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextJob), total: count ?? 0 },
    }
  }

  async claimRunnableJobs(
    filter: RunnableJobFilter,
    workerId: string,
    limit: number,
  ): Promise<ServiceResult<ContextJob[]>> {
    const now = new Date().toISOString()

    let query = this.db
      .from('context_jobs')
      .select('*')
      .eq('status', filter.status)
      .is('locked_by', null)
      .limit(limit)

    if (filter.jobType) query = query.eq('job_type', filter.jobType)

    const { data: candidates, error: readErr } = await query
    if (readErr) return err('READ_FAILED', readErr.message)

    if (!candidates || candidates.length === 0) {
      return { ok: true, data: [] }
    }

    const ids = candidates.map((r: Row) => r.id as string)
    const { data: locked, error: lockErr } = await this.db
      .from('context_jobs')
      .update({
        locked_by: workerId,
        locked_at: now,
        heartbeat_at: now,
        status: 'running',
        started_at: now,
      })
      .in('id', ids)
      .is('locked_by', null)
      .select()

    if (lockErr) return err('UPDATE_FAILED', lockErr.message)
    return { ok: true, data: (locked ?? []).map(mapContextJob) }
  }

  async updateContextJob(
    workspaceId: string,
    jobId: string,
    data: Partial<Pick<ContextJob, 'status' | 'attemptCount' | 'output' | 'error' | 'errorClass' | 'nextRunAt' | 'lockedBy' | 'lockedAt' | 'heartbeatAt' | 'startedAt' | 'completedAt'>>,
  ): Promise<ServiceResult<ContextJob>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.attemptCount !== undefined) update.attempt_count = data.attemptCount
    if (data.output !== undefined) update.output = data.output
    if (data.error !== undefined) update.error = data.error
    if (data.errorClass !== undefined) update.error_class = data.errorClass
    if (data.nextRunAt !== undefined) update.next_run_at = data.nextRunAt?.toISOString() ?? null
    if (data.lockedBy !== undefined) update.locked_by = data.lockedBy
    if (data.lockedAt !== undefined) update.locked_at = data.lockedAt?.toISOString() ?? null
    if (data.heartbeatAt !== undefined) update.heartbeat_at = data.heartbeatAt?.toISOString() ?? null
    if (data.startedAt !== undefined) update.started_at = data.startedAt?.toISOString() ?? null
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null

    const { data: row, error } = await this.db
      .from('context_jobs')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', jobId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextJob(row) }
  }

  // ── Processing runs ──────────────────────────────────────────────────────

  async createProcessingRun(
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

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapProcessingRun(row) }
  }

  async getProcessingRun(
    workspaceId: string,
    runId: string,
  ): Promise<ServiceResult<ProcessingRun | null>> {
    const { data, error } = await this.db
      .from('context_processing_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProcessingRun(data) : null }
  }

  async listProcessingRuns(
    filter: ProcessingRunFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'startedAt'>,
  ): Promise<ServiceResult<{ items: ProcessingRun[]; total: number }>> {
    let query = this.db
      .from('context_processing_runs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.jobId) query = query.eq('job_id', filter.jobId)
    if (filter.status) query = query.eq('status', filter.status)

    const sortDir = sort?.direction ?? 'desc'
    query = query.order('started_at', { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapProcessingRun), total: count ?? 0 },
    }
  }

  async updateProcessingRun(
    workspaceId: string,
    runId: string,
    data: Partial<Pick<ProcessingRun, 'status' | 'currentStage' | 'terminalOutcome' | 'attemptCount' | 'pagesProcessed' | 'slidesProcessed' | 'documentsCreated' | 'factsExtracted' | 'warningsCount' | 'creditsConsumed' | 'qualitySummary' | 'completedAt'>>,
  ): Promise<ServiceResult<ProcessingRun>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStage !== undefined) update.current_stage = data.currentStage
    if (data.terminalOutcome !== undefined) update.terminal_outcome = data.terminalOutcome
    if (data.attemptCount !== undefined) update.attempt_count = data.attemptCount
    if (data.pagesProcessed !== undefined) update.pages_processed = data.pagesProcessed
    if (data.slidesProcessed !== undefined) update.slides_processed = data.slidesProcessed
    if (data.documentsCreated !== undefined) update.documents_created = data.documentsCreated
    if (data.factsExtracted !== undefined) update.facts_extracted = data.factsExtracted
    if (data.warningsCount !== undefined) update.warnings_count = data.warningsCount
    if (data.creditsConsumed !== undefined) update.credits_consumed = data.creditsConsumed
    if (data.qualitySummary !== undefined) update.quality_summary = data.qualitySummary
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null

    const { data: row, error } = await this.db
      .from('context_processing_runs')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapProcessingRun(row) }
  }

  // ── Stage events ─────────────────────────────────────────────────────────

  async createStageEvent(
    data: Omit<StageEvent, 'id'>,
  ): Promise<ServiceResult<StageEvent>> {
    const { data: row, error } = await this.db
      .from('context_processing_stage_events')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        run_id: data.runId,
        job_id: data.jobId,
        source_id: data.sourceId,
        stage: data.stage,
        status: data.status,
        attempt: data.attempt,
        worker_id: data.workerId,
        provider: data.provider,
        provider_request_id: data.providerRequestId,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
        duration_ms: data.durationMs,
        pages_processed: data.pagesProcessed,
        slides_processed: data.slidesProcessed,
        bytes_processed: data.bytesProcessed,
        documents_created: data.documentsCreated,
        facts_extracted: data.factsExtracted,
        warnings_count: data.warningsCount,
        credits_consumed: data.creditsConsumed,
        error_class: data.errorClass,
        error: data.error,
        metadata: data.metadata,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapStageEvent(row) }
  }

  async listStageEvents(
    filter: StageEventFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: StageEvent[]; total: number }>> {
    let query = this.db
      .from('context_processing_stage_events')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.runId) query = query.eq('run_id', filter.runId)
    if (filter.jobId) query = query.eq('job_id', filter.jobId)
    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.stage) query = query.eq('stage', filter.stage)

    query = query.order('started_at', { ascending: true })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapStageEvent), total: count ?? 0 },
    }
  }
}
