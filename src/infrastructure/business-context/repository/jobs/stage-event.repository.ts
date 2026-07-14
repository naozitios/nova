import type { SupabaseClient } from '@supabase/supabase-js'
import type { ServiceResult, StageEvent } from '@/core/business-context/types'
import type { PaginationParams, StageEventFilter } from '@/core/business-context/repository.port'
import { err, mapStageEvent } from '../_shared'

// ─── StageEvent CRUD ────────────────────────────────────────────────────────

export class StageEventRepository {
  constructor(private db: SupabaseClient) {}

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
