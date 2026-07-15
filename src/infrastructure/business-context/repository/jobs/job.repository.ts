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
import { err, mapContextJob, type Row } from '../_shared'
import { ProcessingRunRepository } from './processing-run.repository'
import { StageEventRepository } from './stage-event.repository'

// ─── ContextJob CRUD ────────────────────────────────────────────────────────

export class ContextJobRepository {
  constructor(private db: SupabaseClient) {}

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

    // Stall recovery mode: find running jobs with stale heartbeats.
    // These jobs may be locked by a dead worker, so we don't filter on
    // locked_by IS NULL — we try to claim any stale job.
    if (filter.heartbeatExpired) {
      const staleThreshold = filter.heartbeatExpired.toISOString()
      let query = this.db
        .from('context_jobs')
        .select('*')
        .eq('status', filter.status)
        .lt('heartbeat_at', staleThreshold)
        .limit(limit)

      if (filter.jobType) query = query.eq('job_type', filter.jobType)

      const { data: candidates, error: readErr } = await query
      if (readErr) return err('READ_FAILED', readErr.message)
      if (!candidates || candidates.length === 0) return { ok: true, data: [] }

      const ids = candidates.map((r: Row) => r.id as string)
      const { data: locked, error: lockErr } = await this.db
        .from('context_jobs')
        .update({
          locked_by: workerId,
          locked_at: now,
        })
        .in('id', ids)
        .select()

      if (lockErr) return err('UPDATE_FAILED', lockErr.message)
      return { ok: true, data: (locked ?? []).map(mapContextJob) }
    }

    // Normal claim: find unlocked jobs in the given status.
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
}

// ─── Facade ─────────────────────────────────────────────────────────────────
//
// `JobRepository` keeps the legacy public API by delegating each method to the
// matching entity-specific sub-repository. No behavior change vs. the
// monolithic implementation; this split is purely structural.

export class JobRepository {
  private contextJobs: ContextJobRepository
  private processingRuns: ProcessingRunRepository
  private stageEvents: StageEventRepository

  constructor(db: SupabaseClient) {
    this.contextJobs = new ContextJobRepository(db)
    this.processingRuns = new ProcessingRunRepository(db)
    this.stageEvents = new StageEventRepository(db)
  }

  // ContextJob
  createContextJob = (data: Parameters<ContextJobRepository['createContextJob']>[0]) =>
    this.contextJobs.createContextJob(data)
  getContextJob = (workspaceId: string, jobId: string) =>
    this.contextJobs.getContextJob(workspaceId, jobId)
  getContextJobByIdempotencyKey = (idempotencyKey: string) =>
    this.contextJobs.getContextJobByIdempotencyKey(idempotencyKey)
  listContextJobs = (
    filter: Parameters<ContextJobRepository['listContextJobs']>[0],
    pagination?: Parameters<ContextJobRepository['listContextJobs']>[1],
  ) => this.contextJobs.listContextJobs(filter, pagination)
  claimRunnableJobs = (
    filter: Parameters<ContextJobRepository['claimRunnableJobs']>[0],
    workerId: string,
    limit: number,
  ) => this.contextJobs.claimRunnableJobs(filter, workerId, limit)
  updateContextJob = (
    workspaceId: string,
    jobId: string,
    data: Parameters<ContextJobRepository['updateContextJob']>[2],
  ) => this.contextJobs.updateContextJob(workspaceId, jobId, data)

  // ProcessingRun
  createProcessingRun = (data: Parameters<ProcessingRunRepository['createProcessingRun']>[0]) =>
    this.processingRuns.createProcessingRun(data)
  getProcessingRun = (workspaceId: string, runId: string) =>
    this.processingRuns.getProcessingRun(workspaceId, runId)
  listProcessingRuns = (
    filter: Parameters<ProcessingRunRepository['listProcessingRuns']>[0],
    pagination?: Parameters<ProcessingRunRepository['listProcessingRuns']>[1],
    sort?: Parameters<ProcessingRunRepository['listProcessingRuns']>[2],
  ) => this.processingRuns.listProcessingRuns(filter, pagination, sort)
  updateProcessingRun = (
    workspaceId: string,
    runId: string,
    data: Parameters<ProcessingRunRepository['updateProcessingRun']>[2],
  ) => this.processingRuns.updateProcessingRun(workspaceId, runId, data)

  // StageEvent
  createStageEvent = (data: Parameters<StageEventRepository['createStageEvent']>[0]) =>
    this.stageEvents.createStageEvent(data)
  listStageEvents = (
    filter: Parameters<StageEventRepository['listStageEvents']>[0],
    pagination?: Parameters<StageEventRepository['listStageEvents']>[1],
  ) => this.stageEvents.listStageEvents(filter, pagination)
}
