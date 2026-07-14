import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  BusinessProfileVersion,
  ServiceResult,
} from '@/core/business-context/types'
import type {
  PaginationParams,
  ProfileVersionFilter,
} from '@/core/business-context/repository.port'
import { err, mapProfileVersion } from './_shared'

// ─── BusinessProfileVersion ─────────────────────────────────────────────────

export class ProfileRepository {
  constructor(private db: SupabaseClient) {}

  async createProfileVersion(
    data: Omit<BusinessProfileVersion, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const { data: row, error } = await this.db
      .from('business_profile_versions')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        version: data.version,
        profile: data.profile,
        profile_markdown: data.profileMarkdown,
        status: data.status,
        change_summary: data.changeSummary,
        created_by: data.createdBy,
        approved_by: data.approvedBy,
        approved_at: data.approvedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapProfileVersion(row) }
  }

  async getProfileVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>> {
    const { data, error } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProfileVersion(data) : null }
  }

  async listProfileVersions(
    filter: ProfileVersionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: BusinessProfileVersion[]; total: number }>> {
    let query = this.db
      .from('business_profile_versions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('version', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapProfileVersion), total: count ?? 0 },
    }
  }

  async getCurrentProfileVersion(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>> {
    const { data, error } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('business_id', businessId)
      .eq('status', 'current')
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProfileVersion(data) : null }
  }

  async supersedeProfileVersions(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<void>> {
    const { error } = await this.db
      .from('business_profile_versions')
      .update({ status: 'superseded' })
      .eq('workspace_id', workspaceId)
      .eq('business_id', businessId)
      .eq('status', 'current')

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: undefined }
  }

  async approveProfileVersion(
    workspaceId: string,
    versionId: string,
    approvedBy: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('business_profile_versions')
      .update({
        status: 'current',
        approved_by: approvedBy,
        approved_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapProfileVersion(row) }
  }

  async restoreProfileVersion(
    workspaceId: string,
    versionId: string,
    restoredBy: string,
    note?: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const { data, error: readErr } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .single()

    if (readErr || !data) return err('READ_FAILED', 'Source version not found')

    const { data: maxRow } = await this.db
      .from('business_profile_versions')
      .select('version')
      .eq('workspace_id', workspaceId)
      .eq('business_id', data.business_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (maxRow ? Number(maxRow.version) : 0) + 1

    const { data: newRow, error: insertErr } = await this.db
      .from('business_profile_versions')
      .insert({
        workspace_id: workspaceId,
        business_id: data.business_id,
        version: nextVersion,
        profile: data.profile,
        profile_markdown: data.profile_markdown,
        status: 'draft',
        change_summary: note ?? `Restored from version ${data.version}`,
        created_by: restoredBy,
      })
      .select()
      .single()

    if (insertErr) return err('CREATE_FAILED', insertErr.message)
    return { ok: true, data: mapProfileVersion(newRow) }
  }
}
