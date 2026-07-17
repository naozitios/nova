import type { CollectedDocument } from '@/core/business-context/source-adapter.port'

// ─── Input ────────────────────────────────────────────────────────────────────

export interface StoredMetaEvidenceInput {
  metaAdAccountId: string
  dataWindow: { since: string; until: string }
  freshness: {
    latestDate: string
    missingWindowCount: number
    gapCount: number
  }
  campaigns: Array<{
    id: string
    name: string
    objective: string
    status: string
  }>
  ads: Array<{
    id: string
    name: string
    status: string
    creative: {
      body: string
      title: string
      call_to_action_type: string
    }
  }>
  insights: Array<{
    metaAdId: string
    dateStart: string
    dateStop: string
    spend: number
    impressions: number
    clicks: number
    actions: Array<{ action_type: string; value: string }>
    actionValues: Array<{ action_type: string; value: string }>
  }>
}

// ─── Internal doc shape (extends CollectedDocument with test-required fields) ─

interface MetaEvidenceDocument extends CollectedDocument {
  content: string
  type: string
  metaAdAccountId: string
  dataWindow: { since: string; until: string }
  freshness: {
    latestDate: string
    missingWindowCount: number
    gapCount: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContentText(
  title: string,
  input: StoredMetaEvidenceInput,
  summary: string,
): string {
  return [
    `${title} — Meta Ad Account ${input.metaAdAccountId}`,
    `Data window: ${input.dataWindow.since} to ${input.dataWindow.until}`,
    `Latest data: ${input.freshness.latestDate}`,
    `Missing windows: ${input.freshness.missingWindowCount} | Gaps: ${input.freshness.gapCount}`,
    '',
    summary,
  ].join('\n')
}

function buildDoc(
  type: string,
  title: string,
  input: StoredMetaEvidenceInput,
  payload: Record<string, unknown>,
  summary: string,
): MetaEvidenceDocument {
  return {
    title,
    type,
    mimeType: 'application/json',
    content: JSON.stringify(payload),
    contentText: makeContentText(title, input, summary),
    metadata: {
      metaAdAccountId: input.metaAdAccountId,
      dataWindow: input.dataWindow,
      freshness: input.freshness,
      ...payload,
    },
    metaAdAccountId: input.metaAdAccountId,
    dataWindow: input.dataWindow,
    freshness: input.freshness,
  }
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export function buildMetaEvidenceDocuments(
  input: StoredMetaEvidenceInput,
): MetaEvidenceDocument[] {
  const campaignDoc = buildDoc(
    'campaign_objectives',
    'Meta Campaign Evidence',
    input,
    { campaigns: input.campaigns, campaignCount: input.campaigns.length },
    `Campaigns (${input.campaigns.length}): ${input.campaigns.map((c) => `${c.name} [${c.objective}]`).join(', ')}`,
  )

  const adsDoc = buildDoc(
    'active_ads_creative',
    'Meta Ad Creative Evidence',
    input,
    { ads: input.ads, adCount: input.ads.length },
    `Ads (${input.ads.length}): ${input.ads.map((a) => `${a.name} — "${a.creative.body}"`).join(', ')}`,
  )

  const spendDoc = buildDoc(
    'spend_performance',
    'Meta Performance Evidence',
    input,
    { insights: input.insights, insightCount: input.insights.length },
    `Insights (${input.insights.length}): ${input.insights.map((i) => `${i.metaAdId}: $${i.spend} spend, ${i.impressions} impr`).join(', ')}`,
  )

  const conversions = input.insights.map((i) => ({
    metaAdId: i.metaAdId,
    dateStart: i.dateStart,
    dateStop: i.dateStop,
    actions: i.actions,
    actionValues: i.actionValues,
  }))

  const optDoc = buildDoc(
    'optimization_conversions',
    'Meta Conversion Evidence',
    input,
    { conversions, conversionCount: conversions.length, insightCount: conversions.length },
    `Conversions (${conversions.length}): ${conversions.map((c) => `${c.metaAdId}: ${c.actions.length} action types`).join(', ')}`,
  )

  return [campaignDoc, adsDoc, spendDoc, optDoc]
}
