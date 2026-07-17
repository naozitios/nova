import type { ServiceResult } from '@/core/business-context/types'
import type {
  MetaSyncRunRecord,
  MetaSyncCheckpointRecord,
  MetaConnectionRecord,
  AdvanceCheckpointInput,
} from '@/core/meta-data/repository.port'
import { buildHierarchyPartitions, classifyMetaSyncError } from '@/core/meta-data/sync-policy'

/** Page response shape from Meta API page methods. */
interface PageResult {
  data: Record<string, unknown>[]
  nextPageUrl: string | null
}

export interface HierarchyHandlerDeps {
  repo: {
    getSyncRun(runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>>
    getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>>
    getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
    advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>>
    upsertCampaigns(input: { workspaceId: string; metaAdAccountId: string; runId: string; campaigns: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertAds(input: { workspaceId: string; metaAdAccountId: string; runId: string; ads: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertAdSets?(input: { workspaceId: string; metaAdAccountId: string; runId: string; adSets: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertCreatives?(input: { workspaceId: string; metaAdAccountId: string; runId: string; creatives: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
  }
  api: {
    getCampaignsPage(accountId: string, accessToken: string, after?: string): Promise<PageResult>
    getAdSetsPage(accountId: string, accessToken: string, after?: string): Promise<PageResult>
    getAdsPage(accountId: string, accessToken: string, after?: string): Promise<PageResult>
    getCreativesPage(accountId: string, accessToken: string, after?: string): Promise<PageResult>
  }
  tokenVault: {
    decrypt(ciphertext: string): string
  }
}

export async function runHierarchySync(
  input: { runId: string },
  deps: HierarchyHandlerDeps,
): Promise<ServiceResult<void>> {
  const runResult = await deps.repo.getSyncRun(input.runId)
  if (!runResult.ok) return runResult
  if (!runResult.data) {
    return { ok: false, error: { code: 'RUN_NOT_FOUND', message: `Sync run ${input.runId} not found` } }
  }

  const run = runResult.data
  const connResult = await deps.repo.getConnectionWithToken(run.workspaceId)
  if (!connResult.ok) return connResult
  if (!connResult.data) {
    return { ok: false, error: { code: 'CONNECTION_NOT_FOUND', message: 'No active Meta connection' } }
  }

  const accessToken = deps.tokenVault.decrypt(connResult.data.encryptedAccessToken)
  const partitions = buildHierarchyPartitions(run.metaAdAccountId)

  const completedResult = await deps.repo.getCompletedCheckpointKeys(run.id)
  if (!completedResult.ok) return completedResult
  const completedKeys = new Set(completedResult.data)

  for (const partition of partitions) {
    if (completedKeys.has(partition.objectType)) continue

    const partitionResult = await processPartition(
      partition.objectType,
      run,
      accessToken,
      deps,
    )

    if (!partitionResult.ok) {
      await deps.repo.advanceCheckpoint({
        workspaceId: run.workspaceId,
        runId: run.id,
        partitionKey: partition.objectType,
        status: 'retry_pending',
        cursor: null,
      })
      return partitionResult
    }

    await deps.repo.advanceCheckpoint({
      workspaceId: run.workspaceId,
      runId: run.id,
      partitionKey: partition.objectType,
      status: 'completed',
      cursor: null,
    })
  }

  return { ok: true, data: undefined as void }
}

async function processPartition(
  objectType: string,
  run: MetaSyncRunRecord,
  accessToken: string,
  deps: HierarchyHandlerDeps,
): Promise<ServiceResult<unknown>> {
  const { api, repo } = deps
  const ctx = { workspaceId: run.workspaceId, metaAdAccountId: run.metaAdAccountId, runId: run.id }

  try {
    switch (objectType) {
      case 'campaigns': {
        const page = await api.getCampaignsPage(run.metaAdAccountId, accessToken)
        return await repo.upsertCampaigns({ ...ctx, campaigns: page.data })
      }
      case 'ad_sets': {
        const page = await api.getAdSetsPage(run.metaAdAccountId, accessToken)
        if (repo.upsertAdSets) {
          return await repo.upsertAdSets({ ...ctx, adSets: page.data })
        }
        return { ok: true, data: null }
      }
      case 'ads': {
        const page = await api.getAdsPage(run.metaAdAccountId, accessToken)
        return await repo.upsertAds({ ...ctx, ads: page.data })
      }
      case 'creatives': {
        const page = await api.getCreativesPage(run.metaAdAccountId, accessToken)
        if (repo.upsertCreatives) {
          return await repo.upsertCreatives({ ...ctx, creatives: page.data })
        }
        return { ok: true, data: null }
      }
      default:
        return { ok: true, data: null }
    }
  } catch (error) {
    const classification = classifyMetaSyncError(error)
    if (classification === 'retryable') {
      return {
        ok: false,
        error: {
          code: 'RETRYABLE_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      }
    }
    return {
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
    }
  }
}
