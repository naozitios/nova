import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from '@/core/meta-data/entities'
import type {
  ConsumeOAuthStateInput,
  CreateOAuthStateInput,
  MetaConnectionRecord,
  MetaOAuthStateRecord,
  MetaRepositoryPort,
  SelectAdAccountInput,
  UpsertAdAccountsInput,
  UpsertConnectionInput,
} from '@/core/meta-data/repository.port'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'

type Row = Record<string, unknown>

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function err<T>(code: string, message: string, details?: Record<string, JsonValue>): ServiceResult<T> {
  return { ok: false, error: { code, message, details } }
}

function toDate(value: unknown): Date {
  return new Date(String(value))
}

function mapOAuthState(row: Row): MetaOAuthStateRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    createdBy: String(row.created_by),
    nonceHash: String(row.state_nonce_hash),
    returnPath: String(row.return_path),
    expiresAt: toDate(row.expires_at),
    consumedAt: row.consumed_at ? toDate(row.consumed_at) : null,
    providerCodeHash: row.provider_code_hash ? String(row.provider_code_hash) : null,
    createdAt: toDate(row.created_at),
  }
}

function mapConnectionStatus(row: Row): MetaConnectionStatusView {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    connectedBy: String(row.connected_by),
    metaUserId: String(row.meta_user_id),
    status: row.status as MetaConnectionStatusView['status'],
    grantedScopes: Array.isArray(row.granted_scopes) ? row.granted_scopes.map(String) : [],
    tokenExpiresAt: row.token_expires_at ? toDate(row.token_expires_at) : null,
    selectedAdAccountId: row.selected_ad_account_id ? String(row.selected_ad_account_id) : null,
    selectedBusinessId: row.selected_business_id ? String(row.selected_business_id) : null,
    lastVerifiedAt: row.last_verified_at ? toDate(row.last_verified_at) : null,
    reconnectReason: row.reconnect_reason ? String(row.reconnect_reason) : null,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  }
}

function mapConnection(row: Row): MetaConnectionRecord {
  return {
    ...mapConnectionStatus(row),
    encryptedAccessToken: String(row.encrypted_access_token),
  }
}

function mapAdAccount(row: Row): MetaAdAccountSummary {
  return {
    id: String(row.meta_account_id),
    accountId: String(row.account_id),
    name: String(row.name),
    currency: row.currency ? String(row.currency) : null,
    timezoneName: row.timezone_name ? String(row.timezone_name) : null,
    businessId: row.business_id ? String(row.business_id) : null,
    businessName: row.meta_business_name ? String(row.meta_business_name) : null,
    isSelected: Boolean(row.is_selected),
  }
}

export class SupabaseMetaRepository implements MetaRepositoryPort {
  constructor(private readonly db: SupabaseClient = getSupabaseServiceClient()) {}

  async createOAuthState(input: CreateOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>> {
    const { data, error } = await this.db
      .from('meta_oauth_states')
      .insert({
        workspace_id: input.workspaceId,
        created_by: input.createdBy,
        state_nonce_hash: input.nonceHash,
        return_path: input.returnPath,
        expires_at: input.expiresAt.toISOString(),
      })
      .select('*')
      .single()

    if (error) return err('CREATE_OAUTH_STATE_FAILED', error.message)
    return ok(mapOAuthState(data as Row))
  }

  async consumeOAuthState(input: ConsumeOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>> {
    const replay = await this.db
      .from('meta_oauth_states')
      .select('id')
      .eq('provider_code_hash', input.providerCodeHash)
      .limit(1)
    if (replay.error) return err('READ_FAILED', replay.error.message)
    if ((replay.data ?? []).length > 0) return err('CODE_REPLAYED', 'Meta OAuth provider code was already used')

    const current = await this.db
      .from('meta_oauth_states')
      .select('*')
      .eq('id', input.stateId)
      .eq('state_nonce_hash', input.nonceHash)
      .single()
    if (current.error || !current.data) return err('OAUTH_CALLBACK_REPLAYED', 'Meta OAuth state was not found')

    const state = mapOAuthState(current.data as Row)
    if (state.consumedAt || state.expiresAt <= input.now) {
      return err('OAUTH_CALLBACK_REPLAYED', 'Meta OAuth state was already consumed or expired')
    }

    const { data, error } = await this.db
      .from('meta_oauth_states')
      .update({ consumed_at: input.now.toISOString(), provider_code_hash: input.providerCodeHash })
      .eq('id', input.stateId)
      .is('consumed_at', null)
      .select('*')
      .single()

    if (error || !data) return err('OAUTH_CALLBACK_REPLAYED', error?.message ?? 'Meta OAuth state was already consumed')
    return ok(mapOAuthState(data as Row))
  }

  async upsertConnection(input: UpsertConnectionInput): Promise<ServiceResult<MetaConnectionRecord>> {
    const existing = await this.db
      .from('meta_connections')
      .select('id')
      .eq('workspace_id', input.workspaceId)
      .eq('meta_user_id', input.metaUserId)
      .in('status', ['pending', 'connected', 'degraded', 'reconnect_required'])
      .maybeSingle()
    if (existing.error) return err('READ_CONNECTION_FAILED', existing.error.message)

    const payload = {
      workspace_id: input.workspaceId,
      connected_by: input.connectedBy,
      meta_user_id: input.metaUserId,
      encrypted_access_token: input.encryptedAccessToken,
      granted_scopes: input.grantedScopes,
      token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
      status: 'connected',
      last_verified_at: new Date().toISOString(),
      reconnect_reason: null,
      updated_at: new Date().toISOString(),
    }

    const query = existing.data
      ? this.db.from('meta_connections').update(payload).eq('id', String(existing.data.id))
      : this.db.from('meta_connections').insert(payload)

    const { data, error } = await query.select('*').single()

    if (error) return err('UPSERT_CONNECTION_FAILED', error.message)
    return ok(mapConnection(data as Row))
  }

  async getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>> {
    const { data, error } = await this.db
      .from('meta_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['connected', 'degraded'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) return err('READ_CONNECTION_FAILED', error.message)
    return ok(data ? mapConnection(data as Row) : null)
  }

  async getStatus(workspaceId: string): Promise<ServiceResult<MetaConnectionStatusView[]>> {
    const { data, error } = await this.db
      .from('meta_connections')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })

    if (error) return err('READ_STATUS_FAILED', error.message)
    return ok((data ?? []).map((row) => mapConnectionStatus(row as Row)))
  }

  async upsertAdAccounts(input: UpsertAdAccountsInput): Promise<ServiceResult<MetaAdAccountSummary[]>> {
    if (input.accounts.length === 0) return ok([])
    const rows = input.accounts.map((account) => ({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId,
      business_id: account.businessId,
      meta_account_id: account.id,
      account_id: account.accountId,
      name: account.name,
      currency: account.currency,
      timezone_name: account.timezoneName,
      meta_business_id: account.businessId,
      meta_business_name: account.businessName,
      raw_metadata: account.rawMetadata,
      updated_at: new Date().toISOString(),
    }))
    const { data, error } = await this.db
      .from('meta_ad_accounts')
      .upsert(rows, { onConflict: 'workspace_id,connection_id,meta_account_id' })
      .select('*')

    if (error) return err('UPSERT_AD_ACCOUNTS_FAILED', error.message)
    return ok((data ?? []).map((row) => mapAdAccount(row as Row)))
  }

  async listAdAccounts(workspaceId: string, connectionId?: string): Promise<ServiceResult<MetaAdAccountSummary[]>> {
    let query = this.db
      .from('meta_ad_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('name', { ascending: true })
    if (connectionId) query = query.eq('connection_id', connectionId)
    const { data, error } = await query
    if (error) return err('LIST_AD_ACCOUNTS_FAILED', error.message)
    return ok((data ?? []).map((row) => mapAdAccount(row as Row)))
  }

  async selectAdAccount(input: SelectAdAccountInput): Promise<ServiceResult<MetaAdAccountSummary>> {
    const existing = await this.db
      .from('meta_ad_accounts')
      .select('connection_id')
      .eq('workspace_id', input.workspaceId)
      .eq('meta_account_id', input.metaAccountId)
      .maybeSingle()
    if (existing.error) return err('READ_AD_ACCOUNT_FAILED', existing.error.message)
    if (!existing.data) return err('AD_ACCOUNT_NOT_FOUND', 'Meta ad account is not available for this workspace')

    await this.db
      .from('meta_ad_accounts')
      .update({ is_selected: false, business_id: null, updated_at: new Date().toISOString() })
      .eq('workspace_id', input.workspaceId)
      .eq('business_id', input.businessId)

    const { data, error } = await this.db
      .from('meta_ad_accounts')
      .update({ is_selected: true, business_id: input.businessId, updated_at: new Date().toISOString() })
      .eq('workspace_id', input.workspaceId)
      .eq('meta_account_id', input.metaAccountId)
      .select('*')
      .single()

    if (error) return err('SELECT_AD_ACCOUNT_FAILED', error.message)
    return ok(mapAdAccount(data as Row))
  }
}
