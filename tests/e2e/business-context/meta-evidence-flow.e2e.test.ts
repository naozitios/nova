import { describe, expect, it, beforeAll, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { resetDatabase } from './harness'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { MetaSourceAdapter } from '@/infrastructure/business-context/meta/meta-adapter'
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service'
import { compileDraftFromFacts } from '@/core/business-context/compiler'

const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? ''
const hasDeps = !!serviceKey

function svc() {
  return createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
}

describe.skipIf(!hasDeps)('Meta evidence flow e2e', () => {
  beforeAll(async () => {
    await resetDatabase()
  }, 120_000)

  it('uses selected account stored data to process Meta source and compile provenance', { timeout: 60_000 }, async () => {
    const db = svc()
    const workspaceId = crypto.randomUUID()
    const businessId = crypto.randomUUID()
    const userId = crypto.randomUUID()
    const connectionId = crypto.randomUUID()
    const runId = crypto.randomUUID()
    const sourceId = crypto.randomUUID()

    await db.from('workspaces').insert({ id: workspaceId, name: 'Meta Evidence E2E Workspace' }).throwOnError()
    await db.from('businesses').insert({
      id: businessId,
      workspace_id: workspaceId,
      name: 'Meta Evidence E2E Business',
    }).throwOnError()
    await db.from('meta_connections').insert({
      id: connectionId,
      workspace_id: workspaceId,
      connected_by: userId,
      meta_user_id: 'meta-user-1',
      encrypted_access_token: 'encrypted-token',
      granted_scopes: ['ads_read'],
      status: 'connected',
    }).throwOnError()
    await db.from('meta_ad_accounts').insert({
      workspace_id: workspaceId,
      connection_id: connectionId,
      business_id: businessId,
      meta_account_id: 'act_123',
      account_id: '123',
      name: 'Stored Meta Account',
      is_selected: true,
    }).throwOnError()
    await db.from('meta_sync_runs').insert({
      id: runId,
      workspace_id: workspaceId,
      meta_ad_account_id: 'act_123',
      status: 'completed',
      mode: 'initial_backfill',
      idempotency_key: `meta-e2e-${runId}`,
    }).throwOnError()
    await db.from('meta_campaigns').insert({
      workspace_id: workspaceId,
      meta_ad_account_id: 'act_123',
      meta_campaign_id: 'camp-1',
      name: 'Spring Sale',
      objective: 'OUTCOME_SALES',
      effective_status: 'ACTIVE',
      meta_sync_run_id: runId,
    }).throwOnError()
    await db.from('meta_ads').insert({
      workspace_id: workspaceId,
      meta_ad_account_id: 'act_123',
      meta_ad_id: 'ad-1',
      meta_campaign_id: 'camp-1',
      meta_creative_id: 'cr-1',
      name: 'Discount Ad',
      effective_status: 'ACTIVE',
      meta_sync_run_id: runId,
    }).throwOnError()
    await db.from('meta_creatives').insert({
      workspace_id: workspaceId,
      meta_ad_account_id: 'act_123',
      meta_creative_id: 'cr-1',
      name: 'Sale Creative',
      title: 'Sale',
      body: 'Save 20% today',
      meta_sync_run_id: runId,
    }).throwOnError()
    await db.from('meta_insights_daily').insert({
      workspace_id: workspaceId,
      meta_ad_account_id: 'act_123',
      meta_campaign_id: 'camp-1',
      meta_ad_id: 'ad-1',
      date_start: '2026-07-01',
      date_stop: '2026-07-01',
      spend: 25,
      impressions: 1000,
      clicks: 50,
      actions: [{ action_type: 'purchase', value: '5' }],
      action_values: [{ action_type: 'purchase', value: '250' }],
      meta_sync_run_id: runId,
      api_version: 'v21.0',
    }).throwOnError()
    await db.from('context_sources').insert({
      id: sourceId,
      workspace_id: workspaceId,
      business_id: businessId,
      source_type: 'meta',
      source_name: 'Stored Meta Evidence',
      status: 'registered',
      metadata: { since: '2026-07-01', until: '2026-07-01' },
    }).throwOnError()

    const repo = new SupabaseRepository(db)
    const service = new SourceProcessingService(repo, {
      extractFacts: async () => ({
        ok: true,
        data: {
          facts: [{ factKey: 'offers.primary', value: 'Spring Sale', confidence: 0.91, sourceExcerpt: 'Spring Sale', evidenceLocator: null }],
          conflicts: [],
          warnings: [],
        },
      }),
      reconcileFacts: vi.fn(),
    })
    service.registerAdapter(new MetaSourceAdapter({ repo: new SupabaseMetaRepository(db), db }))

    const processed = await service.processSource(businessId, workspaceId, sourceId)
    expect(processed.ok).toBe(true)

    const draft = await compileDraftFromFacts(repo, businessId, workspaceId)
    expect(draft.ok).toBe(true)
    if (!draft.ok) return
    expect(JSON.stringify(draft.data.profile._provenance)).toContain('act_123')
    expect(JSON.stringify(draft.data.profile._provenance)).toContain('2026-07-01')
  })
})
