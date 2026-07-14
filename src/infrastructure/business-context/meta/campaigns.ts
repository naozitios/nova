import type { ServiceResult } from '@/core/business-context/types'
import { fetchMetaArray, type MetaContext } from './meta-adapter'

export interface MetaCampaign {
  id: string
  name: string
  status: string
  objective: string
  budget_recalculated: number
  start_time?: string
  stop_time?: string
}

export async function fetchCampaigns(
  ctx: MetaContext,
  accountId: string,
): Promise<ServiceResult<MetaCampaign[]>> {
  const url = `https://graph.facebook.com/${ctx.apiVersion}/${accountId}/campaigns?fields=id,name,status,objective,budget_recalculated,start_time,stop_time&limit=500`
  return fetchMetaArray<MetaCampaign>(ctx, url)
}

export function formatCampaigns(campaigns: MetaCampaign[]): string {
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
