import { describe, it, expect, vi } from 'vitest'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'
import type { ServiceResult } from '@/core/business-context/types'
import type { MetaSyncRunRecord, MetaSyncCheckpointRecord, MetaConnectionRecord } from '@/core/meta-data/repository.port'

// ── Helpers ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-1'
const RUN_ID = 'run-1'
const ACCOUNT_ID = 'act_123'
const ENCRYPTED = 'enc-tok'

function mkRun(overrides?: Partial<MetaSyncRunRecord>): MetaSyncRunRecord {
  return {
    id: RUN_ID,
    workspaceId: WORKSPACE_ID,
    metaAdAccountId: ACCOUNT_ID,
    mode: 'initial_backfill',
    status: 'running',
    idempotencyKey: null,
    ...overrides,
  }
}

function mkConn(overrides?: Partial<MetaConnectionRecord>): MetaConnectionRecord {
  return {
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
    encryptedAccessToken: ENCRYPTED,
    ...overrides,
  }
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

// ── Default stubs ──────────────────────────────────────────────────────────

function defaultDeps() {
  const calls: string[] = []

  const repo = {
    getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
    getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
    getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
    advanceCheckpoint: vi.fn().mockImplementation(async (input: { partitionKey: string; status: string }) => {
      calls.push(`checkpoint:${input.partitionKey}:${input.status}`)
      return ok({} as MetaSyncCheckpointRecord)
    }),
    upsertDailyInsights: vi.fn().mockResolvedValue(ok(null)),
    scheduleSyncRetry: vi.fn().mockResolvedValue(ok(mkRun({ status: 'retry_scheduled' }))),
  }

  const api = {
    getDailyAdInsightsPage: vi.fn().mockResolvedValue({
      data: [{ ad_id: 'ad-1', date_start: '2026-07-01', date_stop: '2026-07-01', spend: '1.23' }],
      nextPageUrl: null,
    }),
  }

  const tokenVault = {
    decrypt: vi.fn().mockReturnValue('plain-token'),
  }

  const today = vi.fn().mockReturnValue('2026-07-17')

  return { repo, api, tokenVault, today, calls }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('runInsightsSync', () => {
  it('initial_backfill creates/processes 90 complete single-day partitions', async () => {
    const d = defaultDeps()
    const result = await runInsightsSync({ runId: RUN_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledTimes(90)

    // first window: 90 days before today (2026-07-17) = 2026-04-18
    expect(d.api.getDailyAdInsightsPage).toHaveBeenNthCalledWith(
      1,
      ACCOUNT_ID,
      expect.objectContaining({ since: '2026-04-18', until: '2026-04-18' }),
      'plain-token',
    )

    // last window: yesterday = 2026-07-16
    expect(d.api.getDailyAdInsightsPage).toHaveBeenNthCalledWith(
      90,
      ACCOUNT_ID,
      expect.objectContaining({ since: '2026-07-16', until: '2026-07-16' }),
      'plain-token',
    )

    // 90 completed checkpoints
    const completedCheckpoints = d.calls.filter(c => c.endsWith(':completed'))
    expect(completedCheckpoints).toHaveLength(90)
  })

  it('skips completed windows on retry', async () => {
    const d = defaultDeps()
    d.repo.getCompletedCheckpointKeys.mockResolvedValue(ok(['insights:2026-07-15']))

    const result = await runInsightsSync({ runId: RUN_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledTimes(89)

    // skipped 2026-07-15
    expect(d.api.getDailyAdInsightsPage).not.toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ since: '2026-07-15', until: '2026-07-15' }),
      'plain-token',
    )

    // still called for 2026-07-16
    expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledWith(
      ACCOUNT_ID,
      expect.objectContaining({ since: '2026-07-16', until: '2026-07-16' }),
      'plain-token',
    )
  })

  it('provider 429 schedules retry/checkpoint', async () => {
    const d = defaultDeps()
    d.api.getDailyAdInsightsPage.mockRejectedValue({ status: 429, message: 'Rate limited' })

    const result = await runInsightsSync({ runId: RUN_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RETRYABLE_ERROR')
    }
    expect(d.repo.scheduleSyncRetry).toHaveBeenCalledWith(WORKSPACE_ID, RUN_ID)
    expect(d.calls).toContain('checkpoint:insights:2026-04-18:retry_pending')
  })

  it('invalid records quarantined by repository do not block valid windows', async () => {
    const d = defaultDeps()
    // API returns data missing date_start — upsert quarantines and returns ok
    d.api.getDailyAdInsightsPage.mockResolvedValue({
      data: [{ ad_id: 'ad-1', spend: '1.23' }],
      nextPageUrl: null,
    })
    d.repo.upsertDailyInsights.mockResolvedValue(ok(null))

    const result = await runInsightsSync({ runId: RUN_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.repo.upsertDailyInsights).toHaveBeenCalled()
    // all 90 windows still processed despite quarantine
    expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledTimes(90)
  })
})
