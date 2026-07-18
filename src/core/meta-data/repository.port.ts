import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from './entities'

export interface MetaOAuthStateRecord {
  id: string
  workspaceId: string
  createdBy: string
  nonceHash: string
  returnPath: string
  expiresAt: Date
  consumedAt: Date | null
  providerCodeHash: string | null
  createdAt: Date
}

export interface MetaConnectionRecord extends MetaConnectionStatusView {
  encryptedAccessToken: string
}

export interface CreateOAuthStateInput {
  workspaceId: string
  createdBy: string
  nonceHash: string
  returnPath: string
  expiresAt: Date
}

export interface ConsumeOAuthStateInput {
  stateId: string
  nonceHash: string
  providerCodeHash: string
  now: Date
}

export interface UpsertConnectionInput {
  workspaceId: string
  connectedBy: string
  metaUserId: string
  encryptedAccessToken: string
  grantedScopes: string[]
  tokenExpiresAt: Date | null
}

export interface UpsertMetaAdAccountInput {
  id: string
  accountId: string
  name: string
  currency: string | null
  timezoneName: string | null
  businessId: string | null
  businessName: string | null
  rawMetadata: Record<string, unknown>
}

export interface UpsertAdAccountsInput {
  workspaceId: string
  connectionId: string
  accounts: UpsertMetaAdAccountInput[]
}

export interface SelectAdAccountInput {
  workspaceId: string
  metaAccountId: string
  businessId: string
}

export interface CreateSyncRunInput {
  workspaceId: string
  metaAdAccountId: string
  mode: string
  idempotencyKey?: string
}

export interface MetaSyncRunRecord {
  id: string
  workspaceId: string
  metaAdAccountId: string
  mode: string
  status: string
  idempotencyKey: string | null
}

export interface AdvanceCheckpointInput {
  workspaceId: string
  runId: string
  partitionKey: string
  status: string
  cursor: JsonValue | null
}

export interface MetaSyncCheckpointRecord {
  id: string
  workspaceId: string
  runId: string
  partitionKey: string
  status: string
  cursor: JsonValue | null
}

export interface DailyInsightInput {
  metaCampaignId?: string
  metaAdSetId?: string
  metaAdId?: string
  dateStart?: string
  dateStop?: string
  spend?: number | string
  impressions?: number | string
  reach?: number | string
  frequency?: number | string
  clicks?: number | string
  linkClicks?: number | string
  landingPageViews?: number | string
  actions?: unknown[]
  actionValues?: unknown[]
  attributionSetting?: string
  dataCompletenessState?: string
  [key: string]: unknown
}

export interface UpsertDailyInsightsInput {
  workspaceId: string
  metaAdAccountId: string
  runId: string
  apiVersion: string
  accountTimezone: string
  currency: string
  insights: DailyInsightInput[]
}

export interface MetaDailyInsightRecord {
  id: string
  workspaceId: string
  metaAdAccountId: string
  metaCampaignId: string | null
  metaAdSetId: string | null
  metaAdId: string
  dateStart: string
  dateStop: string
  spend: number | null
  impressions: number | null
  reach: number | null
  frequency: number | null
  clicks: number | null
  linkClicks: number | null
  landingPageViews: number | null
  actions: unknown[]
  actionValues: unknown[]
  attributionSetting: string
  currency: string | null
  accountTimezone: string | null
  dataCompletenessState: string
  metaSyncRunId: string | null
  apiVersion: string
  createdAt: Date
  updatedAt: Date
}

export interface DataFreshnessInput {
  workspaceId: string
  metaAdAccountId: string
  since?: string
  until?: string
}

export interface DataFreshnessResult {
  latestDate: string | null
  missingWindowCount: number
  gapCount: number
}

export interface ListDailyInsightsInput {
  workspaceId: string
  metaAdAccountId: string
  since: string
  until: string
}

export interface UpsertCampaignsInput {
  workspaceId: string
  metaAdAccountId: string
  runId: string
  campaigns: Record<string, unknown>[]
}

export interface UpsertAdsInput {
  workspaceId: string
  metaAdAccountId: string
  runId: string
  ads: Record<string, unknown>[]
}

export interface UpsertAdSetsInput {
  workspaceId: string
  metaAdAccountId: string
  runId: string
  adSets: Record<string, unknown>[]
}

export interface UpsertCreativesInput {
  workspaceId: string
  metaAdAccountId: string
  runId: string
  creatives: Record<string, unknown>[]
}

export interface QuarantineRecordsInput {
  workspaceId: string
  runId: string
  objectType: string
  records: Array<{ externalId: string | null; payload: Record<string, unknown>; reason: string }>
}

export interface MetaRepositoryPort {
  createOAuthState(input: CreateOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>>
  consumeOAuthState(input: ConsumeOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>>
  upsertConnection(input: UpsertConnectionInput): Promise<ServiceResult<MetaConnectionRecord>>
  getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
  getStatus(workspaceId: string): Promise<ServiceResult<MetaConnectionStatusView[]>>
  disconnectConnection(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
  upsertAdAccounts(input: UpsertAdAccountsInput): Promise<ServiceResult<MetaAdAccountSummary[]>>
  listAdAccounts(workspaceId: string, connectionId?: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
  selectAdAccount(input: SelectAdAccountInput): Promise<ServiceResult<MetaAdAccountSummary>>
  createSyncRun(input: CreateSyncRunInput): Promise<ServiceResult<MetaSyncRunRecord>>
  getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>>
  scheduleSyncRetry(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord>>
  advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>>
  upsertDailyInsights(input: UpsertDailyInsightsInput): Promise<ServiceResult<unknown>>
  getDataFreshness(input: DataFreshnessInput): Promise<ServiceResult<DataFreshnessResult>>
  listDailyInsights(input: ListDailyInsightsInput): Promise<ServiceResult<MetaDailyInsightRecord[]>>
  upsertCampaigns(input: UpsertCampaignsInput): Promise<ServiceResult<unknown>>
  upsertAds(input: UpsertAdsInput): Promise<ServiceResult<unknown>>
  upsertAdSets(input: UpsertAdSetsInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>>
  upsertCreatives(input: UpsertCreativesInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>>
  claimSyncRun(runId: string, workerId: string, leaseMs: number): Promise<ServiceResult<MetaSyncRunRecord | null>>
  listRunnableSyncRuns(limit: number): Promise<ServiceResult<MetaSyncRunRecord[]>>
  setSyncRunStatus(runId: string, status: 'completed' | 'failed', errorMessage?: string): Promise<ServiceResult<MetaSyncRunRecord>>
  getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>>
  quarantineRecords(input: QuarantineRecordsInput): Promise<ServiceResult<{ quarantined: number }>>
}
