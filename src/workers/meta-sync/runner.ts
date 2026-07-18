import type { ServiceResult } from '@/core/business-context/types'
import type { MetaSyncRunRecord } from '@/core/meta-data/repository.port'
import { classifyMetaSyncError } from '@/core/meta-data/sync-policy'
import { runHierarchySync } from './hierarchy-handler'
import { runInsightsSync } from './insights-handler'
import type { HierarchyHandlerDeps } from './hierarchy-handler'
import type { InsightsHandlerDeps } from './insights-handler'

export interface MetaSyncRunnerDeps {
  repo: HierarchyHandlerDeps['repo'] &
    InsightsHandlerDeps['repo'] & {
      listRunnableSyncRuns(
        limit: number,
      ): Promise<ServiceResult<MetaSyncRunRecord[]>>
      claimSyncRun(
        runId: string,
        workerId: string,
        leaseMs: number,
      ): Promise<ServiceResult<MetaSyncRunRecord | null>>
      setSyncRunStatus(
        runId: string,
        status: 'completed' | 'failed',
        errorMessage?: string,
      ): Promise<ServiceResult<MetaSyncRunRecord>>
    }
  api: HierarchyHandlerDeps['api'] & InsightsHandlerDeps['api']
  tokenVault: { decrypt(ciphertext: string): string }
  today(): string
  workerId: string
  leaseMs: number
}

/**
 * Process one sync run from the queue.
 * Returns true if a run was processed (regardless of success/failure).
 */
export async function processNextRun(deps: MetaSyncRunnerDeps): Promise<boolean> {
  const listResult = await deps.repo.listRunnableSyncRuns(1)
  if (!listResult.ok) return false

  const runs = listResult.data
  if (runs.length === 0) return false

  const run = runs[0]

  const claimResult = await deps.repo.claimSyncRun(run.id, deps.workerId, deps.leaseMs)
  if (!claimResult.ok) return false
  if (!claimResult.data) return false

  let result: ServiceResult<void>

  try {
    if (run.mode === 'initial_backfill') {
      const hierarchyResult = await runHierarchySync({ runId: run.id, workspaceId: run.workspaceId }, deps)
      if (!hierarchyResult.ok) {
        result = hierarchyResult
      } else {
        result = await runInsightsSync({ runId: run.id, workspaceId: run.workspaceId }, deps)
      }
    } else {
      result = await runInsightsSync({ runId: run.id, workspaceId: run.workspaceId }, deps)
    }
  } catch (error) {
    const classification = classifyMetaSyncError(error)
    try {
      if (classification === 'retryable') {
        await deps.repo.scheduleSyncRetry(run.workspaceId, run.id)
      } else {
        const message = error instanceof Error ? error.message : String(error)
        await deps.repo.setSyncRunStatus(run.id, 'failed', message)
      }
    } catch (statusErr) {
      console.error('[meta-sync-runner] terminal status update failed', statusErr)
    }
    return true
  }

  if (result.ok) {
    try {
      await deps.repo.setSyncRunStatus(run.id, 'completed')
    } catch (statusErr) {
      console.error('[meta-sync-runner] terminal status update failed', statusErr)
    }
    return true
  }

  if (result.error.code === 'RETRYABLE_ERROR') {
    try {
      if (run.mode === 'initial_backfill') {
        await deps.repo.scheduleSyncRetry(run.workspaceId, run.id)
      }
    } catch (statusErr) {
      console.error('[meta-sync-runner] terminal status update failed', statusErr)
    }
    return true
  }

  try {
    await deps.repo.setSyncRunStatus(run.id, 'failed', result.error.message)
  } catch (statusErr) {
    console.error('[meta-sync-runner] terminal status update failed', statusErr)
  }
  return true
}

/**
 * Start a polling loop that processes sync runs.
 * Returns a stop function to clear the interval.
 */
export function startMetaSyncRunner(
  deps: MetaSyncRunnerDeps,
  pollMs: number,
): { stop(): void } {
  const tick = async () => {
    try {
      await processNextRun(deps)
    } catch (error) {
      console.error('[meta-sync-runner] unexpected error:', error)
    }
  }

  // Immediate first tick
  tick()

  const intervalId = setInterval(() => {
    tick()
  }, pollMs)

  return {
    stop() {
      clearInterval(intervalId)
    },
  }
}
