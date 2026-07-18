import { describe, it, expect, vi } from 'vitest'
import { runHierarchySync } from '@/workers/meta-sync/hierarchy-handler'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'
import type { ServiceResult } from '@/core/business-context/types'
import type {
  MetaSyncRunRecord,
  MetaSyncCheckpointRecord,
  MetaConnectionRecord,
} from '@/core/meta-data/repository.port'

// ── Helpers ────────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-1'
const RUN_ID = 'run-1'
const ACCOUNT_ID = 'act_123'

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function mkRun(overrides?: Partial<MetaSyncRunRecord>): MetaSyncRunRecord {
  return {
    id: RUN_ID,
    workspaceId: WORKSPACE_ID,
    metaAdAccountId: ACCOUNT_ID,
    mode: 'initial_backfill',
    status: 'in_progress',
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
    encryptedAccessToken: 'enc-tok',
    ...overrides,
  }
}

function createMockDeps() {
  const repo = {
    getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
    getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok<string[]>([])),
    getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
    advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
    upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
    upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
    upsertAds: vi.fn().mockResolvedValue(ok(null)),
    upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
    upsertDailyInsights: vi.fn().mockResolvedValue(ok(null)),
    scheduleSyncRetry: vi.fn().mockResolvedValue(ok(mkRun({ status: 'retry_scheduled' }))),
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
  }

  const api = {
    getCampaignsPage: vi.fn(),
    getAdSetsPage: vi.fn(),
    getAdsPage: vi.fn(),
    getCreativesPage: vi.fn(),
    getDailyAdInsightsPage: vi.fn(),
  }

  const tokenVault = { decrypt: vi.fn().mockReturnValue('plain-token') }
  const today = vi.fn().mockReturnValue('2026-07-17')

  return { repo, api, tokenVault, today }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('sync-pagination', () => {
  describe('multi-page hierarchy pagination', () => {
    it('fetches all pages, upserts per page, and advances checkpoint per page', async () => {
      const d = createMockDeps()

      d.api.getCampaignsPage
        .mockResolvedValueOnce({ data: [{ id: 'c1' }], nextPageUrl: 'https://graph.facebook.com/v19.0/act_1/campaigns?after=cursor1' })
        .mockResolvedValueOnce({ data: [{ id: 'c2' }], nextPageUrl: 'https://graph.facebook.com/v19.0/act_1/campaigns?after=cursor2' })
        .mockResolvedValueOnce({ data: [{ id: 'c3' }], nextPageUrl: null })

      d.api.getAdSetsPage.mockResolvedValue({ data: [{ id: 'as1' }], nextPageUrl: null })
      d.api.getAdsPage.mockResolvedValue({ data: [{ id: 'ad1' }], nextPageUrl: null })
      d.api.getCreativesPage.mockResolvedValue({ data: [{ id: 'cr1' }], nextPageUrl: null })

      await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      // campaigns API called 3 times: no cursor, then cursor1, then cursor2
      expect(d.api.getCampaignsPage).toHaveBeenCalledTimes(3)
      expect(d.api.getCampaignsPage).toHaveBeenNthCalledWith(1, 'act_1', 'plain-token', undefined)
      expect(d.api.getCampaignsPage).toHaveBeenNthCalledWith(2, 'act_1', 'plain-token', 'cursor1')
      expect(d.api.getCampaignsPage).toHaveBeenNthCalledWith(3, 'act_1', 'plain-token', 'cursor2')

      // upsertCampaigns called once per non-empty page
      expect(d.repo.upsertCampaigns).toHaveBeenCalledTimes(3)

      // checkpoint advanced with in_progress for each page, then completed at end
      const checkpoints = d.repo.advanceCheckpoint.mock.calls.map(
        (c: any[]) => ({
          partitionKey: c[0].partitionKey,
          status: c[0].status,
          cursor: c[0].cursor,
        }),
      )
      const campaignCheckpoints = checkpoints.filter((c: { partitionKey: string }) => c.partitionKey === 'campaigns')
      expect(campaignCheckpoints).toEqual([
        { partitionKey: 'campaigns', status: 'in_progress', cursor: 'cursor1' },
        { partitionKey: 'campaigns', status: 'in_progress', cursor: 'cursor2' },
        { partitionKey: 'campaigns', status: 'in_progress', cursor: null },
        { partitionKey: 'campaigns', status: 'completed', cursor: null },
      ])
    })
  })

  describe('multi-page insights pagination', () => {
    it('fetches all pages and advances checkpoint per page', async () => {
      const d = createMockDeps()

      // Use incremental mode (7 windows) so total call count is manageable
      d.repo.getSyncRun.mockResolvedValue(ok(mkRun({ mode: 'incremental' })))

      // First window (2026-07-10): 2 pages
      d.api.getDailyAdInsightsPage
        .mockResolvedValueOnce({
          data: [{ ad_id: 'ad-1', date_start: '2026-07-10', date_stop: '2026-07-10', spend: '1.00' }],
          nextPageUrl: 'https://graph.facebook.com/v19.0/act_1/insights?after=icursor1',
        })
        .mockResolvedValueOnce({
          data: [{ ad_id: 'ad-2', date_start: '2026-07-10', date_stop: '2026-07-10', spend: '2.00' }],
          nextPageUrl: null,
        })
        // Remaining 6 windows: single page each
        .mockResolvedValue({ data: [{ ad_id: 'ad-x' }], nextPageUrl: null })

      await runInsightsSync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      // 7 windows total, first window has 2 pages = 8 calls
      expect(d.api.getDailyAdInsightsPage).toHaveBeenCalledTimes(8)

      // first window page 1: no cursor
      expect(d.api.getDailyAdInsightsPage).toHaveBeenNthCalledWith(
        1, 'act_1', expect.objectContaining({ since: '2026-07-10' }), 'plain-token', undefined,
      )
      // first window page 2: cursor from page 1
      expect(d.api.getDailyAdInsightsPage).toHaveBeenNthCalledWith(
        2, 'act_1', expect.objectContaining({ since: '2026-07-10' }), 'plain-token', 'icursor1',
      )

      // upsertDailyInsights called 8 times (once per page with data)
      expect(d.repo.upsertDailyInsights).toHaveBeenCalledTimes(8)

      // Verify multi-page checkpoints for first window
      const checkpoints = d.repo.advanceCheckpoint.mock.calls.map(
        (c: any[]) => ({
          partitionKey: c[0].partitionKey,
          status: c[0].status,
          cursor: c[0].cursor,
        }),
      )
      const firstWindowCheckpoints = checkpoints.filter(
        (c: { partitionKey: string }) => c.partitionKey === 'insights:2026-07-10',
      )
      expect(firstWindowCheckpoints).toEqual([
        { partitionKey: 'insights:2026-07-10', status: 'in_progress', cursor: 'icursor1' },
        { partitionKey: 'insights:2026-07-10', status: 'in_progress', cursor: null },
        { partitionKey: 'insights:2026-07-10', status: 'completed', cursor: null },
      ])
    })
  })

  describe('mid-page resume', () => {
    it('skips completed partitions and does not call their API', async () => {
      const d = createMockDeps()
      d.repo.getCompletedCheckpointKeys.mockResolvedValue(ok(['campaigns']))

      d.api.getAdSetsPage.mockResolvedValue({ data: [{ id: 'as1' }], nextPageUrl: null })
      d.api.getAdsPage.mockResolvedValue({ data: [{ id: 'ad1' }], nextPageUrl: null })
      d.api.getCreativesPage.mockResolvedValue({ data: [{ id: 'cr1' }], nextPageUrl: null })

      await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      // campaigns partition skipped entirely
      expect(d.api.getCampaignsPage).not.toHaveBeenCalled()
      expect(d.repo.upsertCampaigns).not.toHaveBeenCalled()

      // other partitions processed normally
      expect(d.api.getAdSetsPage).toHaveBeenCalledOnce()
      expect(d.api.getAdsPage).toHaveBeenCalledOnce()
      expect(d.api.getCreativesPage).toHaveBeenCalledOnce()
    })
  })

  describe('upsert failure preserves cursor', () => {
    it('advances checkpoint with cursor from last successful page', async () => {
      const d = createMockDeps()

      d.api.getCampaignsPage
        .mockResolvedValueOnce({ data: [{ id: 'c1' }], nextPageUrl: 'https://graph.facebook.com/v19.0/act_1/campaigns?after=cursor1' })
        .mockResolvedValueOnce({ data: [{ id: 'c2' }], nextPageUrl: 'https://graph.facebook.com/v19.0/act_1/campaigns?after=cursor2' })

      // first page upsert ok, second fails
      d.repo.upsertCampaigns
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce({ ok: false, error: { code: 'DB_ERROR', message: 'connection lost' } })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('DB_ERROR')
      }

      // retry_pending checkpoint called with cursor1 (extracted from page 1's nextPageUrl)
      expect(d.repo.advanceCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: 'campaigns',
          status: 'retry_pending',
          cursor: 'cursor1',
        }),
      )

      // subsequent partitions not reached
      expect(d.api.getAdSetsPage).not.toHaveBeenCalled()
      expect(d.api.getAdsPage).not.toHaveBeenCalled()
      expect(d.api.getCreativesPage).not.toHaveBeenCalled()
    })
  })

  describe('nextPageUrl regex failure throws', () => {
    it('throws error when nextPageUrl has no after= param, causing retryable error', async () => {
      const d = createMockDeps()

      d.api.getCampaignsPage.mockResolvedValue({
        data: [{ id: 'c1' }],
        nextPageUrl: 'https://graph.facebook.com/xyz',
      })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('RETRYABLE_ERROR')
        expect(result.error.message).toBe('nextPageUrl missing after cursor')
      }

      // checkpoint advanced with retry_pending and null cursor (error is caught in try/catch)
      expect(d.repo.advanceCheckpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          partitionKey: 'campaigns',
          status: 'retry_pending',
          cursor: null,
        }),
      )
    })
  })

  describe('empty data page still advances checkpoint', () => {
    it('processes empty page without upsert and advances to completed', async () => {
      const d = createMockDeps()

      d.api.getCampaignsPage.mockResolvedValue({ data: [], nextPageUrl: null })
      d.api.getAdSetsPage.mockResolvedValue({ data: [{ id: 'as1' }], nextPageUrl: null })
      d.api.getAdsPage.mockResolvedValue({ data: [{ id: 'ad1' }], nextPageUrl: null })
      d.api.getCreativesPage.mockResolvedValue({ data: [{ id: 'cr1' }], nextPageUrl: null })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

      expect(result.ok).toBe(true)

      // upsertCampaigns NOT called (no data to upsert)
      expect(d.repo.upsertCampaigns).not.toHaveBeenCalled()

      // checkpoint advanced: in_progress with null cursor (empty page, no nextPageUrl), then completed
      const campaignCheckpoints = d.repo.advanceCheckpoint.mock.calls
        .map((c: any[]) => ({
          partitionKey: c[0].partitionKey,
          status: c[0].status,
          cursor: c[0].cursor,
        }))
        .filter((c: { partitionKey: string }) => c.partitionKey === 'campaigns')

      expect(campaignCheckpoints).toEqual([
        { partitionKey: 'campaigns', status: 'in_progress', cursor: null },
        { partitionKey: 'campaigns', status: 'completed', cursor: null },
      ])
    })
  })
})
