import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProcessingRun, ServiceResult } from '@/core/business-context/types'
import type {
  PaginationParams,
  ProcessingRunFilter,
  SortParams,
} from '@/core/business-context/repository.port'
import { err, mapProcessingRun } from '../_shared'

// ─── ProcessingRun CRUD ─────────────────────────────────────────────────────

export class ProcessingRunRepository {
  constructor(private db: SupabaseClient) {}

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
}
