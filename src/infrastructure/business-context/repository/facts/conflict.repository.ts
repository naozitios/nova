import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContextConflict, ServiceResult } from '@/core/business-context/types'
import type {
  ConflictFilter,
  PaginationParams,
} from '@/core/business-context/repository.port'
import { err, mapContextConflict } from '../_shared'

// ─── ContextConflict ────────────────────────────────────────────────────────

export class ConflictRepository {
  constructor(private db: SupabaseClient) {}

  async createContextConflict(
    data: Omit<ContextConflict, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextConflict>> {
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        fact_key: data.factKey,
        fact_ids: data.factIds,
        status: data.status,
        resolution_fact_id: data.resolutionFactId,
        resolution_note: data.resolutionNote,
        resolved_by: data.resolvedBy,
        resolved_at: data.resolvedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }

  async getContextConflict(
    workspaceId: string,
    conflictId: string,
  ): Promise<ServiceResult<ContextConflict | null>> {
    const { data, error } = await this.db
      .from('context_conflicts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextConflict(data) : null }
  }

  async listContextConflicts(
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextConflict[]; total: number }>> {
    let query = this.db
      .from('context_conflicts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.status) query = query.eq('status', filter.status)
    if (filter.factKey) query = query.eq('fact_key', filter.factKey)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextConflict), total: count ?? 0 },
    }
  }

  async resolveContextConflict(
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<ServiceResult<ContextConflict>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .update({
        status: 'resolved',
        resolution_fact_id: resolutionFactId,
        resolved_by: resolvedBy,
        resolution_note: note ?? null,
        resolved_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }
}
