import type { SupabaseClient } from '@supabase/supabase-js'
import type { JsonValue, ServiceResult } from '@/core/business-context/types'
import type {
  UpsertAdSetsInput,
  UpsertAdsInput,
  UpsertCampaignsInput,
  UpsertCreativesInput,
} from '@/core/meta-data/repository.port'

type Row = Record<string, unknown>

function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data }
}

function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

export class MetaHierarchyRepository {
  constructor(
    private readonly db: SupabaseClient,
    private readonly quarantine: (rows: Row[]) => Promise<ServiceResult<unknown>>,
  ) {}

  async upsertCampaigns(input: UpsertCampaignsInput): Promise<ServiceResult<unknown>> {
    if (input.campaigns.length === 0) return ok(null)
    const now = new Date().toISOString()
    const rows = input.campaigns.map((c) => ({
      workspace_id: input.workspaceId,
      meta_ad_account_id: input.metaAdAccountId,
      meta_campaign_id: String(c.id),
      name: String(c.name ?? ''),
      objective: c.objective ? String(c.objective) : null,
      effective_status: c.effective_status ? String(c.effective_status) : null,
      configured_status: c.configured_status ? String(c.configured_status) : null,
      buying_type: c.buying_type ? String(c.buying_type) : null,
      start_time: c.start_time ? String(c.start_time) : null,
      stop_time: c.stop_time ? String(c.stop_time) : null,
      provider_created_time: c.created_time ? String(c.created_time) : null,
      provider_updated_time: c.updated_time ? String(c.updated_time) : null,
      raw_metadata_json: c,
      meta_sync_run_id: input.runId,
      last_seen_at: now,
      updated_at: now,
    }))
    const { error } = await this.db
      .from('meta_campaigns')
      .upsert(rows, { onConflict: 'workspace_id,meta_ad_account_id,meta_campaign_id' })
    if (error) return err('UPSERT_CAMPAIGNS_FAILED', error.message)
    return ok(null)
  }

  async upsertAdSets(input: UpsertAdSetsInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>> {
    if (input.adSets.length === 0) return ok({ upserted: 0, quarantined: 0 })
    const now = new Date().toISOString()
    const validRows: Row[] = []
    const quarantinePayloads: Array<{ record: Record<string, unknown>; reason: string }> = []

    for (const adSet of input.adSets) {
      if (!adSet.id) {
        quarantinePayloads.push({ record: adSet, reason: 'Missing id' })
        continue
      }
      validRows.push({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_ad_set_id: String(adSet.id),
        meta_campaign_id: adSet.campaign_id ? String(adSet.campaign_id) : '',
        name: String(adSet.name ?? ''),
        optimization_goal: adSet.optimization_goal ? String(adSet.optimization_goal) : null,
        billing_event: adSet.billing_event ? String(adSet.billing_event) : null,
        effective_status: adSet.effective_status ? String(adSet.effective_status) : null,
        configured_status: adSet.configured_status ? String(adSet.configured_status) : null,
        daily_budget: adSet.daily_budget ? String(adSet.daily_budget) : null,
        lifetime_budget: adSet.lifetime_budget ? String(adSet.lifetime_budget) : null,
        start_time: adSet.start_time ? String(adSet.start_time) : null,
        end_time: adSet.end_time ? String(adSet.end_time) : null,
        provider_created_time: adSet.created_time ? String(adSet.created_time) : null,
        provider_updated_time: adSet.updated_time ? String(adSet.updated_time) : null,
        raw_metadata_json: adSet,
        meta_sync_run_id: input.runId,
        last_seen_at: now,
        updated_at: now,
      })
    }

    if (validRows.length > 0) {
      const { error } = await this.db
        .from('meta_ad_sets')
        .upsert(validRows, { onConflict: 'workspace_id,meta_ad_account_id,meta_ad_set_id' })
      if (error) return err('UPSERT_AD_SETS_FAILED', error.message)
    }

    if (quarantinePayloads.length > 0) {
      const qRows = quarantinePayloads.map((q) => ({
        workspace_id: input.workspaceId,
        run_id: input.runId,
        source_table: 'meta_ad_sets',
        provider_id: String(q.record.id ?? ''),
        redacted_payload: q.record as JsonValue,
        validation_errors: [q.reason] as JsonValue,
      }))
      const quarantineResult = await this.quarantine(qRows)
      if (!quarantineResult.ok) return quarantineResult as ServiceResult<{ upserted: number; quarantined: number }>
    }

    return ok({ upserted: validRows.length, quarantined: quarantinePayloads.length })
  }

  async upsertAds(input: UpsertAdsInput): Promise<ServiceResult<unknown>> {
    if (input.ads.length === 0) return ok(null)
    const now = new Date().toISOString()
    const validAds: Row[] = []
    const quarantinePayloads: Array<{ ad: Record<string, unknown>; validationErrors: string }> = []

    for (const ad of input.ads) {
      const adsetMetaId = ad.adset_id ? String(ad.adset_id) : null
      if (!adsetMetaId) {
        quarantinePayloads.push({ ad, validationErrors: 'Missing adset_id' })
        continue
      }
      const { data: adset } = await this.db
        .from('meta_ad_sets')
        .select('id')
        .eq('workspace_id', input.workspaceId)
        .eq('meta_ad_account_id', input.metaAdAccountId)
        .eq('meta_ad_set_id', adsetMetaId)
        .maybeSingle()
      if (!adset) {
        quarantinePayloads.push({ ad, validationErrors: `Parent meta_ad_set not found: ${adsetMetaId}` })
        continue
      }
      validAds.push({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_ad_id: String(ad.id),
        meta_campaign_id: ad.campaign_id ? String(ad.campaign_id) : null,
        meta_ad_set_id: adsetMetaId,
        name: ad.name ? String(ad.name) : null,
        effective_status: ad.effective_status ? String(ad.effective_status) : null,
        configured_status: ad.configured_status ? String(ad.configured_status) : null,
        provider_created_time: ad.created_time ? String(ad.created_time) : null,
        provider_updated_time: ad.updated_time ? String(ad.updated_time) : null,
        raw_metadata_json: ad,
        meta_sync_run_id: input.runId,
        last_seen_at: now,
        updated_at: now,
      })
    }

    if (validAds.length > 0) {
      const { error } = await this.db
        .from('meta_ads')
        .upsert(validAds, { onConflict: 'workspace_id,meta_ad_account_id,meta_ad_id' })
      if (error) return err('UPSERT_ADS_FAILED', error.message)
    }

    if (quarantinePayloads.length > 0) {
      const qRows = quarantinePayloads.map((q) => ({
        workspace_id: input.workspaceId,
        run_id: input.runId,
        source_table: 'meta_ads',
        provider_id: String(q.ad.id),
        redacted_payload: q.ad as JsonValue,
        validation_errors: [q.validationErrors] as JsonValue,
      }))
      const quarantineResult = await this.quarantine(qRows)
      if (!quarantineResult.ok) return quarantineResult
    }

    return ok(null)
  }

  async upsertCreatives(input: UpsertCreativesInput): Promise<ServiceResult<{ upserted: number; quarantined: number }>> {
    if (input.creatives.length === 0) return ok({ upserted: 0, quarantined: 0 })
    const now = new Date().toISOString()
    const validRows: Row[] = []
    const quarantinePayloads: Array<{ record: Record<string, unknown>; reason: string }> = []

    for (const creative of input.creatives) {
      if (!creative.id) {
        quarantinePayloads.push({ record: creative, reason: 'Missing id' })
        continue
      }
      validRows.push({
        workspace_id: input.workspaceId,
        meta_ad_account_id: input.metaAdAccountId,
        meta_creative_id: String(creative.id),
        name: String(creative.name ?? ''),
        title: creative.title ? String(creative.title) : null,
        body: creative.body ? String(creative.body) : null,
        object_story_spec: creative.object_story_spec ?? null,
        asset_feed_spec: creative.asset_feed_spec ?? null,
        thumbnail_url: creative.thumbnail_url ? String(creative.thumbnail_url) : null,
        image_url: creative.image_url ? String(creative.image_url) : null,
        video_id: creative.video_id ? String(creative.video_id) : null,
        effective_object_story_id: creative.effective_object_story_id ? String(creative.effective_object_story_id) : null,
        provider_created_time: creative.created_time ? String(creative.created_time) : null,
        provider_updated_time: creative.updated_time ? String(creative.updated_time) : null,
        raw_metadata_json: creative,
        meta_sync_run_id: input.runId,
        last_seen_at: now,
        updated_at: now,
      })
    }

    if (validRows.length > 0) {
      const { error } = await this.db
        .from('meta_creatives')
        .upsert(validRows, { onConflict: 'workspace_id,meta_ad_account_id,meta_creative_id' })
      if (error) return err('UPSERT_CREATIVES_FAILED', error.message)
    }

    if (quarantinePayloads.length > 0) {
      const qRows = quarantinePayloads.map((q) => ({
        workspace_id: input.workspaceId,
        run_id: input.runId,
        source_table: 'meta_creatives',
        provider_id: String(q.record.id ?? ''),
        redacted_payload: q.record as JsonValue,
        validation_errors: [q.reason] as JsonValue,
      }))
      const quarantineResult = await this.quarantine(qRows)
      if (!quarantineResult.ok) return quarantineResult as ServiceResult<{ upserted: number; quarantined: number }>
    }

    return ok({ upserted: validRows.length, quarantined: quarantinePayloads.length })
  }
}
