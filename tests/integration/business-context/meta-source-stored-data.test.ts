import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MetaSourceAdapter } from '@/infrastructure/business-context/meta/meta-adapter'
import type { ContextSource } from '@/core/business-context/types'

const WORKSPACE_ID = 'ws-1'
const BUSINESS_ID = 'biz-1'
const ACCOUNT_ID = 'act_123'

function ok<T>(data: T) {
  return { ok: true as const, data }
}

function makeSource(overrides?: Partial<ContextSource>): ContextSource {
  return {
    id: 'src-1',
    workspaceId: WORKSPACE_ID,
    businessId: BUSINESS_ID,
    sourceType: 'meta',
    sourceName: 'Meta Ads',
    externalReference: null,
    status: 'pending',
    currentStage: null,
    terminalOutcome: null,
    metadata: { since: '2026-07-01', until: '2026-07-07' },
    collectedAt: new Date(),
    ...overrides,
  }
}

function makeQuery(rows: unknown[]) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  }
  return query
}

function makeDeps(overrides?: {
  accounts?: unknown[]
  insights?: unknown[]
  campaigns?: unknown[]
  ads?: unknown[]
  creatives?: unknown[]
}) {
  const repo = {
    listAdAccounts: vi.fn().mockResolvedValue(ok(overrides?.accounts ?? [{ id: ACCOUNT_ID, businessId: BUSINESS_ID, isSelected: true }])),
    listDailyInsights: vi.fn().mockResolvedValue(ok(overrides?.insights ?? [{ metaAdId: 'ad-1', dateStart: '2026-07-01', dateStop: '2026-07-07', spend: 123, impressions: 1000, clicks: 50, actions: [], actionValues: [] }])),
    getDataFreshness: vi.fn().mockResolvedValue(ok({ latestDate: '2026-07-07', missingWindowCount: 0, gapCount: 0 })),
  }
  const rowsByTable: Record<string, unknown[]> = {
    meta_campaigns: overrides?.campaigns ?? [{ meta_campaign_id: 'camp-1', name: 'Spring Sale', objective: 'OUTCOME_SALES', effective_status: 'ACTIVE' }],
    meta_ads: overrides?.ads ?? [{ meta_ad_id: 'ad-1', meta_campaign_id: 'camp-1', meta_creative_id: 'cr-1', name: 'Discount Ad', effective_status: 'ACTIVE' }],
    meta_creatives: overrides?.creatives ?? [{ meta_creative_id: 'cr-1', name: 'Sale Creative', title: 'Sale', body: 'Save 20% today' }],
  }
  const db = {
    from: vi.fn((table: string) => makeQuery(rowsByTable[table] ?? [])),
  }
  return { repo, db }
}

describe('MetaSourceAdapter — stored Meta data', () => {
  beforeEach(() => {
    vi.stubEnv('META_ACCESS_TOKEN', '')
    vi.stubEnv('META_AD_ACCOUNT_ID', '')
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('collects source documents from stored selected-account Meta data without env token', async () => {
    const deps = makeDeps()
    const adapter = new MetaSourceAdapter(deps)

    const result = await adapter.collect({ workspaceId: WORKSPACE_ID, businessId: BUSINESS_ID, source: makeSource() })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.externalReference).toBe(`meta:${ACCOUNT_ID}`)
      expect(result.data.documents.length).toBeGreaterThan(0)
      expect(JSON.stringify(result.data)).toContain('Spring Sale')
      expect(JSON.stringify(result.data)).toContain('Save 20% today')
      expect(result.data.metadata).toMatchObject({ accountId: ACCOUNT_ID, latestDate: '2026-07-07' })
    }
    expect(global.fetch).not.toHaveBeenCalled()
    expect(deps.repo.listDailyInsights).toHaveBeenCalledWith({
      workspaceId: WORKSPACE_ID,
      metaAdAccountId: ACCOUNT_ID,
      since: '2026-07-01',
      until: '2026-07-07',
    })
  })

  it('returns NO_SELECTED_META_ACCOUNT when business has no selected account', async () => {
    const deps = makeDeps({ accounts: [] })
    const adapter = new MetaSourceAdapter(deps)

    const result = await adapter.collect({ workspaceId: WORKSPACE_ID, businessId: BUSINESS_ID, source: makeSource() })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NO_SELECTED_META_ACCOUNT')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns META_DATA_NOT_SYNCED when selected account has no stored data', async () => {
    const deps = makeDeps({ insights: [], campaigns: [], ads: [], creatives: [] })
    const adapter = new MetaSourceAdapter(deps)

    const result = await adapter.collect({ workspaceId: WORKSPACE_ID, businessId: BUSINESS_ID, source: makeSource() })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('META_DATA_NOT_SYNCED')
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
