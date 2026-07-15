import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  IdempotencyRecord,
  IdempotencyOperation,
  IdempotencyState,
} from '@/core/business-context/types/remediation-entities'
import type { IdempotencyRepositoryPort } from '@/core/business-context/repository/idempotency.port'
import { mapIdempotencyRecord, err } from './_shared'

export class IdempotencyRepository implements IdempotencyRepositoryPort {
  constructor(private db: SupabaseClient) {}

  async createRecord(
    data: Omit<IdempotencyRecord, 'id' | 'createdAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<IdempotencyRecord>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('context_idempotency_records')
      .insert({
        workspace_id: data.workspaceId,
        operation: data.operation,
        idempotency_key: data.idempotencyKey,
        request_fingerprint: data.requestFingerprint,
        state: data.state,
        resource_type: data.resourceType,
        resource_id: data.resourceId,
        response_status: data.responseStatus,
        response_body: data.responseBody,
        expires_at: data.expiresAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapIdempotencyRecord(row) }
  }

  async findByKey(
    workspaceId: string,
    operation: IdempotencyOperation,
    idempotencyKey: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<IdempotencyRecord | null>> {
    const { data, error } = await this.db
      .from('context_idempotency_records')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('operation', operation)
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapIdempotencyRecord(data) : null }
  }

  async updateState(
    workspaceId: string,
    recordId: string,
    state: IdempotencyState,
    additionalFields?: Partial<Pick<IdempotencyRecord, 'resourceType' | 'resourceId' | 'responseStatus' | 'responseBody' | 'completedAt'>>,
  ): Promise<import('@/core/business-context/types').ServiceResult<IdempotencyRecord>> {
    const update: Record<string, unknown> = { state }
    if (additionalFields?.resourceType !== undefined) {
      update.resource_type = additionalFields.resourceType
    }
    if (additionalFields?.resourceId !== undefined) {
      update.resource_id = additionalFields.resourceId
    }
    if (additionalFields?.responseStatus !== undefined) {
      update.response_status = additionalFields.responseStatus
    }
    if (additionalFields?.responseBody !== undefined) {
      update.response_body = additionalFields.responseBody
    }
    if (additionalFields?.completedAt !== undefined) {
      update.completed_at = additionalFields.completedAt?.toISOString() ?? null
    }

    const { data: row, error } = await this.db
      .from('context_idempotency_records')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', recordId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapIdempotencyRecord(row) }
  }

  async deleteRecord(
    workspaceId: string,
    recordId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<void>> {
    const { error } = await this.db
      .from('context_idempotency_records')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', recordId)

    if (error) return err('DELETE_FAILED', error.message)
    return { ok: true, data: undefined }
  }

  async deleteExpired(): Promise<import('@/core/business-context/types').ServiceResult<number>> {
    const { data, error } = await this.db
      .from('context_idempotency_records')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select()

    if (error) return err('DELETE_EXPIRED_FAILED', error.message)
    return { ok: true, data: data?.length ?? 0 }
  }
}
