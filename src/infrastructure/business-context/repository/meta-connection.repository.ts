import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MetaConnection,
  MetaConnectionStatus,
  MetaOAuthState,
  MetaProviderCodeHash,
} from '@/core/business-context/types/remediation-entities'
import type {
  MetaConnectionFilter,
  MetaConnectionRepositoryPort,
  MetaConnectionStatusResponse,
} from '@/core/business-context/repository/meta-connection.port'
import type { PaginationParams, SortParams } from '@/core/business-context/repository/repository.port'
import {
  mapMetaConnection,
  mapMetaConnectionStatus,
  mapMetaOAuthState,
  mapMetaProviderCodeHash,
  err,
} from './_shared'
import { encrypt, decrypt } from '../token-encryption'

export class MetaConnectionRepository implements MetaConnectionRepositoryPort {
  constructor(private db: SupabaseClient) {}

  async createConnection(
    data: Omit<MetaConnection, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaConnection>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('business_context_meta_connections')
      .insert({
        workspace_id: data.workspaceId,
        connected_by: data.connectedBy,
        meta_user_id: data.metaUserId,
        encrypted_access_token: data.encryptedAccessToken,
        token_expires_at: data.tokenExpiresAt?.toISOString() ?? null,
        selected_ad_account_id: data.selectedAdAccountId,
        account_metadata: data.accountMetadata,
        status: data.status,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapMetaConnection(row) }
  }

  async getActiveConnection(
    workspaceId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaConnection | null>> {
    const { data, error } = await this.db
      .from('business_context_meta_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapMetaConnection(data) : null }
  }

  async getConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaConnection | null>> {
    const { data, error } = await this.db
      .from('business_context_meta_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', connectionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapMetaConnection(data) : null }
  }

  async listConnections(
    filter: MetaConnectionFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt' | 'updatedAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<{ items: MetaConnectionStatusResponse[]; total: number }>> {
    let query = this.db
      .from('business_context_meta_connections')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.status) query = query.eq('status', filter.status)

    const sortField = sort?.field === 'createdAt' ? 'created_at'
      : sort?.field === 'updatedAt' ? 'updated_at'
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
      data: { items: (data ?? []).map(mapMetaConnectionStatus), total: count ?? 0 },
    }
  }

  async updateConnectionStatus(
    workspaceId: string,
    connectionId: string,
    status: MetaConnectionStatus,
    additionalFields?: Partial<Pick<MetaConnection, 'tokenExpiresAt' | 'selectedAdAccountId' | 'accountMetadata'>>,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaConnection>> {
    const update: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (additionalFields?.tokenExpiresAt !== undefined) {
      update.token_expires_at = additionalFields.tokenExpiresAt?.toISOString() ?? null
    }
    if (additionalFields?.selectedAdAccountId !== undefined) {
      update.selected_ad_account_id = additionalFields.selectedAdAccountId
    }
    if (additionalFields?.accountMetadata !== undefined) {
      update.account_metadata = additionalFields.accountMetadata
    }

    const { data: row, error } = await this.db
      .from('business_context_meta_connections')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', connectionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapMetaConnection(row) }
  }

  async deleteConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<void>> {
    const { error } = await this.db
      .from('business_context_meta_connections')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', connectionId)

    if (error) return err('DELETE_FAILED', error.message)
    return { ok: true, data: undefined }
  }

  async deactivateAllForWorkspace(
    workspaceId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<number>> {
    const { data, error } = await this.db
      .from('business_context_meta_connections')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .select()

    if (error) return err('DEACTIVATE_FAILED', error.message)
    return { ok: true, data: data?.length ?? 0 }
  }

  // ── OAuth State ──────────────────────────────────────────────────────────

  async createOAuthState(
    data: Omit<MetaOAuthState, 'id' | 'createdAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaOAuthState>> {
    const { data: row, error } = await this.db
      .from('meta_oauth_states')
      .insert({
        workspace_id: data.workspaceId,
        created_by: data.createdBy,
        state_nonce_hash: data.stateNonceHash,
        return_path: data.returnPath,
        expires_at: data.expiresAt.toISOString(),
        consumed_at: data.consumedAt?.toISOString() ?? null,
        provider_code_hash: data.providerCodeHash,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapMetaOAuthState(row) }
  }

  async getOAuthState(
    workspaceId: string,
    stateId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaOAuthState | null>> {
    const { data, error } = await this.db
      .from('meta_oauth_states')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', stateId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapMetaOAuthState(data) : null }
  }

  async consumeOAuthState(
    workspaceId: string,
    stateId: string,
    providerCodeHash: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaOAuthState>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('meta_oauth_states')
      .update({
        consumed_at: now,
        provider_code_hash: providerCodeHash,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', stateId)
      .is('consumed_at', null)
      .select()
      .single()

    if (error) return err('CONSUME_FAILED', error.message)
    return { ok: true, data: mapMetaOAuthState(row) }
  }

  async deleteExpiredOAuthStates(): Promise<import('@/core/business-context/types').ServiceResult<number>> {
    const { data, error } = await this.db
      .from('meta_oauth_states')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select()

    if (error) return err('DELETE_EXPIRED_FAILED', error.message)
    return { ok: true, data: data?.length ?? 0 }
  }

  // ── Provider Code Hash ───────────────────────────────────────────────────

  async createProviderCodeHash(
    data: Omit<MetaProviderCodeHash, 'id' | 'createdAt'>,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaProviderCodeHash>> {
    const { data: row, error } = await this.db
      .from('meta_provider_code_hashes')
      .insert({
        oauth_state_id: data.oauthStateId,
        provider_code_hash: data.providerCodeHash,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapMetaProviderCodeHash(row) }
  }

  async getProviderCodeHash(
    oauthStateId: string,
  ): Promise<import('@/core/business-context/types').ServiceResult<MetaProviderCodeHash | null>> {
    const { data, error } = await this.db
      .from('meta_provider_code_hashes')
      .select('*')
      .eq('oauth_state_id', oauthStateId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapMetaProviderCodeHash(data) : null }
  }
}
