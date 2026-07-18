import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processNextRun, startMetaSyncRunner } from '@/workers/meta-sync/runner'
import type { ServiceResult } from '@/core/business-context/types'
import type { MetaSyncRunRecord } from '@/core/meta-data/repository.port'

// ── Helpers ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-1'
const RUN_ID = 'run-1'
const ACCOUNT_ID = 'act_123'
const WORKER_ID = 'worker-1'
const LEASE_MS = 60_000

function mkRun(overrides?: Partial<MetaSyncRunRecord>): MetaSyncRunRecord {
  return {
    id: RUN_ID,
    workspaceId: WORKSPACE_ID,
    metaAdAccountId: ACCOUNT_ID,
    mode: 'initial_backfill',
    status: 'pending',
    idempotencyKey: null,
    ...overrides,
  }
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function fail<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

// ── Mock modules ───────────────────────────────────────────────────────────

vi.mock('@/workers/meta-sync/hierarchy-handler', () => ({
  runHierarchySync: vi.fn(),
}))

vi.mock('@/workers/meta-sync/insights-handler', () => ({
  runInsightsSync: vi.fn(),
}))

import { runHierarchySync } from '@/workers/meta-sync/hierarchy-handler'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'

const mockRunHierarchySync = vi.mocked(runHierarchySync)
const mockRunInsightsSync = vi.mocked(runInsightsSync)

// ── Default stubs ──────────────────────────────────────────────────────────

function defaultDeps() {
  return {
    repo: {
      getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
      getConnectionWithToken: vi.fn().mockResolvedValue(
        ok({
          id: 'conn-1',
          workspaceId: WORKSPACE_ID,
          connectedBy: 'user-1',
          metaUserId: 'meta-u-1',
          status: 'connected',
          grantedScopes: ['ads_read'],
          tokenExpiresAt: null,
          selectedAdAccountId: ACCOUNT_ID,
          selectedBusinessId: null,
          lastVerifiedAt: null,
          reconnectReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptedAccessToken: 'enc-tok',
        }),
      ),
      advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as never)),
      listAdAccounts: vi.fn().mockResolvedValue(
        ok([
          {
            id: ACCOUNT_ID,
            accountId: 'act_1',
            name: 'Test Account',
            currency: 'USD',
            timezoneName: 'UTC',
            businessId: null,
            businessName: null,
            isSelected: true,
          },
        ]),
      ),
      upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
      upsertAds: vi.fn().mockResolvedValue(ok(null)),
      upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
      upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
      upsertDailyInsights: vi.fn().mockResolvedValue(ok(null)),
      scheduleSyncRetry: vi.fn().mockResolvedValue(ok(mkRun())),
      listRunnableSyncRuns: vi.fn().mockResolvedValue(ok([mkRun()])),
      claimSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
      setSyncRunStatus: vi.fn().mockResolvedValue(ok(mkRun())),
    },
    api: {
      getCampaignsPage: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }], nextPageUrl: null }),
      getAdSetsPage: vi.fn().mockResolvedValue({ data: [{ id: 'as1' }], nextPageUrl: null }),
      getAdsPage: vi.fn().mockResolvedValue({ data: [{ id: 'ad1' }], nextPageUrl: null }),
      getCreativesPage: vi.fn().mockResolvedValue({ data: [{ id: 'cr1' }], nextPageUrl: null }),
      getDailyAdInsightsPage: vi.fn().mockResolvedValue({ data: [{ id: 'ins1' }], nextPageUrl: null }),
    },
    tokenVault: {
      decrypt: vi.fn().mockReturnValue('plain-token'),
    },
    today: vi.fn().mockReturnValue('2025-01-15'),
    workerId: WORKER_ID,
    leaseMs: LEASE_MS,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRunHierarchySync.mockResolvedValue({ ok: true, data: undefined as void })
  mockRunInsightsSync.mockResolvedValue({ ok: true, data: undefined as void })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('processNextRun', () => {
  it('no runnable runs → returns false, claimSyncRun not called', async () => {
    const d = defaultDeps()
    d.repo.listRunnableSyncRuns.mockResolvedValue(ok([]))

    const result = await processNextRun(d)

    expect(result).toBe(false)
    expect(d.repo.claimSyncRun).not.toHaveBeenCalled()
  })

  it('claim returns null data → returns false, handlers not called', async () => {
    const d = defaultDeps()
    d.repo.claimSyncRun.mockResolvedValue(ok(null))

    const result = await processNextRun(d)

    expect(result).toBe(false)
    expect(mockRunHierarchySync).not.toHaveBeenCalled()
    expect(mockRunInsightsSync).not.toHaveBeenCalled()
  })

  it('initial_backfill success → hierarchy then insights called, completed', async () => {
    const d = defaultDeps()

    const result = await processNextRun(d)

    expect(result).toBe(true)
    expect(mockRunHierarchySync).toHaveBeenCalledOnce()
    expect(mockRunInsightsSync).toHaveBeenCalledOnce()

    const hierarchyIdx = mockRunHierarchySync.mock.invocationCallOrder[0]
    const insightsIdx = mockRunInsightsSync.mock.invocationCallOrder[0]
    expect(hierarchyIdx).toBeLessThan(insightsIdx)

    expect(d.repo.setSyncRunStatus).toHaveBeenCalledWith(RUN_ID, 'completed')
  })

  it('initial_backfill hierarchy fails with PROVIDER_ERROR → insights NOT called, failed', async () => {
    const d = defaultDeps()
    mockRunHierarchySync.mockResolvedValue(
      fail('PROVIDER_ERROR', 'API returned 400'),
    )

    const result = await processNextRun(d)

    expect(result).toBe(true)
    expect(mockRunHierarchySync).toHaveBeenCalledOnce()
    expect(mockRunInsightsSync).not.toHaveBeenCalled()
    expect(d.repo.setSyncRunStatus).toHaveBeenCalledWith(
      RUN_ID,
      'failed',
      'API returned 400',
    )
  })

  it('initial_backfill hierarchy fails with RETRYABLE_ERROR → scheduleSyncRetry called, setSyncRunStatus NOT called', async () => {
    const d = defaultDeps()
    mockRunHierarchySync.mockResolvedValue(
      fail('RETRYABLE_ERROR', 'Rate limited'),
    )

    const result = await processNextRun(d)

    expect(result).toBe(true)
    expect(mockRunHierarchySync).toHaveBeenCalledOnce()
    expect(mockRunInsightsSync).not.toHaveBeenCalled()
    expect(d.repo.scheduleSyncRetry).toHaveBeenCalledWith(WORKSPACE_ID, RUN_ID)
    expect(d.repo.setSyncRunStatus).not.toHaveBeenCalled()
  })

  it('manual_refresh → only insights called, completed on ok', async () => {
    const d = defaultDeps()
    d.repo.listRunnableSyncRuns.mockResolvedValue(ok([mkRun({ mode: 'manual_refresh' })]))
    d.repo.claimSyncRun.mockResolvedValue(ok(mkRun({ mode: 'manual_refresh' })))

    const result = await processNextRun(d)

    expect(result).toBe(true)
    expect(mockRunHierarchySync).not.toHaveBeenCalled()
    expect(mockRunInsightsSync).toHaveBeenCalledOnce()
    expect(d.repo.setSyncRunStatus).toHaveBeenCalledWith(RUN_ID, 'completed')
  })

  it('handler throws non-retryable → setSyncRunStatus failed', async () => {
    const d = defaultDeps()
    mockRunHierarchySync.mockRejectedValue({ status: 400, message: 'Invalid param' })

    const result = await processNextRun(d)

    expect(result).toBe(true)
    expect(d.repo.setSyncRunStatus).toHaveBeenCalledWith(
      RUN_ID,
      'failed',
      expect.any(String),
    )
  })
})

describe('startMetaSyncRunner', () => {
  it('calls processNextRun immediately and on interval, stop clears', async () => {
    const d = defaultDeps()
    vi.useFakeTimers()

    const { stop } = startMetaSyncRunner(d, 1000)

    // Immediate tick (may not resolve instantly, but call was made)
    await vi.advanceTimersByTimeAsync(0)
    expect(d.repo.listRunnableSyncRuns).toHaveBeenCalledTimes(1)

    // Second tick after interval
    await vi.advanceTimersByTimeAsync(1000)
    expect(d.repo.listRunnableSyncRuns).toHaveBeenCalledTimes(2)

    stop()

    await vi.advanceTimersByTimeAsync(1000)
    expect(d.repo.listRunnableSyncRuns).toHaveBeenCalledTimes(2) // no more

    vi.useRealTimers()
  })

  it('logs error but does not throw on unexpected failure', async () => {
    const d = defaultDeps()
    d.repo.listRunnableSyncRuns.mockRejectedValue(new Error('boom'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.useFakeTimers()

    const { stop } = startMetaSyncRunner(d, 1000)
    await vi.advanceTimersByTimeAsync(0)

    expect(spy).toHaveBeenCalledWith(
      '[meta-sync-runner] unexpected error:',
      expect.any(Error),
    )

    stop()
    spy.mockRestore()
    vi.useRealTimers()
  })
})
