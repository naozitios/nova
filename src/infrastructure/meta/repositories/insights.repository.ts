import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type {
  DataFreshnessInput,
  DataFreshnessResult,
  ListDailyInsightsInput,
  MetaDailyInsightRecord,
  UpsertDailyInsightsInput,
} from '@/core/meta-data/repository.port'

type Row = Record<string, unknown>

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (str === '') return null
  const n = Number(str)
  return Number.isFinite(n) ? n : null
}

function toBigIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (str === '') return null
  const n = Number(str)
  return Number.isFinite(n) ? Math.round(n) : null
}

function mapDailyInsightRow(row: Row): MetaDailyInsightRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    metaAdAccountId: String(row.meta_ad_account_id),
    metaCampaignId: row.meta_campaign_id ? String(row.meta_campaign_id) : null,
    metaAdSetId: row.meta_ad_set_id ? String(row.meta_ad_set_id) : null,
    metaAdId: String(row.meta_ad_id),
    dateStart: String(row.date_start),
    dateStop: String(row.date_stop),
    spend: toNumberOrNull(row.spend),
    impressions: toBigIntOrNull(row.impressions),
    reach: toBigIntOrNull(row.reach),
    frequency: toNumberOrNull(row.frequency),
    clicks: toBigIntOrNull(row.clicks),
    linkClicks: toBigIntOrNull(row.link_clicks),
    landingPageViews: toBigIntOrNull(row.landing_page_views),
    actions: Array.isArray(row.actions) ? row.actions : [],
    actionValues: Array.isArray(row.action_values) ? row.action_values : [],
    attributionSetting: String(row.attribution_setting ?? 'default'),
    currency: row.currency ? String(row.currency) : null,
    accountTimezone: row.account_timezone ? String(row.account_timezone) : null,
    dataCompletenessState: String(row.data_completeness_state ?? 'complete'),
    metaSyncRunId: row.meta_sync_run_id ? String(row.meta_sync_run_id) : null,
    apiVersion: String(row.api_version),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }
}

export class MetaInsightsRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly quarantine: (rows: Row[]) => Promise<ServiceResult<unknown>>,
  ) {}

  async upsertDailyInsights(input: UpsertDailyInsightsInput): Promise<ServiceResult<unknown>> {
    if (input.insights.length === 0) return ok(null)

    let validRunId: string | null = input.runId
    const { data: runRow } = await this.db
      .from('meta_sync_runs')
      .select('id')
      .eq('id', input.runId)
      .maybeSingle()
    if (!runRow) validRunId = null

    const validRows: Row[] = []
    const quarantinePayloads: Array<{ insight: Record<string, unknown>; validationErrors: string }> = []

    for (const insight of input.insights) {
      if (!insight.dateStart || !insight.dateStop) {
        const missingFields: string[] = []
        if (!insight.dateStart) missingFields.push('Missing date_start')
        if (!insight.dateStop) missingFields.push('Missing date_stop')
        quarantinePayloads.push({
          insight: insight as Record<string, unknown>,
          validationErrors: missingFields.join(', '),
        })
        continue
      }

      validRows.push({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_campaign_id: insight.metaCampaignId ?? null,
        meta_ad_set_id: insight.metaAdSetId ?? null,
        meta_ad_id: insight.metaAdId ?? '',
        date_start: insight.dateStart,
        date_stop: insight.dateStop,
        spend: toNumberOrNull(insight.spend),
        impressions: toBigIntOrNull(insight.impressions),
        reach: toBigIntOrNull(insight.reach),
        frequency: toNumberOrNull(insight.frequency),
        clicks: toBigIntOrNull(insight.clicks),
        link_clicks: toBigIntOrNull(insight.linkClicks),
        landing_page_views: toBigIntOrNull(insight.landingPageViews),
        actions: Array.isArray(insight.actions) ? insight.actions : [],
        action_values: Array.isArray(insight.actionValues) ? insight.actionValues : [],
        attribution_setting: insight.attributionSetting ?? 'default',
        currency: input.currency,
        account_timezone: input.accountTimezone,
        data_completeness_state: insight.dataCompletenessState ?? 'complete',
        meta_sync_run_id: validRunId,
        api_version: input.apiVersion,
        raw_metadata_json: insight,
        updated_at: new Date().toISOString(),
      })
    }

    if (validRows.length > 0) {
      const { error } = await this.db
        .from('meta_insights_daily')
        .upsert(validRows, {
          onConflict: 'workspace_id,meta_ad_account_id,meta_ad_id,date_start,date_stop,attribution_setting,api_version',
        })
      if (error) return err('UPSERT_DAILY_INSIGHTS_FAILED', error.message)
    }

    if (quarantinePayloads.length > 0) {
      const qRows = quarantinePayloads.map((q) => ({
        workspace_id: input.workspaceId,
        run_id: validRunId,
        source_table: 'meta_insights_daily',
        provider_id: q.insight.metaAdId ? String(q.insight.metaAdId) : String(q.insight.id ?? ''),
        redacted_payload: q.insight as JsonValue,
        validation_errors: [q.validationErrors] as JsonValue,
      }))
      const quarantineResult = await this.quarantine(qRows)
      if (!quarantineResult.ok) return quarantineResult
    }

    return ok(null)
  }

  async getDataFreshness(input: DataFreshnessInput): Promise<ServiceResult<DataFreshnessResult>> {
    const baseQuery = this.db
      .from('meta_insights_daily')
      .select('date_start')
      .eq('workspace_id', input.workspaceId)
      .eq('meta_ad_account_id', input.metaAdAccountId)

    let query = baseQuery.order('date_start', { ascending: false })
    if (input.since) query = query.gte('date_start', input.since)
    if (input.until) query = query.lte('date_start', input.until)

    const { data, error } = await query
    if (error) return err('READ_DATA_FRESHNESS_FAILED', error.message)

    const dates = (data ?? [])
      .map((r: Row) => String(r.date_start))
      .filter(Boolean)

    if (dates.length === 0) {
      return ok({ latestDate: null, missingWindowCount: 0, gapCount: 0 })
    }

    const uniqueDates = [...new Set(dates)].sort()

    if (!input.since || !input.until) {
      return ok({
        latestDate: uniqueDates[uniqueDates.length - 1],
        missingWindowCount: 0,
        gapCount: 0,
      })
    }

    const dateSet = new Set(uniqueDates)
    let missingWindowCount = 0
    let gapCount = 0
    let inGap = false

    const start = new Date(input.since + 'T00:00:00Z')
    const end = new Date(input.until + 'T00:00:00Z')
    const current = new Date(start)

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10)
      if (dateSet.has(dateStr)) {
        inGap = false
      } else {
        missingWindowCount++
        if (!inGap) {
          gapCount++
          inGap = true
        }
      }
      current.setDate(current.getDate() + 1)
    }

    return ok({
      latestDate: uniqueDates[uniqueDates.length - 1],
      missingWindowCount,
      gapCount,
    })
  }

  async listDailyInsights(input: ListDailyInsightsInput): Promise<ServiceResult<MetaDailyInsightRecord[]>> {
    const { data, error } = await this.db
      .from('meta_insights_daily')
      .select('*')
      .eq('workspace_id', input.workspaceId)
      .eq('meta_ad_account_id', input.metaAdAccountId)
      .gte('date_start', input.since)
      .lte('date_start', input.until)
      .order('date_start', { ascending: true })

    if (error) return err('LIST_DAILY_INSIGHTS_FAILED', error.message)
    return ok((data ?? []).map((row) => mapDailyInsightRow(row as Row)))
  }
}
