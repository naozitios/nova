import type { ServiceResult } from '@/core/business-context/types'
import { fetchMetaArray, type MetaContext } from './meta-adapter'

export interface MetaAdsInsights {
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

export async function fetchInsights(
  ctx: MetaContext,
  accountId: string,
): Promise<ServiceResult<MetaAdsInsights['data']>> {
  const url = `https://graph.facebook.com/${ctx.apiVersion}/${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,actions&limit=100`
  const result = await fetchMetaArray<MetaAdsInsights['data'][0]>(ctx, url)
  if (!result.ok) return result
  return { ok: true, data: result.data }
}

export function formatInsights(insights: MetaAdsInsights['data']): string {
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
