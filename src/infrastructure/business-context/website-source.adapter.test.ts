import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ContextSource, JsonValue } from '../../core/business-context/types/entities'

// ── Mocks ──────────────────────────────────────────────────────────────────
vi.mock('./ssrf-guard', () => ({
  parseUrl: (u: string) => {
    try {
      const url = new URL(u)
      return { hostname: url.hostname, protocol: url.protocol, pathname: url.pathname, search: url.search, href: url.href }
    } catch { return null }
  },
  isLocalhost: () => false,
  isPrivateNetwork: () => false,
  isDomainApproved: () => true,
}))
vi.mock('./website-source.robots', () => ({
  isDisallowedByRobots: () => false,
}))
vi.mock('./website-source.dedupe', () => ({
  dedupeByCanonical: async (p: unknown[]) => p,
  dedupeByContentHash: async (p: unknown[]) => p,
}))

import { WebsiteSourceAdapter } from './website-source.adapter'

function makeSource(overrides?: Record<string, JsonValue>): ContextSource {
  return {
    id: 'src-1',
    workspaceId: 'w',
    businessId: 'b',
    sourceType: 'website',
    sourceName: 'Test',
    externalReference: 'https://example.com',
    status: 'processing',
    currentStage: null,
    terminalOutcome: null,
    metadata: { approvedDomains: ['example.com'], ...overrides },
    collectedAt: new Date('2025-01-01T00:00:00Z'),
  }
}

describe('WebsiteSourceAdapter — Firecrawl v2 crawl schema', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('sends formats inside scrapeOptions and accepts jobId field', async () => {
    fetchSpy
      // robots.txt
      .mockResolvedValueOnce({ ok: false })
      // redirect preflight
      .mockResolvedValueOnce({ status: 200 })
      // POST /v2/crawl — 200 OK, no success field, jobId present
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ jobId: 'job-abc' }),
      })
      // poll — completed
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com', html: '<p>hi</p>', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'key' })
    const result = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })

    // advance poll interval
    await vi.advanceTimersByTimeAsync(6000)
    const res = await result

    expect(res.ok).toBe(true)

    const startCall = fetchSpy.mock.calls[2]
    expect(startCall[0]).toBe('https://api.firecrawl.dev/v2/crawl')
    expect(startCall[1].method).toBe('POST')
    const body = JSON.parse(startCall[1].body)
    expect(body.scrapeOptions).toEqual({ onlyMainContent: true, formats: ['markdown', 'html'] })
    expect(body.formats).toBeUndefined()
  })

  it('polls in_progress with no next then completed', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j1' }),
      })
      // poll 1: in_progress, no next
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ status: 'in_progress' }),
      })
      // poll 2: completed
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com', html: '<p>ok</p>', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })

    await vi.advanceTimersByTimeAsync(6000) // poll 1
    await vi.advanceTimersByTimeAsync(6000) // poll 2
    const res = await p

    expect(res.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(5) // robots + preflight + start + 2 polls
    // second poll hit the same status URL, not success-exit
    const poll2Url = fetchSpy.mock.calls[4][0]
    expect(poll2Url).toBe('https://api.firecrawl.dev/v2/crawl/j1')
  })

  it('follows relative next URLs for pagination', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j2' }),
      })
      // poll 1: completed with relative next
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com/a', html: '<p>a</p>', statusCode: 200 }],
          next: '/v2/crawl/j2?page=2',
        }),
      })
      // poll 2: completed, no next
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com/b', html: '<p>b</p>', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })

    await vi.advanceTimersByTimeAsync(6000)
    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(true)
    // pagination followed
    const poll2Url = fetchSpy.mock.calls[4][0]
    expect(poll2Url).toBe('https://api.firecrawl.dev/v2/crawl/j2?page=2')
  })

  it('rejects page with empty html as FIRECRAWL_HTML_MISSING', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j3' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com', html: '', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })
    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('FIRECRAWL_HTML_MISSING')
    }
  })

  it('reports last creditsUsed not cumulative sum across polls (top-level)', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })       // robots.txt
      .mockResolvedValueOnce({ status: 200 })     // redirect preflight
      .mockResolvedValueOnce({                     // POST /v2/crawl
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-cred' }),
      })
      // poll 1: in_progress, creditsUsed 5
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'in_progress',
          creditsUsed: 5,
          data: [{ url: 'https://example.com', html: '<p>a</p>', statusCode: 200 }],
        }),
      })
      // poll 2: completed, creditsUsed 10
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          creditsUsed: 10,
          data: [{ url: 'https://example.com', html: '<p>b</p>', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })

    await vi.advanceTimersByTimeAsync(6000) // poll 1
    await vi.advanceTimersByTimeAsync(6000) // poll 2
    const res = await p

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.metadata.creditsUsed).toBe(10)
    }
  })

  it('reports last creditsUsed not cumulative sum across polls (nested)', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-ncred' }),
      })
      // poll 1: nested creditsUsed 3
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'in_progress',
          data: { pages: [{ url: 'https://example.com', html: '<p>a</p>', statusCode: 200 }], creditsUsed: 3 },
        }),
      })
      // poll 2: nested creditsUsed 8
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: { pages: [{ url: 'https://example.com', html: '<p>b</p>', statusCode: 200 }], creditsUsed: 8 },
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })

    await vi.advanceTimersByTimeAsync(6000)
    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.metadata.creditsUsed).toBe(8)
    }
  })

  it('normalizes page with url/statusCode only in metadata before dedupe/SSRF', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })       // robots.txt
      .mockResolvedValueOnce({ status: 200 })     // redirect preflight
      .mockResolvedValueOnce({                     // POST /v2/crawl
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-meta' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{
            html: '<p>about us</p>',
            metadata: {
              sourceURL: 'https://example.com/about',
              statusCode: 200,
              title: 'About Us',
            },
          }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })
    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.documents).toHaveLength(1)
      expect(res.data.documents[0].url).toBe('https://example.com/about')
      expect(res.data.documents[0].httpStatus).toBe(200)
      expect(res.data.documents[0].title).toBe('About Us')
    }
  })

  it('rejects non-2xx poll response', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j4' }),
      })
      .mockResolvedValueOnce({
        ok: false, status: 500,
        json: async () => ({ error: 'Internal error' }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource() })
    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('PROVIDER_ERROR')
    }
  })

  // ── TDD RED: poll AbortSignal + unified timeout ──────────────────────────
  it('poll fetch receives an AbortSignal', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-signal' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ status: 'in_progress' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          status: 'completed',
          data: [{ url: 'https://example.com', html: '<p>ok</p>', statusCode: 200 }],
        }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({ workspaceId: 'w', businessId: 'b', source: makeSource({ timeoutMs: 30_000 }) })
    await vi.advanceTimersByTimeAsync(6000)
    await vi.advanceTimersByTimeAsync(6000)
    await p

    // poll calls (indices 3 and 4) must have signal in init
    const pollCall1 = fetchSpy.mock.calls[3]
    const pollCall2 = fetchSpy.mock.calls[4]
    expect(pollCall1[1]).toHaveProperty('signal')
    expect(pollCall2[1]).toHaveProperty('signal')
  })

  it('nonterminal polling exceeding configured timeout returns PROVIDER_TIMEOUT', async () => {
    // Slow provider: polls never complete; timeout is 10s
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-timeout' }),
      })
      .mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ status: 'in_progress' }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({
      workspaceId: 'w', businessId: 'b',
      source: makeSource({ timeoutMs: 10_000 }),
    })

    // Advance past timeout (10s). Polls happen every 5s.
    await vi.advanceTimersByTimeAsync(12_000)
    const res = await p

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('PROVIDER_TIMEOUT')
      expect(res.error.message).toMatch(/timed out/i)
    }
  })

  it('does not sleep beyond the remaining poll deadline', async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-short-timeout' }),
      })

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    let settled = false
    const result = adapter.collect({
      workspaceId: 'w', businessId: 'b',
      source: makeSource({ timeoutMs: 1_000 }),
    }).then((value) => {
      settled = true
      return value
    })

    await vi.advanceTimersByTimeAsync(999)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe(true)
    expect((await result).ok).toBe(false)
  })

  it('AbortError from poll maps PROVIDER_TIMEOUT', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    fetchSpy
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({ jobId: 'j-abort' }),
      })
      .mockRejectedValueOnce(abortError) // poll throws AbortError

    const adapter = new WebsiteSourceAdapter({ apiKey: 'k' })
    const p = adapter.collect({
      workspaceId: 'w', businessId: 'b',
      source: makeSource({ timeoutMs: 5_000 }),
    })

    await vi.advanceTimersByTimeAsync(6000)
    const res = await p

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.error.code).toBe('PROVIDER_TIMEOUT')
    }
  })
})
