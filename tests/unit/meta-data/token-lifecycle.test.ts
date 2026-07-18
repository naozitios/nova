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
const ENCRYPTED = 'enc-tok'

function ok<T>(data: T): ServiceResult<T> { return { ok: true, data } }

function mkRun(overrides?: Partial<MetaSyncRunRecord>): MetaSyncRunRecord {
  return { id: RUN_ID, workspaceId: WS, metaAdAccountId: ACCOUNT_ID, mode: 'full', status: 'running', idempotencyKey: null, ...overrides }
}

function mkConn(overrides?: Partial<MetaConnectionRecord>): MetaConnectionRecord {
  return {
    id: 'conn-1', workspaceId: WS, connectedBy: 'user-1', metaUserId: 'meta-u-1',
    status: 'connected', grantedScopes: ['ads_read'], tokenExpiresAt: null,
    selectedAdAccountId: ACCOUNT_ID, selectedBusinessId: null,
    lastVerifiedAt: null, reconnectReason: null, createdAt: new Date(), updatedAt: new Date(),
    encryptedAccessToken: ENCRYPTED, ...overrides,
  }
}

function mkAccount(overrides?: Partial<MetaAdAccountSummary>): MetaAdAccountSummary {
  return { id: ACCOUNT_ID, accountId: 'act_1', name: 'Test', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true, ...overrides }
}

function makeDeps(overrides?: { apiOverrides?: Record<string, unknown> }) {
  return {
    repo: {
      getSyncRun: vi.fn().mockResolvedValue(ok(mkRun())),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
      getConnectionWithToken: vi.fn().mockResolvedValue(ok(mkConn())),
      advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
      listAdAccounts: vi.fn().mockResolvedValue(ok([mkAccount()])),
      upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
      upsertAds: vi.fn().mockResolvedValue(ok(null)),
      upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
      upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
      upsertDailyInsights: vi.fn().mockResolvedValue(ok(null)),
      scheduleSyncRetry: vi.fn().mockResolvedValue(ok(mkRun())),
    },
    api: {
      getCampaignsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getAdSetsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getAdsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getCreativesPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getDailyAdInsightsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      ...overrides?.apiOverrides,
    },
    tokenVault: { decrypt: vi.fn(() => 'decrypted-token') },
    today: () => '2026-01-15',
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Token lifecycle', () => {
  describe('token expiry → refresh', () => {
    it('hierarchy sync surfaces auth error from API call', async () => {
      const deps = makeDeps({
        apiOverrides: {
          getCampaignsPage: vi.fn().mockRejectedValue(Object.assign(new Error('OAuthException: Error validating access token'), { code: 190 })),
        },
      })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, deps)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toMatch(/PROVIDER_ERROR|RETRYABLE_ERROR/)
      }
    })

    it('insights sync surfaces auth error from API call', async () => {
      const deps = makeDeps({
        apiOverrides: {
          getDailyAdInsightsPage: vi.fn().mockRejectedValue(Object.assign(new Error('OAuthException: Session expired'), { code: 190 })),
        },
      })

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, deps)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toMatch(/PROVIDER_ERROR|RETRYABLE_ERROR/)
      }
    })

    it('insights sync schedules retry on retryable auth error', async () => {
      const deps = makeDeps({
        apiOverrides: {
          getDailyAdInsightsPage: vi.fn().mockRejectedValue(new Error('rate limit exceeded')),
        },
      })

      await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, deps)
      expect(deps.repo.scheduleSyncRetry).toHaveBeenCalledWith(WS, RUN_ID)
    })
  })

  describe('partial permissions', () => {
    it('insights sync completes when insights page returns empty (scope missing scenario)', async () => {
      const deps = makeDeps({
        apiOverrides: {
          getDailyAdInsightsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
        },
      })

      const result = await runInsightsSync({ runId: RUN_ID, workspaceId: WS }, deps)
      expect(result.ok).toBe(true)
    })

    it('handler does not call API for scope-dependent data when data is empty', async () => {
      const deps = makeDeps({
        apiOverrides: {
          getCampaignsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
        },
      })

      await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, deps)

      // Only called once for campaigns (first partition), then stops since no data
      expect(deps.api.getCampaignsPage).toHaveBeenCalledTimes(1)
    })
  })

  describe('expired token detection', () => {
    it('connection with future tokenExpiresAt is used normally', async () => {
      const futureDate = new Date(Date.now() + 86400000)
      const deps = makeDeps()
      deps.repo.getConnectionWithToken.mockResolvedValue(ok(mkConn({ tokenExpiresAt: futureDate })))

      await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, deps)
      expect(deps.tokenVault.decrypt).toHaveBeenCalledWith(ENCRYPTED)
    })

    it('connection with past tokenExpiresAt still provides token (handler proceeds)', async () => {
      const pastDate = new Date(Date.now() - 86400000)
      const deps = makeDeps()
      deps.repo.getConnectionWithToken.mockResolvedValue(ok(mkConn({ tokenExpiresAt: pastDate })))

      await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, deps)
      // Handler uses the token regardless — API will reject if truly expired
      expect(deps.tokenVault.decrypt).toHaveBeenCalledWith(ENCRYPTED)
    })

    it('missing connection returns CONNECTION_NOT_FOUND', async () => {
      const deps = makeDeps()
      deps.repo.getConnectionWithToken.mockResolvedValue(ok(null))

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WS }, deps)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('CONNECTION_NOT_FOUND')
      }
    })
  })
})
