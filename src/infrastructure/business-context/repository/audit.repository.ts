import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuditLog, ServiceResult } from '@/core/business-context/types'
import type {
  AuditLogFilter,
  PaginationParams,
  SortParams,
} from '@/core/business-context/repository.port'
import { err, mapAuditLog } from './_shared'

// ─── AuditLog ───────────────────────────────────────────────────────────────

export class AuditRepository {
  constructor(private db: SupabaseClient) {}

  async createAuditLog(
    data: Omit<AuditLog, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<AuditLog>> {
    const { data: row, error } = await this.db
      .from('context_audit_log')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        actor_id: data.actorId,
        actor_type: data.actorType,
        event_type: data.eventType,
        entity_type: data.entityType,
        entity_id: data.entityId,
        before: data.before,
        after: data.after,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapAuditLog(row) }
  }

  async listAuditLogs(
    filter: AuditLogFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt'>,
  ): Promise<ServiceResult<{ items: AuditLog[]; total: number }>> {
    let query = this.db
      .from('context_audit_log')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.businessId) query = query.eq('business_id', filter.businessId)
    if (filter.entityType) query = query.eq('entity_type', filter.entityType)
    if (filter.entityId) query = query.eq('entity_id', filter.entityId)
    if (filter.createdAfter) query = query.gte('created_at', filter.createdAfter.toISOString())
    if (filter.createdBefore) query = query.lte('created_at', filter.createdBefore.toISOString())

    const sortDir = sort?.direction ?? 'desc'
    query = query.order('created_at', { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapAuditLog), total: count ?? 0 },
    }
  }
}
