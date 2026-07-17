import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from '@/core/meta-data/entities'
import type {
  AdvanceCheckpointInput,
  ConsumeOAuthStateInput,
  CreateOAuthStateInput,
  CreateSyncRunInput,
  MetaConnectionRecord,
  MetaOAuthStateRecord,
  MetaRepositoryPort,
  MetaSyncCheckpointRecord,
  MetaSyncRunRecord,
  SelectAdAccountInput,
  UpsertAdAccountsInput,
  UpsertAdsInput,
  UpsertCampaignsInput,
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

function mapSyncRun(row: Row): MetaSyncRunRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metaAdAccountId: String(row.meta_ad_account_id),
    mode: String(row.mode),
    status: String(row.status),
    idempotencyKey: row.idempotency_key ? String(row.idempotency_key) : null,
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

  async createSyncRun(input: CreateSyncRunInput): Promise<ServiceResult<MetaSyncRunRecord>> {
    const { data, error } = await this.db
      .from('meta_sync_runs')
      .insert({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        mode: input.mode,
        status: 'queued',
        idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
      })
      .select('*')
      .single()

    if (error) return err('CREATE_SYNC_RUN_FAILED', error.message)
    return ok(mapSyncRun(data as Row))
  }

  async getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>> {
    const { data, error } = await this.db
      .from('meta_sync_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .maybeSingle()

    if (error) return err('READ_SYNC_RUN_FAILED', error.message)
    return ok(data ? mapSyncRun(data as Row) : null)
  }

  async scheduleSyncRetry(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord>> {
    const { data: existing, error: readErr } = await this.db
      .from('meta_sync_runs')
      .select('id, attempt_count')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .single()

    if (readErr || !existing) return err('SYNC_RUN_NOT_FOUND', 'Sync run not found')

    const updatePayload: Row = {
      status: 'retry_scheduled',
      locked_by: null,
      locked_at: null,
    }
    if (existing.attempt_count != null) {
      updatePayload.attempt_count = (existing.attempt_count as number) + 1
    }

    const { data, error } = await this.db
      .from('meta_sync_runs')
      .update(updatePayload)
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .select('*')
      .single()

    if (error) return err('SCHEDULE_SYNC_RETRY_FAILED', error.message)
    return ok(mapSyncRun(data as Row))
  }

  async advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>> {
    const { data, error } = await this.db
      .from('meta_sync_checkpoints')
      .upsert(
        {
          workspace_id: input.workspaceId,
          run_id: input.runId,
          partition_key: input.partitionKey,
        status: input.status,
        cursor: input.cursor != null ? String(input.cursor) : null,
        },
        { onConflict: 'run_id,partition_key' },
      )
      .select('*')
      .single()

    if (error) return err('ADVANCE_CHECKPOINT_FAILED', error.message)
    return ok({
      id: String(data.id),
      workspaceId: String(data.workspace_id),
      runId: String(data.run_id),
      partitionKey: String(data.partition_key),
      status: String(data.status),
      cursor: data.cursor as JsonValue | null,
    })
  }

  async upsertCampaigns(input: UpsertCampaignsInput): Promise<ServiceResult<unknown>> {
    if (input.campaigns.length === 0) return ok(null)
    const now = new Date().toISOString()
    const rows = input.campaigns.map((c) => ({
      workspace_id: input.workspaceId,
      meta_ad_account_id: input.metaAdAccountId,
      meta_campaign_id: String(c.id),
      name: String(c.name ?? ''),
      objective: c.objective ? String(c.objective) : null,
      effective_status: c.effective_status ? String(c.effective_status) : null,
      configured_status: c.configured_status ? String(c.configured_status) : null,
      buying_type: c.buying_type ? String(c.buying_type) : null,
      start_time: c.start_time ? String(c.start_time) : null,
      stop_time: c.stop_time ? String(c.stop_time) : null,
      provider_created_time: c.created_time ? String(c.created_time) : null,
      provider_updated_time: c.updated_time ? String(c.updated_time) : null,
      raw_metadata_json: c,
      meta_sync_run_id: input.runId,
      last_seen_at: now,
      updated_at: now,
    }))
    const { error } = await this.db
      .from('meta_campaigns')
      .upsert(rows, { onConflict: 'workspace_id,meta_ad_account_id,meta_campaign_id' })
    if (error) return err('UPSERT_CAMPAIGNS_FAILED', error.message)
    return ok(null)
  }

  async upsertAds(input: UpsertAdsInput): Promise<ServiceResult<unknown>> {
    if (input.ads.length === 0) return ok(null)
    const now = new Date().toISOString()
    const validAds: Row[] = []
    const quarantinePayloads: Array<{ ad: Record<string, unknown>; validationErrors: string }> = []

    for (const ad of input.ads) {
      const adsetMetaId = ad.adset_id ? String(ad.adset_id) : null
      if (!adsetMetaId) {
        quarantinePayloads.push({ ad, validationErrors: 'Missing adset_id' })
        continue
      }
      const { data: adset } = await this.db
        .from('meta_ad_sets')
        .select('id')
        .eq('workspace_id', input.workspaceId)
        .eq('meta_ad_account_id', input.metaAdAccountId)
        .eq('meta_ad_set_id', adsetMetaId)
        .maybeSingle()
      if (!adset) {
        quarantinePayloads.push({ ad, validationErrors: `Parent meta_ad_set not found: ${adsetMetaId}` })
        continue
      }
      validAds.push({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_ad_id: String(ad.id),
        meta_campaign_id: ad.campaign_id ? String(ad.campaign_id) : null,
        meta_ad_set_id: adsetMetaId,
        name: ad.name ? String(ad.name) : null,
        effective_status: ad.effective_status ? String(ad.effective_status) : null,
        configured_status: ad.configured_status ? String(ad.configured_status) : null,
        provider_created_time: ad.created_time ? String(ad.created_time) : null,
        provider_updated_time: ad.updated_time ? String(ad.updated_time) : null,
        raw_metadata_json: ad,
        meta_sync_run_id: input.runId,
        last_seen_at: now,
        updated_at: now,
      })
    }

    if (validAds.length > 0) {
      const { error } = await this.db
        .from('meta_ads')
        .upsert(validAds, { onConflict: 'workspace_id,meta_ad_account_id,meta_ad_id' })
      if (error) return err('UPSERT_ADS_FAILED', error.message)
    }

    if (quarantinePayloads.length > 0) {
      const qRows = quarantinePayloads.map((q) => ({
        workspace_id: input.workspaceId,
        source_table: 'meta_ads',
        provider_id: String(q.ad.id),
        redacted_payload: q.ad as JsonValue,
        validation_errors: [q.validationErrors] as JsonValue,
      }))
      const { error } = await this.db.from('meta_quarantined_records').insert(qRows)
      if (error) return err('QUARANTINE_ADS_FAILED', error.message)
    }

    return ok(null)
  }
}
