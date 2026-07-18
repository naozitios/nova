import type { ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'
import type {
  MetaSyncRunRecord,
  MetaSyncCheckpointRecord,
  MetaConnectionRecord,
  AdvanceCheckpointInput,
  UpsertDailyInsightsInput,
} from '@/core/meta-data/repository.port'
import { config } from '@/infrastructure/config'
import { buildIncrementalInsightWindows, buildInitialInsightWindows, classifyMetaSyncError } from '@/core/meta-data/sync-policy'

interface PageResult {
  data: Record<string, unknown>[]
  nextPageUrl: string | null
}

export interface InsightsHandlerDeps {
  repo: {
    getSyncRun(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord | null>>
    getCompletedCheckpointKeys(runId: string): Promise<ServiceResult<string[]>>
    getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
    advanceCheckpoint(input: AdvanceCheckpointInput): Promise<ServiceResult<MetaSyncCheckpointRecord>>
    upsertDailyInsights(input: UpsertDailyInsightsInput): Promise<ServiceResult<unknown>>
    scheduleSyncRetry(workspaceId: string, runId: string): Promise<ServiceResult<MetaSyncRunRecord>>
    listAdAccounts(workspaceId: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
  }
  api: {
    getDailyAdInsightsPage(
      accountId: string,
      window: { since: string; until: string },
      accessToken: string,
      after?: string,
    ): Promise<PageResult>
  }
  tokenVault: {
    decrypt(ciphertext: string): string
  }
  today(): string
}

export async function runInsightsSync(
  input: { runId: string; workspaceId: string },
  deps: InsightsHandlerDeps,
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
  const accountTimezone = metaAccount.timezoneName ?? 'UTC'

  const windows =
    run.mode === 'initial_backfill'
      ? buildInitialInsightWindows(deps.today())
      : buildIncrementalInsightWindows(deps.today())

  const completedResult = await deps.repo.getCompletedCheckpointKeys(run.id)
  if (!completedResult.ok) return completedResult
  const completedKeys = new Set(completedResult.data)

  for (const window of windows) {
    const partitionKey = `insights:${window.since}`
    if (completedKeys.has(partitionKey)) continue

    let cursor: string | undefined
    try {
      do {
        const page = await deps.api.getDailyAdInsightsPage(metaAccountId, window, accessToken, cursor)

        if (page.data.length > 0) {
          const upsertResult = await deps.repo.upsertDailyInsights({
            workspaceId: run.workspaceId,
            metaAdAccountId: run.metaAdAccountId,
            runId: run.id,
            apiVersion: config.meta.apiVersion,
            accountTimezone,
            currency: metaAccount.currency ?? 'USD',
            insights: page.data.map((row) => ({
              metaCampaignId: row.campaign_id as string | undefined,
              metaAdSetId: row.adset_id as string | undefined,
              metaAdId: row.ad_id as string | undefined,
              dateStart: row.date_start as string | undefined,
              dateStop: row.date_stop as string | undefined,
              spend: row.spend as number | string | undefined,
              impressions: row.impressions as number | string | undefined,
              reach: row.reach as number | string | undefined,
              clicks: row.clicks as number | string | undefined,
              actions: row.actions as unknown[] | undefined,
              actionValues: row.action_values as unknown[] | undefined,
            })),
          })

          if (!upsertResult.ok) {
            await deps.repo.advanceCheckpoint({
              workspaceId: run.workspaceId,
              runId: run.id,
              partitionKey,
              status: 'retry_pending',
              cursor: cursor ?? null,
            })
            return upsertResult
          }
        }

        if (page.nextPageUrl) {
          const afterMatch = page.nextPageUrl.match(/after=([^&]+)/)
          cursor = afterMatch?.[1]
          if (!cursor) throw new Error('nextPageUrl missing after cursor')
        } else {
          cursor = undefined
        }

        await deps.repo.advanceCheckpoint({
          workspaceId: run.workspaceId,
          runId: run.id,
          partitionKey,
          status: 'in_progress',
          cursor: cursor ?? null,
        })
      } while (cursor)

      await deps.repo.advanceCheckpoint({
        workspaceId: run.workspaceId,
        runId: run.id,
        partitionKey,
        status: 'completed',
        cursor: null,
      })
    } catch (error) {
      const classification = classifyMetaSyncError(error)
      if (classification === 'retryable') {
        await deps.repo.scheduleSyncRetry(run.workspaceId, run.id)
        await deps.repo.advanceCheckpoint({
          workspaceId: run.workspaceId,
          runId: run.id,
          partitionKey,
          status: 'retry_pending',
          cursor: cursor ?? null,
        })
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

  return { ok: true, data: undefined as void }
}
