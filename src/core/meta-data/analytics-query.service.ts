import type { ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary } from './entities'
import type { MetaDailyInsightRecord } from './repository.port'

export interface StoredAnalyticsInput {
  workspaceId: string
  businessId: string
  since: string
  until: string
}

export interface AnalyticsSummary {
  metaAdAccountId: string
  spend: number
  clicks: number
  impressions: number
  reach: number
}

export interface AnalyticsTimeseriesPoint {
  date: string
  spend: number
  clicks: number
  impressions: number
  reach: number
}

export interface StoredAnalyticsRepository {
  listAdAccounts(workspaceId: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
  listDailyInsights(input: {
    workspaceId: string
    metaAdAccountId: string
    since: string
    until: string
  }): Promise<ServiceResult<MetaDailyInsightRecord[]>>
}

function notSynced<T>(message: string): ServiceResult<T> {
  return { ok: false, error: { code: 'NOT_SYNCED', message } }
}

function metric(value: number | null | undefined): number {
  return value ?? 0
}

async function getSelectedRows(
  repo: StoredAnalyticsRepository,
  input: StoredAnalyticsInput,
): Promise<ServiceResult<{ metaAdAccountId: string; rows: MetaDailyInsightRecord[] }>> {
  const accountsResult = await repo.listAdAccounts(input.workspaceId)
  if (!accountsResult.ok) return accountsResult
  const selected = accountsResult.data.find((account) => account.businessId === input.businessId && account.isSelected)
  if (!selected) return notSynced('No selected Meta ad account for this business')

  const rowsResult = await repo.listDailyInsights({
    workspaceId: input.workspaceId,
    metaAdAccountId: selected.id,
    since: input.since,
    until: input.until,
  })
  if (!rowsResult.ok) return rowsResult
  if (rowsResult.data.length === 0) return notSynced('Selected Meta ad account has no synced insight rows')
  return { ok: true, data: { metaAdAccountId: selected.id, rows: rowsResult.data } }
}

export async function getStoredAnalyticsSummary(
  repo: StoredAnalyticsRepository,
  input: StoredAnalyticsInput,
): Promise<ServiceResult<AnalyticsSummary>> {
  const selected = await getSelectedRows(repo, input)
  if (!selected.ok) return selected

  return {
    ok: true,
    data: selected.data.rows.reduce<AnalyticsSummary>((acc, row) => ({
      metaAdAccountId: selected.data.metaAdAccountId,
      spend: acc.spend + metric(row.spend),
      clicks: acc.clicks + metric(row.clicks),
      impressions: acc.impressions + metric(row.impressions),
      reach: acc.reach + metric(row.reach),
    }), {
      metaAdAccountId: selected.data.metaAdAccountId,
      spend: 0,
      clicks: 0,
      impressions: 0,
      reach: 0,
    }),
  }
}

export async function getStoredTimeseries(
  repo: StoredAnalyticsRepository,
  input: StoredAnalyticsInput,
): Promise<ServiceResult<AnalyticsTimeseriesPoint[]>> {
  const selected = await getSelectedRows(repo, input)
  if (!selected.ok) return selected

  const byDate = new Map<string, AnalyticsTimeseriesPoint>()
  for (const row of selected.data.rows) {
    const current = byDate.get(row.dateStart) ?? { date: row.dateStart, spend: 0, clicks: 0, impressions: 0, reach: 0 }
    current.spend += metric(row.spend)
    current.clicks += metric(row.clicks)
    current.impressions += metric(row.impressions)
    current.reach += metric(row.reach)
    byDate.set(row.dateStart, current)
  }

  return { ok: true, data: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) }
}
