import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from '@/core/meta-data/entities'
import type {
  AdvanceCheckpointInput,
  ConsumeOAuthStateInput,
  CreateOAuthStateInput,
  CreateSyncRunInput,
  DataFreshnessInput,
  DataFreshnessResult,
  ListDailyInsightsInput,
  MetaConnectionRecord,
  MetaDailyInsightRecord,
  MetaOAuthStateRecord,
  MetaRepositoryPort,
  MetaSyncCheckpointRecord,
  MetaSyncRunRecord,
  QuarantineRecordsInput,
  SelectAdAccountInput,
  UpsertAdAccountsInput,
  UpsertAdSetsInput,
  UpsertAdsInput,
  UpsertCampaignsInput,
  UpsertConnectionInput,
  UpsertCreativesInput,
  UpsertDailyInsightsInput,
} from '@/core/meta-data/repository.port'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { MetaConnectionRepository } from '@/infrastructure/meta/repositories/connection.repository'
import { MetaHierarchyRepository } from '@/infrastructure/meta/repositories/hierarchy.repository'
import { MetaInsightsRepository } from '@/infrastructure/meta/repositories/insights.repository'
import { MetaSyncRepository } from '@/infrastructure/meta/repositories/sync.repository'

export { mapSyncRun } from '@/infrastructure/meta/repositories/sync.repository'

type Row = Record<string, unknown>

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

export class SupabaseMetaRepository implements MetaRepositoryPort {
  constructor(private readonly db: SupabaseClient = getSupabaseServiceClient()) {}
  private readonly connectionRepo = new MetaConnectionRepository(this.db)
  private readonly syncRepo = new MetaSyncRepository(this.db)
  private readonly hierarchyRepo = new MetaHierarchyRepository(this.db, (rows) => this.insertQuarantinedRecords(rows))
  private readonly insightsRepo = new MetaInsightsRepository(this.db, (rows) => this.insertQuarantinedRecords(rows))

  private async insertQuarantinedRecords(rows: Row[]): Promise<ServiceResult<void>> {
    return this.syncRepo.insertQuarantinedRecords(rows)
  }

  // --- connectionRepo delegates ---

  async createOAuthState(input: CreateOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>> {
    return this.connectionRepo.createOAuthState(input)
  }

  async consumeOAuthState(input: ConsumeOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>> {
    return this.connectionRepo.consumeOAuthState(input)
  }

  async upsertConnection(input: UpsertConnectionInput): Promise<ServiceResult<MetaConnectionRecord>> {
    return this.connectionRepo.upsertConnection(input)
  }

  async getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>> {
    return this.connectionRepo.getConnectionWithToken(workspaceId)
  }

  async getStatus(workspaceId: string): Promise<ServiceResult<MetaConnectionStatusView[]>> {
    return this.connectionRepo.getStatus(workspaceId)
  }

  async disconnectConnection(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>> {
    return this.connectionRepo.disconnectConnection(workspaceId)
  }

  async upsertAdAccounts(input: UpsertAdAccountsInput): Promise<ServiceResult<MetaAdAccountSummary[]>> {
    return this.connectionRepo.upsertAdAccounts(input)
  }

  async listAdAccounts(workspaceId: string, connectionId?: string): Promise<ServiceResult<MetaAdAccountSummary[]>> {
    return this.connectionRepo.listAdAccounts(workspaceId, connectionId)
  }

  async selectAdAccount(input: SelectAdAccountInput): Promise<ServiceResult<MetaAdAccountSummary>> {
    return this.connectionRepo.selectAdAccount(input)
  }

  // --- syncRepo delegates ---

  async createSyncRun(input: CreateSyncRunInput): Promise<ServiceResult<MetaSyncRunRecord>> {
    return this.syncRepo.createSyncRun(input)
  }

  async getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>> {
    return this.syncRepo.getSyncRun(workspaceId, runId)
  }

  async scheduleSyncRetry(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord>> {
    return this.syncRepo.scheduleSyncRetry(workspaceId, runId)
  }

  async advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>> {
    return this.syncRepo.advanceCheckpoint(input)
  }

  async claimSyncRun(runId: string, workerId: string, leaseMs: number): Promise<ServiceResult<MetaSyncRunRecord | null>> {
    return this.syncRepo.claimSyncRun(runId, workerId, leaseMs)
  }

  async listRunnableSyncRuns(limit: number): Promise<ServiceResult<MetaSyncRunRecord[]>> {
    return this.syncRepo.listRunnableSyncRuns(limit)
  }

  async setSyncRunStatus(runId: string, status: 'completed' | 'failed', errorMessage?: string): Promise<ServiceResult<MetaSyncRunRecord>> {
    return this.syncRepo.setSyncRunStatus(runId, status, errorMessage)
  }

  async getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>> {
    return this.syncRepo.getCompletedCheckpointKeys(runId)
  }

  async quarantineRecords(input: QuarantineRecordsInput): Promise<ServiceResult<{ quarantined: number }>> {
    return this.syncRepo.quarantineRecords(input)
  }

  // --- hierarchyRepo delegates ---

  async upsertCampaigns(input: UpsertCampaignsInput): Promise<ServiceResult<unknown>> {
    return this.hierarchyRepo.upsertCampaigns(input)
  }

  async upsertAdSets(input: UpsertAdSetsInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>> {
    return this.hierarchyRepo.upsertAdSets(input)
  }

  async upsertAds(input: UpsertAdsInput): Promise<ServiceResult<unknown>> {
    return this.hierarchyRepo.upsertAds(input)
  }

  async upsertCreatives(input: UpsertCreativesInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>> {
    return this.hierarchyRepo.upsertCreatives(input)
  }

  // --- insightsRepo delegates ---

  async upsertDailyInsights(input: UpsertDailyInsightsInput): Promise<ServiceResult<unknown>> {
    return this.insightsRepo.upsertDailyInsights(input)
  }

  async getDataFreshness(input: DataFreshnessInput): Promise<ServiceResult<DataFreshnessResult>> {
    return this.insightsRepo.getDataFreshness(input)
  }

  async listDailyInsights(input: ListDailyInsightsInput): Promise<ServiceResult<MetaDailyInsightRecord[]>> {
    return this.insightsRepo.listDailyInsights(input)
  }
}
