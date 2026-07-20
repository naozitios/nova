import type { ServiceResult, JsonValue } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource } from '@/core/business-context/types'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'
import type { DataFreshnessResult, MetaDailyInsightRecord } from '@/core/meta-data/repository.port'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { buildMetaEvidenceDocuments } from './meta-evidence.builder'

export interface MetaContext {
  accessToken: string
  apiVersion: string
}

interface StoredMetaDb {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          order(column: string, opts: { ascending: boolean }): PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>
        }
      }
    }
  }
}

export async function fetchMetaArray<T>(
  ctx: MetaContext,
  url: string,
): Promise<ServiceResult<T[]>> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const text = await response.text()
    return {
      ok: false,
      error: {
        code: 'PROVIDER_5XX',
        message: `Meta API failed: ${response.status} ${text.slice(0, 200)}`,
      },
    }
  }

  const body = await response.json()

  if (body.error) {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: body.error.message ?? 'Meta API error',
      },
    }
  }

  return { ok: true, data: (body.data ?? []) as T[] }
}

export class MetaSourceAdapter implements SourceAdapterPort {
  private readonly repo: {
    listAdAccounts(workspaceId: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
    listDailyInsights(input: { workspaceId: string; metaAdAccountId: string; since: string; until: string }): Promise<ServiceResult<MetaDailyInsightRecord[]>>
    getDataFreshness(input: { workspaceId: string; metaAdAccountId: string; since?: string; until?: string }): Promise<ServiceResult<DataFreshnessResult>>
  }
  private readonly db: StoredMetaDb

  constructor(params: {
    repo?: MetaSourceAdapter['repo']
    db?: StoredMetaDb
    accessToken?: string
    adAccountId?: string
    apiVersion?: string
  } = {}) {
    this.repo = params.repo ?? new SupabaseMetaRepository()
    this.db = params.db ?? (getSupabaseServiceClient() as unknown as StoredMetaDb)
  }

  supports(sourceType: string): boolean {
    return sourceType === 'meta'
  }

  async collect(params: {
    workspaceId: string
    businessId: string
    source: ContextSource
  }): Promise<ServiceResult<CollectedSource>> {
    const { source } = params

    try {
      const accountsResult = await this.repo.listAdAccounts(params.workspaceId)
      if (!accountsResult.ok) return accountsResult
      const selected = accountsResult.data.find((account) => account.businessId === params.businessId && account.isSelected)
      if (!selected) {
        return { ok: false, error: { code: 'NO_SELECTED_META_ACCOUNT', message: 'No selected Meta ad account for this business' } }
      }

      const until = String(source.metadata.until ?? new Date().toISOString().slice(0, 10))
      const since = String(source.metadata.since ?? until)
      const [campaignsResult, adsResult, creativesResult, insightsResult, freshnessResult] = await Promise.all([
        this.readTable('meta_campaigns', params.workspaceId, selected.id),
        this.readTable('meta_ads', params.workspaceId, selected.id),
        this.readTable('meta_creatives', params.workspaceId, selected.id),
        this.repo.listDailyInsights({ workspaceId: params.workspaceId, metaAdAccountId: selected.id, since, until }),
        this.repo.getDataFreshness({ workspaceId: params.workspaceId, metaAdAccountId: selected.id, since, until }),
      ])

      if (!insightsResult.ok) return insightsResult
      if (!freshnessResult.ok) return freshnessResult
      const campaigns = campaignsResult.map((row) => ({
        id: String(row.meta_campaign_id ?? row.id),
        name: String(row.name ?? ''),
        objective: String(row.objective ?? ''),
        status: String(row.effective_status ?? row.configured_status ?? ''),
      }))
      const creatives = new Map(creativesResult.map((row) => [String(row.meta_creative_id), row]))
      const ads = adsResult.map((row) => {
        const creative = creatives.get(String(row.meta_creative_id)) ?? {}
        return {
          id: String(row.meta_ad_id ?? row.id),
          name: String(row.name ?? ''),
          status: String(row.effective_status ?? row.configured_status ?? ''),
          creative: {
            title: String(creative.title ?? creative.name ?? ''),
            body: String(creative.body ?? ''),
            call_to_action_type: String((creative.raw_metadata_json as Record<string, unknown> | undefined)?.call_to_action_type ?? ''),
          },
        }
      })

      if (campaigns.length === 0 && ads.length === 0 && creativesResult.length === 0 && insightsResult.data.length === 0) {
        return { ok: false, error: { code: 'META_DATA_NOT_SYNCED', message: 'Selected Meta account has no synced data' } }
      }

      const documents = buildMetaEvidenceDocuments({
        metaAdAccountId: selected.id,
        dataWindow: { since, until },
        freshness: {
          latestDate: freshnessResult.data.latestDate ?? until,
          missingWindowCount: freshnessResult.data.missingWindowCount,
          gapCount: freshnessResult.data.gapCount,
        },
        campaigns,
        ads,
        insights: insightsResult.data.map((row) => ({
          metaAdId: row.metaAdId,
          dateStart: row.dateStart,
          dateStop: row.dateStop,
          spend: row.spend ?? 0,
          impressions: row.impressions ?? 0,
          clicks: row.clicks ?? 0,
          actions: row.actions as Array<{ action_type: string; value: string }>,
          actionValues: row.actionValues as Array<{ action_type: string; value: string }>,
        })),
      })

      const metadata: Record<string, JsonValue> = {
        accountId: selected.id,
        collectedAt: new Date().toISOString(),
        dataWindow: { since, until },
        latestDate: freshnessResult.data.latestDate,
        missingWindowCount: freshnessResult.data.missingWindowCount,
        gapCount: freshnessResult.data.gapCount,
        campaignCount: campaigns.length,
        adCount: ads.length,
        creativeCount: creativesResult.length,
        insightCount: insightsResult.data.length,
      }

      return {
        ok: true,
        data: {
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          externalReference: `meta:${selected.id}`,
          metadata,
          documents,
        },
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: `Meta API error: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }

  private async readTable(table: string, workspaceId: string, metaAdAccountId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.db
      .from(table)
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('meta_ad_account_id', metaAdAccountId)
      .order('updated_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as Array<Record<string, unknown>>
  }
}
