import type { ServiceResult } from '@/core/business-context/types'
import { fetchMetaArray, type MetaContext } from './meta-adapter'

export interface MetaCreative {
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

export async function fetchCreatives(
  ctx: MetaContext,
  accountId: string,
): Promise<ServiceResult<MetaCreative[]>> {
  const url = `https://graph.facebook.com/${ctx.apiVersion}/${accountId}/adcreatives?fields=id,name,title,body,image_hash,image_url,video_id,link_url,call_to_action_type,object_type&limit=500`
  return fetchMetaArray<MetaCreative>(ctx, url)
}

export function formatCreatives(creatives: MetaCreative[]): string {
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
