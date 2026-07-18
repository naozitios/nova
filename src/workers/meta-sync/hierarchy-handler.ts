import type { ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'
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
    getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>>
    getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>>
    getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
    advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>>
    upsertCampaigns(input: { workspaceId: string; metaAdAccountId: string; runId: string; campaigns: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertAds(input: { workspaceId: string; metaAdAccountId: string; runId: string; ads: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertAdSets(input: { workspaceId: string; metaAdAccountId: string; runId: string; adSets: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    upsertCreatives(input: { workspaceId: string; metaAdAccountId: string; runId: string; creatives: Record<string, unknown>[] }): Promise<ServiceResult<unknown>>
    listAdAccounts(workspaceId: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
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
  input: { runId: string; workspaceId: string },
  deps: HierarchyHandlerDeps,
): Promise<ServiceResult<void>> {
  const runResult = await deps.repo.getSyncRun(input.workspaceId, input.runId)
  if (!runResult.ok) return runResult
  if (!runResult.data) {
    return { ok: false, error: { code: 'RUN_NOT_FOUND', message: `Sync run ${input.runId} not found` } }
  }

  const run = runResult.data

  const accountsResult = await deps.repo.listAdAccounts(run.workspaceId)
  if (!accountsResult.ok) return accountsResult
  const metaAccount = accountsResult.data.find((a) => a.id === run.metaAdAccountId)
  if (!metaAccount) {
    return { ok: false, error: { code: 'AD_ACCOUNT_NOT_FOUND', message: 'Selected Meta ad account not found' } }
  }
  const metaAccountId = metaAccount.accountId

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

    const { result: partitionResult, lastCursor } = await processPartition(
      partition.objectType,
      run,
      metaAccountId,
      accessToken,
      deps,
    )

    if (!partitionResult.ok) {
      await deps.repo.advanceCheckpoint({
        workspaceId: run.workspaceId,
        runId: run.id,
        partitionKey: partition.objectType,
        status: 'retry_pending',
        cursor: lastCursor,
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
  metaAccountId: string,
  accessToken: string,
  deps: HierarchyHandlerDeps,
): Promise<{ result: ServiceResult<unknown>; lastCursor: string | null }> {
  const { api, repo } = deps
  const ctx = { workspaceId: run.workspaceId, metaAdAccountId: run.metaAdAccountId, runId: run.id }

  const fetchPage = (after?: string): Promise<PageResult> => {
    switch (objectType) {
      case 'campaigns': return api.getCampaignsPage(metaAccountId, accessToken, after)
      case 'ad_sets': return api.getAdSetsPage(metaAccountId, accessToken, after)
      case 'ads': return api.getAdsPage(metaAccountId, accessToken, after)
      case 'creatives': return api.getCreativesPage(metaAccountId, accessToken, after)
      default: return Promise.resolve({ data: [], nextPageUrl: null })
    }
  }

  const upsertPage = (data: Record<string, unknown>[]): Promise<ServiceResult<unknown>> => {
    switch (objectType) {
      case 'campaigns': return repo.upsertCampaigns({ ...ctx, campaigns: data })
      case 'ad_sets': return repo.upsertAdSets({ ...ctx, adSets: data })
      case 'ads': return repo.upsertAds({ ...ctx, ads: data })
      case 'creatives': return repo.upsertCreatives({ ...ctx, creatives: data })
      default: return Promise.resolve({ ok: true, data: null })
    }
  }

  let cursor: string | undefined
  let lastCursor: string | null = null
  try {
    do {
      const page = await fetchPage(cursor)

      if (page.data.length > 0) {
        const upsertResult = await upsertPage(page.data as Record<string, unknown>[])
        if (!upsertResult.ok) return { result: upsertResult, lastCursor: cursor ?? null }
      }

      if (page.nextPageUrl) {
        const afterMatch = page.nextPageUrl.match(/after=([^&]+)/)
        cursor = afterMatch?.[1]
        if (!cursor) throw new Error('nextPageUrl missing after cursor')
      } else {
        cursor = undefined
      }

      lastCursor = cursor ?? null

      await repo.advanceCheckpoint({
        workspaceId: run.workspaceId,
        runId: run.id,
        partitionKey: objectType,
        status: 'in_progress',
        cursor: lastCursor,
      })
    } while (cursor)

    return { result: { ok: true, data: null }, lastCursor: null }
  } catch (error) {
    const classification = classifyMetaSyncError(error)
    if (classification === 'retryable') {
      return {
        result: {
          ok: false,
          error: {
            code: 'RETRYABLE_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        },
        lastCursor: lastCursor,
      }
    }
    return {
      result: {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
      },
      lastCursor: lastCursor,
    }
  }
}
