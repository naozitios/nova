import type { ServiceResult, JsonValue } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource } from '@/core/business-context/types'
import { config } from '@/infrastructure/config'

// ─── Meta API types ─────────────────────────────────────────────────────────

interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  budget_recalculated: number
  start_time?: string
  stop_time?: string
}

interface MetaAdSet {
  id: string
  name: string
  status: string
  campaign_id: string
  targeting?: Record<string, unknown>
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
}

interface MetaAd {
  id: string
  name: string
  status: string
  adset_id: string
  campaign_id: string
  creative?: { id: string }
}

interface MetaCreative {
  id: string
  name?: string
  title?: string
  body?: string
  image_hash?: string
  image_url?: string
  video_id?: string
  link_url?: string
  call_to_action_type?: string
  object_type?: string
}

interface MetaAdsInsights {
  data: Array<{
    campaign_id: string
    campaign_name: string
    impressions: string
    clicks: string
    spend: string
    cpc: string
    cpm: string
    ctr: string
    actions?: Array<{ action_type: string; value: string }>
  }>
}

// ─── Adapter ────────────────────────────────────────────────────────────────

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
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Meta access token not configured',
        },
      }
    }

    if (!this.adAccountId) {
      return {
        ok: false,
        error: {
          code: 'MISSING_CONFIG',
          message: 'Meta ad account ID not configured',
        },
      }
    }

    const accountId = (source.metadata.adAccountId as string) ?? this.adAccountId
    const fields = (source.metadata.fields as string[]) ?? [
      'campaigns',
      'ad_sets',
      'ads',
      'creatives',
    ]

    try {
      const documents: CollectedSource['documents'] = []
      const metadata: Record<string, JsonValue> = {
        accountId,
        collectedAt: new Date().toISOString(),
      }

      // Fetch campaigns
      if (fields.includes('campaigns')) {
        const campaigns = await this.fetchCampaigns(accountId)
        if (campaigns.ok) {
          documents.push({
            title: 'Meta Campaigns',
            contentText: this.formatCampaigns(campaigns.data),
            mimeType: 'application/json',
            metadata: { campaigns: campaigns.data as unknown as JsonValue },
          })
          metadata.campaignCount = campaigns.data.length
        }
      }

      // Fetch ad sets
      if (fields.includes('ad_sets')) {
        const adSets = await this.fetchAdSets(accountId)
        if (adSets.ok) {
          documents.push({
            title: 'Meta Ad Sets',
            contentText: this.formatAdSets(adSets.data),
            mimeType: 'application/json',
            metadata: { adSets: adSets.data as unknown as JsonValue },
          })
          metadata.adSetCount = adSets.data.length
        }
      }

      // Fetch ads
      if (fields.includes('ads')) {
        const ads = await this.fetchAds(accountId)
        if (ads.ok) {
          documents.push({
            title: 'Meta Ads',
            contentText: this.formatAds(ads.data),
            mimeType: 'application/json',
            metadata: { ads: ads.data as unknown as JsonValue },
          })
          metadata.adCount = ads.data.length
        }
      }

      // Fetch creatives
      if (fields.includes('creatives')) {
        const creatives = await this.fetchCreatives(accountId)
        if (creatives.ok) {
          documents.push({
            title: 'Meta Creatives',
            contentText: this.formatCreatives(creatives.data),
            mimeType: 'application/json',
            metadata: { creatives: creatives.data as unknown as JsonValue },
          })
          metadata.creativeCount = creatives.data.length
        }
      }

      // Fetch insights if requested
      if (fields.includes('insights')) {
        const insights = await this.fetchInsights(accountId)
        if (insights.ok) {
          documents.push({
            title: 'Meta Performance Insights',
            contentText: this.formatInsights(insights.data),
            mimeType: 'application/json',
            metadata: { insights: insights.data },
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

  // ─── API fetchers ─────────────────────────────────────────────────────

  private async fetchCampaigns(
    accountId: string,
  ): Promise<ServiceResult<MetaCampaign[]>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/campaigns?fields=id,name,status,objective,budget_recalculated,start_time,stop_time&limit=500`
    return this.fetchMetaArray<MetaCampaign>(url)
  }

  private async fetchAdSets(
    accountId: string,
  ): Promise<ServiceResult<MetaAdSet[]>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/adsets?fields=id,name,status,campaign_id,targeting,daily_budget,lifetime_budget,bid_strategy&limit=500`
    return this.fetchMetaArray<MetaAdSet>(url)
  }

  private async fetchAds(
    accountId: string,
  ): Promise<ServiceResult<MetaAd[]>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/ads?fields=id,name,status,adset_id,campaign_id,creative&limit=500`
    return this.fetchMetaArray<MetaAd>(url)
  }

  private async fetchCreatives(
    accountId: string,
  ): Promise<ServiceResult<MetaCreative[]>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/adcreatives?fields=id,name,title,body,image_hash,image_url,video_id,link_url,call_to_action_type,object_type&limit=500`
    return this.fetchMetaArray<MetaCreative>(url)
  }

  private async fetchInsights(
    accountId: string,
  ): Promise<ServiceResult<MetaAdsInsights['data']>> {
    const url = `https://graph.facebook.com/${this.apiVersion}/${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,actions&limit=100`
    const result = await this.fetchMetaArray<MetaAdsInsights['data'][0]>(url)
    if (!result.ok) return result
    return { ok: true, data: result.data }
  }

  private async fetchMetaArray<T>(
    url: string,
  ): Promise<ServiceResult<T[]>> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
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

  // ─── Formatting ───────────────────────────────────────────────────────

  private formatCampaigns(campaigns: MetaCampaign[]): string {
    if (campaigns.length === 0) return 'No campaigns found.'

    return campaigns
      .map(
        (c) =>
          `## Campaign: ${c.name}\n\n` +
          `- **ID**: ${c.id}\n` +
          `- **Status**: ${c.status}\n` +
          `- **Objective**: ${c.objective}\n` +
          `- **Budget recalculated**: ${c.budget_recalculated}\n` +
          (c.start_time ? `- **Start**: ${c.start_time}\n` : '') +
          (c.stop_time ? `- **Stop**: ${c.stop_time}\n` : ''),
      )
      .join('\n\n')
  }

  private formatAdSets(adSets: MetaAdSet[]): string {
    if (adSets.length === 0) return 'No ad sets found.'

    return adSets
      .map(
        (a) =>
          `## Ad Set: ${a.name}\n\n` +
          `- **ID**: ${a.id}\n` +
          `- **Status**: ${a.status}\n` +
          `- **Campaign**: ${a.campaign_id}\n` +
          (a.daily_budget ? `- **Daily budget**: ${a.daily_budget}\n` : '') +
          (a.lifetime_budget ? `- **Lifetime budget**: ${a.lifetime_budget}\n` : '') +
          (a.bid_strategy ? `- **Bid strategy**: ${a.bid_strategy}\n` : ''),
      )
      .join('\n\n')
  }

  private formatAds(ads: MetaAd[]): string {
    if (ads.length === 0) return 'No ads found.'

    return ads
      .map(
        (a) =>
          `## Ad: ${a.name}\n\n` +
          `- **ID**: ${a.id}\n` +
          `- **Status**: ${a.status}\n` +
          `- **Campaign**: ${a.campaign_id}\n` +
          `- **Ad Set**: ${a.adset_id}\n` +
          (a.creative ? `- **Creative**: ${a.creative.id}\n` : ''),
      )
      .join('\n\n')
  }

  private formatCreatives(creatives: MetaCreative[]): string {
    if (creatives.length === 0) return 'No creatives found.'

    return creatives
      .map(
        (c) =>
          `## Creative${c.name ? `: ${c.name}` : ''}\n\n` +
          `- **ID**: ${c.id}\n` +
          (c.title ? `- **Title**: ${c.title}\n` : '') +
          (c.body ? `- **Body**: ${c.body}\n` : '') +
          (c.call_to_action_type ? `- **CTA**: ${c.call_to_action_type}\n` : '') +
          (c.link_url ? `- **Link**: ${c.link_url}\n` : '') +
          (c.object_type ? `- **Object type**: ${c.object_type}\n` : ''),
      )
      .join('\n\n')
  }

  private formatInsights(insights: MetaAdsInsights['data']): string {
    if (insights.length === 0) return 'No insights available.'

    return insights
      .map(
        (i) =>
          `## ${i.campaign_name}\n\n` +
          `- **Impressions**: ${i.impressions}\n` +
          `- **Clicks**: ${i.clicks}\n` +
          `- **Spend**: ${i.spend}\n` +
          `- **CPC**: ${i.cpc}\n` +
          `- **CPM**: ${i.cpm}\n` +
          `- **CTR**: ${i.ctr}`,
      )
      .join('\n\n')
  }
}
