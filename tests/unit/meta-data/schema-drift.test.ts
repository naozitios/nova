import { describe, it, expect, vi } from 'vitest'
import { runHierarchySync } from '@/workers/meta-sync/hierarchy-handler'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'
import type { ServiceResult } from '@/core/business-context/types'
import type {
  MetaSyncRunRecord,
  MetaSyncCheckpointRecord,
  MetaConnectionRecord,
} from '@/core/meta-data/repository.port'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'

// ── Helpers ────────────────────────────────────────────────────────────────

const WS = 'ws-1'
const RUN_ID = 'run-1'
const ACCOUNT_ID = 'act_123'

function ok<T>(data: T): ServiceResult<T> { return { ok: true, data } }

function mkRun(): MetaSyncRunRecord {
  return { id: RUN_ID, workspaceId: WS, metaAdAccountId: ACCOUNT_ID, mode: 'full', status: 'running', idempotencyKey: null }
}

function mkConn(): MetaConnectionRecord {
  return {
    id: 'conn-1', workspaceId: WS, connectedBy: 'user-1', metaUserId: 'meta-u-1',
    status: 'connected', grantedScopes: ['ads_read'], tokenExpiresAt: null,
    selectedAdAccountId: ACCOUNT_ID, selectedBusinessId: null,
    lastVerifiedAt: null, reconnectReason: null, createdAt: new Date(), updatedAt: new Date(),
    encryptedAccessToken: 'enc-tok',
  }
}

function mkAccount(): MetaAdAccountSummary {
  return { id: ACCOUNT_ID, accountId: 'act_1', name: 'Test', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true }
}

function makeHierarchyDeps(apiReturns: { data: Record<string, unknown>[]; nextPageUrl: string | null }[]) {
  let callCount = 0
  const repo = {
    getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
    getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
    getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
    advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
    listAdAccounts: vi.fn().mockResolvedValue(ok([mkAccount()])),
    upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
    upsertAds: vi.fn().mockResolvedValue(ok(null)),
    upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
    upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
  }

  const api = {
    getCampaignsPage: vi.fn().mockImplementation(async () => {
      return apiReturns[callCount++] ?? { data: [], nextPageUrl: null }
    }),
    getAdSetsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
    getAdsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
    getCreativesPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
  }

  const tokenVault = { decrypt: vi.fn(() => 'decrypted-token') }
  return { repo, api, tokenVault }
}

function makeInsightsDeps(apiData: Record<string, unknown>[]) {
  const repo = {
    getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
    getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
    getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
    advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
    listAdAccounts: vi.fn().mockResolvedValue(ok([mkAccount()])),
    upsertDailyInsights: vi.fn().mockResolvedValue(ok(null)),
    scheduleSyncRetry: vi.fn().mockResolvedValue(ok(mkRun())),
  }

  const api = {
    getDailyAdInsightsPage: vi.fn().mockResolvedValue({ data: apiData, nextPageUrl: null }),
  }

  const tokenVault = { decrypt: vi.fn(() => 'decrypted-token') }
  return { repo, api, tokenVault, today: () => '2026-01-15' }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Schema drift resilience', () => {
  describe('hierarchy handler', () => {
    it('unexpected extra fields are ignored — upsert receives full record', async () => {
      const { repo, api, tokenVault } = makeHierarchyDeps([
        { data: [{ id: 'c1', name: 'Campaign 1', new_field: 'extra_value', nested: { deep: true } }], nextPageUrl: null },
      ])

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault })
      expect(result.ok).toBe(true)
      expect(repo.upsertCampaigns).toHaveBeenCalledTimes(1)
      const campaigns = repo.upsertCampaigns.mock.calls[0][0].campaigns
      expect(campaigns[0]).toHaveProperty('new_field', 'extra_value')
      expect(campaigns[0]).toHaveProperty('nested', { deep: true })
    })

    it('missing expected fields — upsert receives record with undefined', async () => {
      const { repo, api, tokenVault } = makeHierarchyDeps([
        { data: [{ id: 'c1' }], nextPageUrl: null }, // name missing
      ])

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault })
      expect(result.ok).toBe(true)
      const campaigns = repo.upsertCampaigns.mock.calls[0][0].campaigns
      expect(campaigns[0]).toHaveProperty('id', 'c1')
      expect(campaigns[0].name).toBeUndefined()
    })

    it('type changes — string where number expected is passed through', async () => {
      const { repo, api, tokenVault } = makeHierarchyDeps([
        { data: [{ id: 'c1', name: 'Test', budget: '5000' }], nextPageUrl: null },
      ])

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault })
      expect(result.ok).toBe(true)
      const campaigns = repo.upsertCampaigns.mock.calls[0][0].campaigns
      expect(campaigns[0].budget).toBe('5000') // passed through, not coerced
    })

    it('empty data array — handler completes without crash', async () => {
      const { repo, api, tokenVault } = makeHierarchyDeps([
        { data: [], nextPageUrl: null },
      ])

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault })
      expect(result.ok).toBe(true)
      expect(repo.upsertCampaigns).not.toHaveBeenCalled()
    })

    it('null id field — upsert receives null id gracefully', async () => {
      const { repo, api, tokenVault } = makeHierarchyDeps([
        { data: [{ id: null, name: 'Test' }], nextPageUrl: null },
      ])

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault })
      expect(result.ok).toBe(true)
      expect(repo.upsertCampaigns).toHaveBeenCalled()
    })
  })

  describe('insights handler', () => {
    it('unexpected extra fields in insights — passed through to upsert', async () => {
      const { repo, api, tokenVault, today } = makeInsightsDeps([
        { campaign_id: 'c1', impressions: 1000, new_metric: 42, custom_field: 'hello' },
      ])

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault, today })
      expect(result.ok).toBe(true)
      expect(repo.upsertDailyInsights).toHaveBeenCalled()
    })

    it('missing insight fields — upsert receives undefined for missing', async () => {
      const { repo, api, tokenVault, today } = makeInsightsDeps([
        { campaign_id: 'c1' }, // impressions, spend, etc. missing
      ])

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault, today })
      expect(result.ok).toBe(true)
      const insights = repo.upsertDailyInsights.mock.calls[0][0].insights
      expect(insights[0].impressions).toBeUndefined()
      expect(insights[0].spend).toBeUndefined()
    })

    it('type changes — string impressions passed through as-is', async () => {
      const { repo, api, tokenVault, today } = makeInsightsDeps([
        { campaign_id: 'c1', impressions: '1000', spend: '50.00', clicks: '20' },
      ])

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault, today })
      expect(result.ok).toBe(true)
      const insights = repo.upsertDailyInsights.mock.calls[0][0].insights
      expect(insights[0].impressions).toBe('1000')
      expect(insights[0].spend).toBe('50.00')
    })

    it('empty data array — handler completes gracefully', async () => {
      const { repo, api, tokenVault, today } = makeInsightsDeps([])

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault, today })
      expect(result.ok).toBe(true)
      expect(repo.upsertDailyInsights).not.toHaveBeenCalled()
    })

    it('null id in insight row — handler passes through', async () => {
      const { repo, api, tokenVault, today } = makeInsightsDeps([
        { id: null, campaign_id: 'c1', impressions: 100 },
      ])

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, { repo, api, tokenVault, today })
      expect(result.ok).toBe(true)
      expect(repo.upsertDailyInsights).toHaveBeenCalled()
    })
  })
})
