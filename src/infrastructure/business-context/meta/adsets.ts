import type { ServiceResult } from '@/core/business-context/types'
import { fetchMetaArray, type MetaContext } from './meta-adapter'

export interface MetaAdSet {
  id: string
  name: string
  status: string
  campaign_id: string
  targeting?: Record<string, unknown>
  daily_budget?: string
  lifetime_budget?: string
  bid_strategy?: string
}

export async function fetchAdSets(
  ctx: MetaContext,
  accountId: string,
): Promise<ServiceResult<MetaAdSet[]>> {
  const url = `https://graph.facebook.com/${ctx.apiVersion}/${accountId}/adsets?fields=id,name,status,campaign_id,targeting,daily_budget,lifetime_budget,bid_strategy&limit=500`
  return fetchMetaArray<MetaAdSet>(ctx, url)
}

export function formatAdSets(adSets: MetaAdSet[]): string {
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
