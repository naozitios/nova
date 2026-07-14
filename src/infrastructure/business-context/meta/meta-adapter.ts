import type { ServiceResult, JsonValue } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource } from '@/core/business-context/types'
import { config } from '@/infrastructure/config'
import { fetchCampaigns, formatCampaigns } from './campaigns'
import { fetchAdSets, formatAdSets } from './adsets'
import { fetchAds, formatAds } from './ads'
import { fetchCreatives, formatCreatives } from './creatives'
import { fetchInsights, formatInsights } from './insights'

export interface MetaContext {
  accessToken: string
  apiVersion: string
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
  private accessToken: string
  private adAccountId: string
  private apiVersion: string

  constructor(params?: {
    accessToken?: string
    adAccountId?: string
    apiVersion?: string
  }) {
    this.accessToken = params?.accessToken ?? process.env.META_ACCESS_TOKEN ?? ''
    this.adAccountId = params?.adAccountId ?? process.env.META_AD_ACCOUNT_ID ?? ''
    this.apiVersion = params?.apiVersion ?? config.meta.apiVersion
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

    if (!this.accessToken) {
      return {
        ok: false,
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'Meta access token not configured' },
      }
    }
    if (!this.adAccountId) {
      return {
        ok: false,
        error: { code: 'MISSING_CONFIG', message: 'Meta ad account ID not configured' },
      }
    }

    const accountId = (source.metadata.adAccountId as string) ?? this.adAccountId
    const fields = (source.metadata.fields as string[]) ?? [
      'campaigns',
      'ad_sets',
      'ads',
      'creatives',
    ]
    const ctx: MetaContext = { accessToken: this.accessToken, apiVersion: this.apiVersion }

    try {
      const documents: CollectedSource['documents'] = []
      const metadata: Record<string, JsonValue> = {
        accountId,
        collectedAt: new Date().toISOString(),
      }

      if (fields.includes('campaigns')) {
        const r = await fetchCampaigns(ctx, accountId)
        if (r.ok) {
          documents.push({
            title: 'Meta Campaigns',
            contentText: formatCampaigns(r.data),
            mimeType: 'application/json',
            metadata: { campaigns: r.data as unknown as JsonValue },
          })
          metadata.campaignCount = r.data.length
        }
      }

      if (fields.includes('ad_sets')) {
        const r = await fetchAdSets(ctx, accountId)
        if (r.ok) {
          documents.push({
            title: 'Meta Ad Sets',
            contentText: formatAdSets(r.data),
            mimeType: 'application/json',
            metadata: { adSets: r.data as unknown as JsonValue },
          })
          metadata.adSetCount = r.data.length
        }
      }

      if (fields.includes('ads')) {
        const r = await fetchAds(ctx, accountId)
        if (r.ok) {
          documents.push({
            title: 'Meta Ads',
            contentText: formatAds(r.data),
            mimeType: 'application/json',
            metadata: { ads: r.data as unknown as JsonValue },
          })
          metadata.adCount = r.data.length
        }
      }

      if (fields.includes('creatives')) {
        const r = await fetchCreatives(ctx, accountId)
        if (r.ok) {
          documents.push({
            title: 'Meta Creatives',
            contentText: formatCreatives(r.data),
            mimeType: 'application/json',
            metadata: { creatives: r.data as unknown as JsonValue },
          })
          metadata.creativeCount = r.data.length
        }
      }

      if (fields.includes('insights')) {
        const r = await fetchInsights(ctx, accountId)
        if (r.ok) {
          documents.push({
            title: 'Meta Performance Insights',
            contentText: formatInsights(r.data),
            mimeType: 'application/json',
            metadata: { insights: r.data },
          })
        }
      }

      return {
        ok: true,
        data: {
          sourceType: source.sourceType,
          sourceName: source.sourceName,
          externalReference: `meta:${accountId}`,
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
}
