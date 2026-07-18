import { describe, it, expect, vi } from 'vitest'
import { runHierarchySync } from '@/workers/meta-sync/hierarchy-handler'
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
    mode: 'full',
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

function fail<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
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
    listAdAccounts: vi.fn().mockResolvedValue(ok([{ id: ACCOUNT_ID, accountId: 'act_1', name: 'Test Account', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true }])),
    upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
    upsertAds: vi.fn().mockResolvedValue(ok(null)),
    upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
    upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
  }

  const api = {
    getCampaignsPage: vi.fn().mockResolvedValue({ data: [{ id: 'c1' }], nextPageUrl: null }),
    getAdSetsPage: vi.fn().mockResolvedValue({ data: [{ id: 'as1' }], nextPageUrl: null }),
    getAdsPage: vi.fn().mockResolvedValue({ data: [{ id: 'ad1' }], nextPageUrl: null }),
    getCreativesPage: vi.fn().mockResolvedValue({ data: [{ id: 'cr1' }], nextPageUrl: null }),
  }

  const tokenVault = {
    decrypt: vi.fn().mockReturnValue('plain-token'),
  }

  return { repo, api, tokenVault, calls }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('runHierarchySync', () => {
  it('processes partitions in order: campaigns → ad_sets → ads → creatives', async () => {
    const d = defaultDeps()
    await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertCampaigns).toHaveBeenCalledOnce()
    expect(d.repo.upsertAdSets).toHaveBeenCalledOnce()
    expect(d.repo.upsertAds).toHaveBeenCalledOnce()
    expect(d.repo.upsertCreatives).toHaveBeenCalledOnce()

    const campaignIdx = d.repo.upsertCampaigns.mock.invocationCallOrder[0]
    const adSetsIdx = d.repo.upsertAdSets.mock.invocationCallOrder[0]
    const adsIdx = d.repo.upsertAds.mock.invocationCallOrder[0]
    const creativesIdx = d.repo.upsertCreatives.mock.invocationCallOrder[0]
    expect(campaignIdx).toBeLessThan(adSetsIdx)
    expect(adSetsIdx).toBeLessThan(adsIdx)
    expect(adsIdx).toBeLessThan(creativesIdx)
  })

  it('skips completed partitions on retry', async () => {
    const d = defaultDeps()
    d.repo.getCompletedCheckpointKeys.mockResolvedValue(ok(['campaigns', 'ad_sets']))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.repo.upsertCampaigns).not.toHaveBeenCalled()
    expect(d.repo.upsertAdSets).not.toHaveBeenCalled()
    expect(d.repo.upsertAds).toHaveBeenCalledOnce()
    expect(d.repo.upsertCreatives).toHaveBeenCalledOnce()
  })

  it('schedules retry and returns error on retryable provider error', async () => {
    const d = defaultDeps()
    d.api.getCampaignsPage.mockRejectedValue({ status: 429, message: 'Rate limited' })

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RETRYABLE_ERROR')
    }
    expect(d.repo.advanceCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({ partitionKey: 'campaigns', status: 'retry_pending' }),
    )
  })

  it('schema-invalid record: upsert returns ok, worker continues to next partition', async () => {
    const d = defaultDeps()
    d.api.getCampaignsPage.mockResolvedValue({
      data: [{ id: 'c1', invalid_field: true }],
      nextPageUrl: null,
    })
    // upsert quarantines internally and returns ok
    d.repo.upsertCampaigns.mockResolvedValue(ok(null))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.repo.upsertCampaigns).toHaveBeenCalledOnce()
    expect(d.repo.upsertAds).toHaveBeenCalledOnce()
  })

  it('returns ok:true and advances final checkpoint on full success', async () => {
    const d = defaultDeps()
    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(true)
    expect(d.calls).toContain('checkpoint:campaigns:completed')
    expect(d.calls).toContain('checkpoint:ad_sets:completed')
    expect(d.calls).toContain('checkpoint:ads:completed')
    expect(d.calls).toContain('checkpoint:creatives:completed')
  })

  it('returns error when run not found', async () => {
    const d = defaultDeps()
    d.repo.getSyncRun.mockResolvedValue(ok(null))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RUN_NOT_FOUND')
    }
  })

  it('returns error when connection not found', async () => {
    const d = defaultDeps()
    d.repo.getConnectionWithToken.mockResolvedValue(ok(null))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('CONNECTION_NOT_FOUND')
    }
  })

  it('decrypts token from connection before API calls', async () => {
    const d = defaultDeps()
    await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.tokenVault.decrypt).toHaveBeenCalledWith(ENCRYPTED)
    expect(d.api.getCampaignsPage).toHaveBeenCalledWith(
      'act_1',
      'plain-token',
      undefined,
    )
  })

  it('calls upsertAdSets for ad_sets partition and upsertCreatives for creatives partition', async () => {
    const d = defaultDeps()
    await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(d.repo.upsertAdSets).toHaveBeenCalledOnce()
    expect(d.repo.upsertAdSets).toHaveBeenCalledWith(
      expect.objectContaining({ adSets: expect.any(Array) }),
    )
    expect(d.repo.upsertCreatives).toHaveBeenCalledOnce()
    expect(d.repo.upsertCreatives).toHaveBeenCalledWith(
      expect.objectContaining({ creatives: expect.any(Array) }),
    )
  })

  it('stops and returns error when upsertCampaigns fails', async () => {
    const d = defaultDeps()
    d.repo.upsertCampaigns.mockResolvedValue(fail('DB_ERROR', 'connection lost'))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR')
    }
    // retries from campaigns partition
    expect(d.repo.advanceCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({ partitionKey: 'campaigns', status: 'retry_pending' }),
    )
    // subsequent partitions not processed
    expect(d.api.getAdsPage).not.toHaveBeenCalled()
  })

  it('returns AD_ACCOUNT_NOT_FOUND when listAdAccounts has no matching id', async () => {
    const d = defaultDeps()
    d.repo.listAdAccounts.mockResolvedValue(ok([{ id: 'other-account', accountId: 'act_999', name: 'Other', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: false }]))

    const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, d)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('AD_ACCOUNT_NOT_FOUND')
    }
    expect(d.api.getCampaignsPage).not.toHaveBeenCalled()
    expect(d.api.getAdSetsPage).not.toHaveBeenCalled()
    expect(d.api.getAdsPage).not.toHaveBeenCalled()
    expect(d.api.getCreativesPage).not.toHaveBeenCalled()
  })
})
