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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WebsiteSourceAdapterOptions {
  apiKey?: string
  defaultTimeoutMs?: number
  defaultMaxPages?: number
  defaultMaxTextBytes?: number
}

interface FirecrawlPage {
  url: string
  markdown?: string
  statusCode: number
  metadata?: Record<string, unknown>
  title?: string
  description?: string
}

interface FirecrawlResponse {
  success: boolean
  data?: {
    markdown?: string
    metadata?: Record<string, unknown>
    pages?: FirecrawlPage[]
  }
  creditsUsed?: number
  error?: string
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

    // ── Pre-flight redirect check ─────────────────────────────────────────
    const preflight = await fetch(url, { redirect: 'manual' })
    if (preflight.status >= 300 && preflight.status < 400) {
      const location = preflight.headers.get('Location')
      if (location) {
        const redirectParsed = parseUrl(
          location.startsWith('http')
            ? location
            : `${parsed.protocol}//${parsed.hostname}${location}`,
        )
        if (
          redirectParsed &&
          (isLocalhost(redirectParsed.hostname) ||
            isPrivateNetwork(redirectParsed.hostname))
        ) {
          return {
            ok: false,
            error: {
              code: 'SSRF_REDIRECT_BLOCKED',
              message: 'Redirect targets private network',
            },
          }
        }
      }
    }

    // ── Firecrawl API call ────────────────────────────────────────────────
    const timeoutMs =
      (source.metadata.timeoutMs as number) ?? this.defaultTimeoutMs
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown'],
          onlyMainContent: true,
        }),
        signal: controller.signal,
      })
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

    const body: FirecrawlResponse = await response.json()
    if (!body.success) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: body.error ?? 'Firecrawl request failed',
        },
      }
    }

    // ── Build page list ───────────────────────────────────────────────────
    const rawPages: FirecrawlPage[] = body.data?.pages ?? [
      {
        url,
        markdown: body.data?.markdown ?? '',
        statusCode: response.status,
        metadata: body.data?.metadata as Record<string, unknown> | undefined,
      },
    ]

    // ── Dedupe ────────────────────────────────────────────────────────────
    const uniqueByCanonical = await dedupeByCanonical(rawPages)
    const uniquePages = await dedupeByContentHash(uniqueByCanonical)

    // ── Post-redirect SSRF on each page URL ───────────────────────────────
    for (const page of uniquePages) {
      const pageParsed = parseUrl(page.url)
      if (
        pageParsed &&
        (isLocalhost(pageParsed.hostname) ||
          isPrivateNetwork(pageParsed.hostname))
      ) {
        return {
          ok: false,
          error: {
            code: 'SSRF_REDIRECT_BLOCKED',
            message: `Page ${page.url} targets private network`,
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
        url: page.url,
        title: page.title as string | undefined,
        contentText: text,
        mimeType: 'text/markdown',
        httpStatus: page.statusCode,
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
          creditsUsed: body.creditsUsed ?? 0,
          pageCount: documents.length,
        },
        documents,
      },
    }
  }
}
