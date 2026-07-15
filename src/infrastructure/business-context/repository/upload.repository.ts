import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  UploadIntent,
  UploadIntentStatus,
} from '@/core/business-context/types/remediation-entities'
import type {
  UploadIntentFilter,
  UploadRepositoryPort,
} from '@/core/business-context/repository/upload.port'
import type { PaginationParams, SortParams } from '@/core/business-context/repository/repository.port'
import { mapUploadIntent, err } from './_shared'

export class UploadRepository implements UploadRepositoryPort {
  constructor(private db: SupabaseClient) {}

  async createUploadIntent(
    data: Omit<UploadIntent, 'id' | 'createdAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<UploadIntent>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('context_upload_intents')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_id: data.sourceId,
        source_type: data.sourceType,
        source_name: data.sourceName,
        document_class: data.documentClass,
        classification_source: data.classificationSource,
        file_name: data.fileName,
        declared_mime_type: data.declaredMimeType,
        expected_size_bytes: data.expectedSizeBytes,
        storage_path: data.storagePath,
        created_by: data.createdBy,
        status: data.status,
        malware_scan_status: data.malwareScanStatus,
        malware_scan_code: data.malwareScanCode,
        malware_scanned_at: data.malwareScannedAt?.toISOString() ?? null,
        expires_at: data.expiresAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapUploadIntent(row) }
  }

  async getUploadIntent(
    workspaceId: string,
    intentId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<UploadIntent | null>> {
    const { data, error } = await this.db
      .from('context_upload_intents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', intentId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapUploadIntent(data) : null }
  }

  async getUploadIntentByStoragePath(
    storagePath: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<UploadIntent | null>> {
    const { data, error } = await this.db
      .from('context_upload_intents')
      .select('*')
      .eq('storage_path', storagePath)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapUploadIntent(data) : null }
  }

  async listUploadIntents(
    filter: UploadIntentFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt' | 'expiresAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<{ items: UploadIntent[]; total: number }>> {
    let query = this.db
      .from('context_upload_intents')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.businessId) query = query.eq('business_id', filter.businessId)
    if (filter.status) query = query.eq('status', filter.status)

    const sortField = sort?.field === 'createdAt' ? 'created_at'
      : sort?.field === 'expiresAt' ? 'expires_at'
      : 'created_at'
    const sortDir = sort?.direction ?? 'desc'
    query = query.order(sortField, { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapUploadIntent), total: count ?? 0 },
    }
  }

  async updateUploadIntentStatus(
    workspaceId: string,
    intentId: string,
    status: UploadIntentStatus,
    additionalFields?: Partial<Pick<UploadIntent, 'completedAt' | 'malwareScanStatus' | 'malwareScanCode' | 'malwareScannedAt'>>,
  ): Promise<import('@/core/business-context/types').ServiceResult<UploadIntent>> {
    const update: Record<string, unknown> = { status }
    if (additionalFields?.completedAt !== undefined) {
      update.completed_at = additionalFields.completedAt?.toISOString() ?? null
    }
    if (additionalFields?.malwareScanStatus !== undefined) {
      update.malware_scan_status = additionalFields.malwareScanStatus
    }
    if (additionalFields?.malwareScanCode !== undefined) {
      update.malware_scan_code = additionalFields.malwareScanCode
    }
    if (additionalFields?.malwareScannedAt !== undefined) {
      update.malware_scanned_at = additionalFields.malwareScannedAt?.toISOString() ?? null
    }

    const { data: row, error } = await this.db
      .from('context_upload_intents')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', intentId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapUploadIntent(row) }
  }

  async deleteUploadIntent(
    workspaceId: string,
    intentId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<void>> {
    const { error } = await this.db
      .from('context_upload_intents')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', intentId)

    if (error) return err('DELETE_FAILED', error.message)
    return { ok: true, data: undefined }
  }

  async expireStaleIntents(): Promise<import('@/core/business-context/types').ServiceResult<number>> {
    const { data, error } = await this.db
      .from('context_upload_intents')
      .update({ status: 'expired' })
      .lt('expires_at', new Date().toISOString())
      .in('status', ['pending', 'scanning', 'storing', 'processing'])
      .select()

    if (error) return err('EXPIRE_FAILED', error.message)
    return { ok: true, data: data?.length ?? 0 }
  }
}
