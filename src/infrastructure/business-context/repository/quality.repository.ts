import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CircuitBreaker,
  QualityGateResult,
  ServiceResult,
} from '@/core/business-context/types'
import type {
  PaginationParams,
  QualityGateFilter,
} from '@/core/business-context/repository.port'
import {
  err,
  mapCircuitBreaker,
  mapQualityGateResult,
} from './_shared'

// ─── QualityGateResult + CircuitBreaker ─────────────────────────────────────

export class QualityRepository {
  constructor(private db: SupabaseClient) {}

  // ── Quality gate results ─────────────────────────────────────────────────

  async createQualityGateResult(
    data: Omit<QualityGateResult, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<QualityGateResult>> {
    const { data: row, error } = await this.db
      .from('context_quality_gate_results')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        run_id: data.runId,
        source_id: data.sourceId,
        source_document_id: data.sourceDocumentId,
        fact_id: data.factId,
        gate_scope: data.gateScope,
        gate_name: data.gateName,
        status: data.status,
        measured_value: data.measuredValue,
        threshold: data.threshold,
        reason: data.reason,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapQualityGateResult(row) }
  }

  async listQualityGateResults(
    filter: QualityGateFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: QualityGateResult[]; total: number }>> {
    let query = this.db
      .from('context_quality_gate_results')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.runId) query = query.eq('run_id', filter.runId)
    if (filter.sourceDocumentId) query = query.eq('source_document_id', filter.sourceDocumentId)
    if (filter.factId) query = query.eq('fact_id', filter.factId)
    if (filter.gateScope) query = query.eq('gate_scope', filter.gateScope)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapQualityGateResult), total: count ?? 0 },
    }
  }

  // ── Circuit breakers ─────────────────────────────────────────────────────

  async getCircuitBreaker(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker | null>> {
    let query = this.db
      .from('context_provider_circuit_breakers')
      .select('*')
      .eq('provider', provider)

    if (workspaceId === null) {
      query = query.is('workspace_id', null)
    } else {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapCircuitBreaker(data) : null }
  }

  async upsertCircuitBreaker(
    data: Omit<CircuitBreaker, 'id'>,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const { data: row, error } = await this.db
      .from('context_provider_circuit_breakers')
      .upsert(
        {
          workspace_id: data.workspaceId,
          provider: data.provider,
          state: data.state,
          failure_count: data.failureCount,
          success_count: data.successCount,
          timeout_count: data.timeoutCount,
          quota_exhausted: data.quotaExhausted,
          opened_at: data.openedAt?.toISOString() ?? null,
          half_open_after: data.halfOpenAfter?.toISOString() ?? null,
          last_failure_at: data.lastFailureAt?.toISOString() ?? null,
          last_success_at: data.lastSuccessAt?.toISOString() ?? null,
          metadata: data.metadata,
        },
        { onConflict: 'workspace_id,provider' },
      )
      .select()
      .single()

    if (error) return err('UPSERT_FAILED', error.message)
    return { ok: true, data: mapCircuitBreaker(row) }
  }
}
