import { describe, it, expect, vi, beforeEach } from 'vitest'
import { config } from '@/infrastructure/config'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'
import { buildInitialInsightWindows, buildIncrementalInsightWindows } from '@/core/meta-data/sync-policy'
import type { ServiceResult } from '@/core/business-context/types'
import type { MetaSyncRunRecord, MetaSyncCheckpointRecord, MetaConnectionRecord } from '@/core/meta-data/repository.port'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'

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

function mkAccount(overrides?: Partial<MetaAdAccountSummary>): MetaAdAccountSummary {
  return {
    id: ACCOUNT_ID,
    accountId: 'act_1',
    name: 'Test Account',
    currency: 'USD',
    timezoneName: 'UTC',
    businessId: null,
    businessName: null,
    isSelected: true,
    ...overrides,
  }
}

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function defaultDeps(accountOverrides?: Partial<MetaAdAccountSummary>) {
  const calls: string[] = []

  const repo = {
    getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
    getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
    getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
    advanceCheckpoint: vi.fn().mockImplementation(async (input: { partitionKey: string; status: string }) => {
      calls.push(`checkpoint:${input.partitionKey}:${input.status}`)
      return ok({} as MetaSyncCheckpointRecord)
    }),
    listAdAccounts: vi.fn().mockResolvedValue(ok([mkAccount(accountOverrides)])),
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

// ── 1. API version from config ─────────────────────────────────────────────

describe('config.meta.apiVersion', () => {
  it('is set and matches expected format', () => {
    expect(config.meta.apiVersion).toBeDefined()
    expect(typeof config.meta.apiVersion).toBe('string')
    expect(config.meta.apiVersion).toMatch(/^v\d+\.\d+$/)
  })

  it('defaults to v22.0', () => {
    expect(config.meta.apiVersion).toBe('v22.0')
  })

  it('handler passes config.meta.apiVersion to upsertDailyInsights', async () => {
    const d = defaultDeps()
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ apiVersion: config.meta.apiVersion }),
    )
  })
})

// ── 2. Timezone from Meta account ──────────────────────────────────────────

describe('timezone from metaAccount', () => {
  it('uses timezoneName from metaAccount when set', async () => {
    const d = defaultDeps({ timezoneName: 'Asia/Singapore' })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ accountTimezone: 'Asia/Singapore' }),
    )
  })

  it('falls back to UTC when timezoneName is null', async () => {
    const d = defaultDeps({ timezoneName: null })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ accountTimezone: 'UTC' }),
    )
  })

  it('falls back to UTC when timezoneName is undefined (property absent)', async () => {
    const d = defaultDeps({ timezoneName: undefined as unknown as string | null })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ accountTimezone: 'UTC' }),
    )
  })
})

// ── 3. Currency from Meta account ──────────────────────────────────────────

describe('currency from metaAccount', () => {
  it('uses currency from metaAccount when set', async () => {
    const d = defaultDeps({ currency: 'SGD' })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'SGD' }),
    )
  })

  it('falls back to USD when currency is null', async () => {
    const d = defaultDeps({ currency: null })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    )
  })

  it('falls back to USD when currency is undefined (property absent)', async () => {
    const d = defaultDeps({ currency: undefined as unknown as string | null })
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertDailyInsights).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
    )
  })
})

// ── 4. Default backfill window ─────────────────────────────────────────────

describe('default backfill window', () => {
  it('buildInitialInsightWindows defaults to 90 days', () => {
    const windows = buildInitialInsightWindows('2026-07-17')
    expect(windows).toHaveLength(90)
    expect(windows[0]).toEqual({ since: '2026-04-18', until: '2026-04-18' })
    expect(windows[89]).toEqual({ since: '2026-07-16', until: '2026-07-16' })
  })

  it('buildInitialInsightWindows respects custom days param', () => {
    const windows = buildInitialInsightWindows('2026-07-17', 30)
    expect(windows).toHaveLength(30)
  })

  it('initial_backfill mode calls API 90 times (one per day)', async () => {
    const d = defaultDeps()
    await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledTimes(90)
  })
})

// ── 5. Config values ───────────────────────────────────────────────────────

describe('config shape', () => {
  it('meta.apiVersion is a string matching /^v\\d+\\.\\d+$/', () => {
    expect(config.meta.apiVersion).toMatch(/^v\d+\.\d+$/)
  })

  it('meta.redirectUri is defined', () => {
    expect(config.meta.redirectUri).toBeDefined()
    expect(typeof config.meta.redirectUri).toBe('string')
    expect(config.meta.redirectUri.length).toBeGreaterThan(0)
  })

  it('meta.scopes is an array', () => {
    expect(Array.isArray(config.meta.scopes)).toBe(true)
    expect(config.meta.scopes.length).toBeGreaterThan(0)
  })

  it('meta.appId is defined', () => {
    expect(typeof config.meta.appId).toBe('string')
  })
})
