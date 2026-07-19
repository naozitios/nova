import type { ServiceResult, ContextSource, JsonValue } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import {
  isLocalhost,
  isPrivateNetwork,
  isDomainApproved,
  parseUrl,
} from './ssrf-guard'
import { isDisallowedByRobots } from './website-source.robots'
import { sanitizeContent, applyLinePrefix } from './website-source.sanitize'
import { dedupeByCanonical, dedupeByContentHash } from './website-source.dedupe'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_REDIRECT_HOPS = 5

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebsiteSourceAdapterOptions {
  apiKey?: string
  defaultTimeoutMs?: number
  defaultMaxPages?: number
  defaultMaxTextBytes?: number
}

interface FirecrawlPage {
  url?: string
  markdown?: string
  html?: string
  statusCode?: number
  metadata?: Record<string, unknown>
  title?: string
  description?: string
}

interface FirecrawlCrawlStartResponse {
  success?: boolean
  id?: string
  jobId?: string
  error?: string
}

interface FirecrawlCrawlPollResponse {
  success?: boolean
  status: 'in_progress' | 'scraping' | 'completed' | 'failed' | 'cancelled'
  data?: FirecrawlPage[] | { pages?: FirecrawlPage[]; creditsUsed?: number }
  creditsUsed?: number
  next?: string
  error?: string
}

interface NormalizedPage {
  url: string
  markdown?: string
  html?: string
  statusCode: number
  metadata?: Record<string, unknown>
  title?: string
  description?: string
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class WebsiteSourceAdapter implements SourceAdapterPort {
  private readonly apiKey: string
  private readonly defaultTimeoutMs: number
  private readonly defaultMaxPages: number
  private readonly defaultMaxTextBytes: number
  private readonly budgetState = new Map<
    string,
    { pages: number; textBytes: number }
  >()

  constructor(options: WebsiteSourceAdapterOptions = {}) {
    this.apiKey = options.apiKey ?? ''
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000
    this.defaultMaxPages = options.defaultMaxPages ?? 30
    this.defaultMaxTextBytes = options.defaultMaxTextBytes ?? 5 * 1024 * 1024
  }

  supports(sourceType: string): boolean {
    return sourceType === 'website'
  }

  async collect(params: {
    workspaceId: string
    businessId: string
    source: ContextSource
  }): Promise<ServiceResult<CollectedSource>> {
    const { source } = params
    const url = source.externalReference
    if (!url) {
      return {
        ok: false,
        error: { code: 'MISSING_URL', message: 'Website source requires a URL' },
      }
    }

    // ── Pre-redirect SSRF check ───────────────────────────────────────────
    const parsed = parseUrl(url)
    if (!parsed) {
      return {
        ok: false,
        error: { code: 'SSRF_BLOCKED', message: 'Invalid URL format' },
      }
    }
    if (isLocalhost(parsed.hostname) || isPrivateNetwork(parsed.hostname)) {
      return {
        ok: false,
        error: { code: 'SSRF_BLOCKED', message: 'Private network target blocked' },
      }
    }

    // ── Domain confinement ────────────────────────────────────────────────
    const approvedDomains = (source.metadata.approvedDomains as string[]) ?? []
    if (!isDomainApproved(parsed.hostname, approvedDomains)) {
      return {
        ok: false,
        error: {
          code: 'DOMAIN_NOT_APPROVED',
          message: `Domain ${parsed.hostname} not in approved list`,
        },
      }
    }

    // ── Robots.txt check ──────────────────────────────────────────────────
    const robotsUrl = `${parsed.protocol}//${parsed.hostname}/robots.txt`
    const robotsResp = await fetch(robotsUrl)
    if (robotsResp.ok) {
      const robotsTxt = await robotsResp.text()
      if (isDisallowedByRobots(parsed.pathname + parsed.search, robotsTxt)) {
        return {
          ok: false,
          error: {
            code: 'ROBOTS_DISALLOWED',
            message: `Path ${parsed.pathname} disallowed by robots.txt`,
          },
        }
      }
    }

    // ── Redirect chain validation ──────────────────────────────────────────
    let currentUrl = url
    let hops = 0
    while (hops < MAX_REDIRECT_HOPS) {
      const preflight = await fetch(currentUrl, { redirect: 'manual' })
      if (!(preflight.status >= 300 && preflight.status < 400)) break

      const location = preflight.headers.get('Location')
      if (!location || location.trim() === '') {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Redirect ${preflight.status} missing or invalid Location header`,
          },
        }
      }

      if (!location.startsWith('http') && !location.startsWith('/')) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: 'Redirect missing or invalid Location header',
          },
        }
      }
      const redirectParsed = parseUrl(
        location.startsWith('http')
          ? location
          : `${parsed.protocol}//${parsed.hostname}${location}`,
      )
      if (!redirectParsed) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: 'Redirect missing or invalid Location header',
          },
        }
      }
      if (
        isLocalhost(redirectParsed.hostname) ||
        isPrivateNetwork(redirectParsed.hostname)
      ) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: 'Redirect targets private network',
          },
        }
      }
      if (!isDomainApproved(redirectParsed.hostname, approvedDomains)) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Redirect targets non-approved domain ${redirectParsed.hostname}`,
          },
        }
      }

      currentUrl = redirectParsed.href
      hops++
    }
    if (hops >= MAX_REDIRECT_HOPS) {
      return {
        ok: false,
        error: {
          code: 'SSRF_REDIRECT_CHAIN_EXCEEDED',
          message: `Redirect chain exceeded ${MAX_REDIRECT_HOPS} hops`,
        },
      }
    }

    // ── Firecrawl v2 crawl ───────────────────────────────────────────────
    const timeoutMs =
      (source.metadata.timeoutMs as number) ?? this.defaultTimeoutMs
    const limit =
      (source.metadata.maxPages as number) ?? this.defaultMaxPages
    const deadline = Date.now() + timeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let jobId: string
    try {
      const startResp = await fetch('https://api.firecrawl.dev/v2/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          limit,
          scrapeOptions: { onlyMainContent: true, formats: ['markdown', 'html'] },
        }),
        signal: controller.signal,
      })
      if (!startResp.ok) {
        const errBody = await startResp.json().catch(() => ({}))
        return {
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: (errBody as { error?: string }).error ?? `Firecrawl crawl start failed (${startResp.status})`,
          },
        }
      }
      const startBody: FirecrawlCrawlStartResponse = await startResp.json()
      const candidate = startBody.jobId ?? startBody.id
      if (!candidate) {
        return {
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: startBody.error ?? 'Firecrawl crawl start returned no job ID',
          },
        }
      }
      jobId = candidate
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          ok: false,
          error: { code: 'PROVIDER_TIMEOUT', message: 'Request timed out' },
        }
      }
      return {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: err instanceof Error ? err.message : 'Fetch failed',
        },
      }
    } finally {
      clearTimeout(timer)
    }

    // ── Poll for results ──────────────────────────────────────────────────
    const POLL_INTERVAL = 5000
    const allPages: FirecrawlPage[] = []
    let creditsUsed = 0
    let pollUrl: string | null = `https://api.firecrawl.dev/v2/crawl/${jobId}`

    while (pollUrl && Date.now() < deadline) {
      const remainingMs = Math.max(0, deadline - Date.now())
      await new Promise((r) => setTimeout(r, Math.min(POLL_INTERVAL, remainingMs)))
      if (Date.now() >= deadline) break

      const remaining = deadline - Date.now()
      const pollController = new AbortController()
      const pollTimer = setTimeout(() => pollController.abort(), remaining)

      try {
        const pollResp = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: pollController.signal,
        })
        clearTimeout(pollTimer)
        if (!pollResp.ok) {
          return {
            ok: false,
            error: {
              code: 'PROVIDER_ERROR',
              message: `Firecrawl poll failed (${pollResp.status})`,
            },
          }
        }
        const pollBody: FirecrawlCrawlPollResponse = await pollResp.json()

        // Collect pages from data (array) or legacy {pages} envelope
        if (Array.isArray(pollBody.data)) {
          allPages.push(...pollBody.data)
        } else if (pollBody.data?.pages) {
          allPages.push(...pollBody.data.pages)
        }

        // Collect creditsUsed from top-level or nested (last wins — Firecrawl reports cumulative total)
        if (typeof pollBody.creditsUsed === 'number') {
          creditsUsed = pollBody.creditsUsed
        } else if (pollBody.data && !Array.isArray(pollBody.data) && typeof pollBody.data.creditsUsed === 'number') {
          creditsUsed = pollBody.data.creditsUsed
        }

        // Resolve next URL (relative against Firecrawl API base)
        const resolvedNext = pollBody.next
          ? new URL(pollBody.next, 'https://api.firecrawl.dev').href
          : null

        if (pollBody.status === 'failed' || pollBody.status === 'cancelled') {
          return {
            ok: false,
            error: {
              code: 'PROVIDER_ERROR',
              message:
                pollBody.error ??
                `Firecrawl crawl ${pollBody.status}`,
            },
          }
        }

        if (pollBody.status === 'completed' && !resolvedNext) {
          break
        }

        // Nonterminal (in_progress/scraping) or completed with next → continue
        pollUrl = resolvedNext ?? pollUrl
      } catch (err) {
        clearTimeout(pollTimer)
        if (err instanceof DOMException && err.name === 'AbortError') {
          return {
            ok: false,
            error: { code: 'PROVIDER_TIMEOUT', message: 'Crawl poll timed out' },
          }
        }
        return {
          ok: false,
          error: {
            code: 'PROVIDER_ERROR',
            message: err instanceof Error ? err.message : 'Poll failed',
          },
        }
      }
    }

    if (Date.now() >= deadline) {
      return {
        ok: false,
        error: { code: 'PROVIDER_TIMEOUT', message: 'Crawl poll timed out' },
      }
    }

    // ── Normalize pages: extract url/statusCode/title from metadata ──────
    const normalizedPages: NormalizedPage[] = allPages.map((page) => ({
      ...page,
      url: page.url ?? (page.metadata?.sourceURL as string) ?? (page.metadata?.url as string) ?? '',
      statusCode: page.statusCode ?? (page.metadata?.statusCode as number) ?? 0,
      title: page.title ?? (page.metadata?.title as string | undefined),
    }))

    // ── Dedupe ────────────────────────────────────────────────────────────
    const uniqueByCanonical = await dedupeByCanonical(normalizedPages)
    const uniquePages = await dedupeByContentHash(uniqueByCanonical)

    // ── Post-redirect SSRF on each page URL ───────────────────────────────
    for (const page of uniquePages) {
      const pageParsed = parseUrl(page.url)
      if (!pageParsed) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Page ${page.url} has malformed URL`,
          },
        }
      }
      if (
        isLocalhost(pageParsed.hostname) ||
        isPrivateNetwork(pageParsed.hostname)
      ) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Page ${page.url} targets private network`,
          },
        }
      }
      if (!isDomainApproved(pageParsed.hostname, approvedDomains)) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Page ${page.url} targets non-approved domain ${pageParsed.hostname}`,
          },
        }
      }
    }

    // ── Sanitize + collect ────────────────────────────────────────────────
    const maxPages =
      (source.metadata.maxPages as number) ?? this.defaultMaxPages
    const maxTextBytes =
      (source.metadata.maxTextBytes as number) ?? this.defaultMaxTextBytes
    const llmSafeMode = source.metadata.llmSafeMode === true
    const budgetKey = source.id

    if (!this.budgetState.has(budgetKey)) {
      this.budgetState.set(budgetKey, { pages: 0, textBytes: 0 })
    }
    const budget = this.budgetState.get(budgetKey)!

    if (budget.pages + uniquePages.length > maxPages) {
      return {
        ok: false,
        error: {
          code: 'BUDGET_EXCEEDED',
          message: `Page budget ${maxPages} exceeded`,
        },
      }
    }

    const documents: CollectedSource['documents'] = []
    for (const page of uniquePages) {
      const pageUrl = page.url!
      const pageStatus = page.statusCode!
      const pageTitle = page.title


      // Reject pages with empty or missing html
      if (!page.html || page.html.trim() === '') {
        return {
          ok: false,
          error: {
            code: 'FIRECRAWL_HTML_MISSING',
            message: `Page ${pageUrl} returned empty HTML`,
          },
        }
      }

      let text = sanitizeContent(page.markdown ?? '')
      if (llmSafeMode) text = applyLinePrefix(text)

      const textBytes = new TextEncoder().encode(text).byteLength
      if (budget.textBytes + textBytes > maxTextBytes) {
        return {
          ok: false,
          error: {
            code: 'BUDGET_EXCEEDED',
            message: `Text budget ${maxTextBytes} bytes exceeded`,
          },
        }
      }

      budget.textBytes += textBytes
      documents.push({
        url: pageUrl,
        title: pageTitle as string | undefined,
        contentText: text,
        mimeType: 'text/markdown',
        rawContent: page.html,
        rawMimeType: 'text/html',
        httpStatus: pageStatus,
        metadata: page.metadata as Record<string, JsonValue> | undefined,
      })
    }

    budget.pages += uniquePages.length

    return {
      ok: true,
      data: {
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        externalReference: url,
        metadata: {
          creditsUsed,
          pageCount: documents.length,
        },
        documents,
      },
    }
  }
}
