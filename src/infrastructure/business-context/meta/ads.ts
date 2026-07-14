import type { ServiceResult } from '@/core/business-context/types'
import { fetchMetaArray, type MetaContext } from './meta-adapter'

export interface MetaAd {
  id: string
  name: string
  status: string
  adset_id: string
  campaign_id: string
  creative?: { id: string }
}

export async function fetchAds(
  ctx: MetaContext,
  accountId: string,
): Promise<ServiceResult<MetaAd[]>> {
  const url = `https://graph.facebook.com/${ctx.apiVersion}/${accountId}/ads?fields=id,name,status,adset_id,campaign_id,creative&limit=500`
  return fetchMetaArray<MetaAd>(ctx, url)
}

export function formatAds(ads: MetaAd[]): string {
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
