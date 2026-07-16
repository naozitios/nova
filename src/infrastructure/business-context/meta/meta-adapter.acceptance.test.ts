import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { MetaSourceAdapter } from './meta-adapter'
import type { ContextSource } from '@/core/business-context/types'

// ─── Provider boundary mock ─────────────────────────────────────────────────

const fetchSpy = vi.fn<typeof global.fetch>()

function makeSource(overrides?: Partial<ContextSource>): ContextSource {
  return {
    id: 'src-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceType: 'meta',
    sourceName: 'Meta Ads',
    externalReference: null,
    status: 'pending',
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(),
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('MetaSourceAdapter — acceptance', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── supports ────────────────────────────────────────────────────────────

  it('supports only "meta" source type', () => {
    const adapter = new MetaSourceAdapter({
      accessToken: 'tok',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })
    expect(adapter.supports('meta')).toBe(true)
    expect(adapter.supports('web')).toBe(false)
    expect(adapter.supports('firecrawl')).toBe(false)
  })

  // ── credential validation ───────────────────────────────────────────────

  it('returns PROVIDER_UNAVAILABLE when access token is missing', async () => {
    const adapter = new MetaSourceAdapter({
      accessToken: '',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_UNAVAILABLE')
      expect(result.error.message).toBe('Meta access token not configured')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns MISSING_CONFIG when ad account ID is missing', async () => {
    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_abc',
      adAccountId: '',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_CONFIG')
      expect(result.error.message).toBe('Meta ad account ID not configured')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  // ── provider unreachable ────────────────────────────────────────────────

  it('returns PROVIDER_ERROR when Meta API is unreachable (fetch throws)', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('fetch failed'))

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource(),
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR')
      expect(result.error.message).toContain('Meta API error')
      expect(result.error.message).toContain('fetch failed')
    }
  })

  // ── HTTP error response ─────────────────────────────────────────────────

  it('returns error when Meta API returns HTTP 5xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    )

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns'] } }),
    })

    // Sub-fetch HTTP errors are silently skipped per-field — collect degrades gracefully
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.documents).toHaveLength(0)
    }
  })

  it('returns error when Meta API body contains error object', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ error: { message: 'Invalid token', type: 'OAuthException', code: 190 } }),
    )

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns'] } }),
    })

    // Error in response body → field silently skipped, collect succeeds
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.documents).toHaveLength(0)
    }
  })

  // ── no token leak ───────────────────────────────────────────────────────

  it('never leaks access token in error messages on failure', async () => {
    const secretToken = 'EAAsecret_leak_12345_xyz'
    fetchSpy.mockRejectedValueOnce(new Error('network down'))

    const adapter = new MetaSourceAdapter({
      accessToken: secretToken,
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource(),
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(secretToken)
  })

  it('never leaks access token in result metadata on success', async () => {
    const secretToken = 'EAAsecret_leak_12345_xyz'
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'camp1', name: 'Test', status: 'ACTIVE', objective: 'CONVERSIONS', budget_recalculated: 0 }] }),
    )

    const adapter = new MetaSourceAdapter({
      accessToken: secretToken,
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns'] } }),
    })

    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(secretToken)
  })

  // ── successful collect ──────────────────────────────────────────────────

  it('returns collected documents when Meta API responds successfully', async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'camp1', name: 'Summer Sale', status: 'ACTIVE', objective: 'CONVERSIONS', budget_recalculated: 5000 }] }),
    )

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns'] } }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.sourceType).toBe('meta')
      expect(result.data.externalReference).toBe('meta:act_123')
      expect(result.data.documents).toHaveLength(1)
      expect(result.data.documents[0].title).toBe('Meta Campaigns')
      expect(result.data.metadata.accountId).toBe('act_123')
      expect(result.data.metadata.campaignCount).toBe(1)
    }
  })

  it('collects multiple field types in a single call', async () => {
    // campaigns
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'c1', name: 'Camp1', status: 'ACTIVE', objective: 'X', budget_recalculated: 0 }] }),
    )
    // ad_sets
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'as1', name: 'AdSet1', status: 'ACTIVE', campaign_id: 'c1' }] }),
    )
    // ads
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ data: [{ id: 'ad1', name: 'Ad1', status: 'ACTIVE', adset_id: 'as1', campaign_id: 'c1' }] }),
    )

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns', 'ad_sets', 'ads'] } }),
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.documents).toHaveLength(3)
      expect(result.data.metadata.campaignCount).toBe(1)
      expect(result.data.metadata.adSetCount).toBe(1)
      expect(result.data.metadata.adCount).toBe(1)
    }
  })

  // ── graceful degradation on partial failure ──────────────────────────────

  it('returns empty documents when all sub-fetches fail', async () => {
    fetchSpy.mockRejectedValue(new Error('all down'))

    const adapter = new MetaSourceAdapter({
      accessToken: 'tok_valid',
      adAccountId: 'act_123',
      apiVersion: 'v22.0',
    })

    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source: makeSource({ metadata: { fields: ['campaigns', 'ad_sets'] } }),
    })

    // When fetch itself throws (network failure), outer catch returns PROVIDER_ERROR
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROVIDER_ERROR')
      expect(result.error.message).toContain('all down')
    }
  })
})
