import { describe, expect, it, vi } from 'vitest'
import { getStoredAnalyticsSummary, getStoredTimeseries } from '@/core/meta-data/analytics-query.service'

const input = {
  workspaceId: 'ws-1',
  businessId: 'biz-1',
  since: '2026-07-01',
  until: '2026-07-03',
}

function ok<T>(data: T) {
  return { ok: true as const, data }
}

function makeRepo(overrides?: { accounts?: unknown[]; insights?: unknown[] }) {
  return {
    listAdAccounts: vi.fn().mockResolvedValue(ok(overrides?.accounts ?? [{ id: 'act_123', businessId: 'biz-1', isSelected: true }])),
    listDailyInsights: vi.fn().mockResolvedValue(ok(overrides?.insights ?? [
      { dateStart: '2026-07-01', spend: 10, clicks: 5, impressions: 100, reach: 80 },
      { dateStart: '2026-07-02', spend: 20, clicks: 7, impressions: 200, reach: 150 },
      { dateStart: '2026-07-02', spend: null, clicks: null, impressions: null, reach: null },
    ])),
  }
}

describe('stored analytics query service', () => {
  it('sums stored insight rows for analytics summary', async () => {
    const repo = makeRepo()

    const result = await getStoredAnalyticsSummary(repo, input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toMatchObject({
      metaAdAccountId: 'act_123',
      spend: 30,
      clicks: 12,
      impressions: 300,
      reach: 230,
    })
    expect(repo.listDailyInsights).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      metaAdAccountId: 'act_123',
      since: '2026-07-01',
      until: '2026-07-03',
    })
  })

  it('returns NOT_SYNCED when business has no selected Meta account', async () => {
    const result = await getStoredAnalyticsSummary(makeRepo({ accounts: [] }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_SYNCED')
  })

  it('returns NOT_SYNCED when selected account has no insight rows', async () => {
    const result = await getStoredAnalyticsSummary(makeRepo({ insights: [] }), input)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('NOT_SYNCED')
  })

  it('aggregates stored timeseries by date', async () => {
    const result = await getStoredTimeseries(makeRepo(), input)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual([
      { date: '2026-07-01', spend: 10, clicks: 5, impressions: 100, reach: 80 },
      { date: '2026-07-02', spend: 20, clicks: 7, impressions: 200, reach: 150 },
    ])
  })
})
