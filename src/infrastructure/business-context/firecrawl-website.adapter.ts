import type { ServiceResult } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource } from '@/core/business-context/types'
import { config } from '@/infrastructure/config'
import { createHash } from 'crypto'
import { URL } from 'url'

// ─── SSRF protection ────────────────────────────────────────────────────────

const PRIVATE_NETWORK_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^localhost$/i,
  /^\[::1\]$/,
  /^\[::ffff:127/,
]

function isPrivateNetwork(hostname: string): boolean {
  return PRIVATE_NETWORK_PATTERNS.some((p) => p.test(hostname))
}

function validateTargetUrl(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Only HTTP(S) URLs allowed'
    }
    if (isPrivateNetwork(parsed.hostname)) {
      return 'Localhost and private networks blocked'
    }
    return null
  } catch {
    return 'Invalid URL format'
  }
}

// ─── Budget types ───────────────────────────────────────────────────────────

export interface CrawlBudget {
  maxPages: number
  maxTextBytes: number
  maxCredits: number
}

export const DEFAULT_CRAWL_BUDGET: CrawlBudget = {
  maxPages: config.businessContext.maxWebsitePages,
  maxTextBytes: config.businessContext.maxNormalizedTextMb * 1024 * 1024,
  maxCredits: config.businessContext.creditCeiling,
}

// ─── Firecrawl response types ───────────────────────────────────────────────

interface FirecrawlPage {
  markdown?: string
  html?: string
  url: string
  title?: string
  description?: string
  statusCode: number
  metadata?: Record<string, unknown>
}

interface FirecrawlResponse {
  success: boolean
  data?: {
    markdown?: string
    html?: string
    metadata?: Record<string, unknown>
    pages?: FirecrawlPage[]
  }
  creditsUsed?: number
  credits_remaining?: number
  requestId?: string
  error?: string
}

// ─── Crawl metadata ─────────────────────────────────────────────────────────

export interface FirecrawlCrawlMetadata {
  providerRequestId: string | null
  creditsUsed: number
  pageCount: number
  parserMode: string
  truncated: boolean
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class FirecrawlWebsiteAdapter implements SourceAdapterPort {
  private apiKey: string
  private baseUrl = 'https://api.firecrawl.dev/v1'

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? config.businessContext.firecrawlApiKey
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
    const url = source.externalReference ?? source.metadata.url as string | undefined

    if (!url) {
      return {
        ok: false,
        error: { code: 'MISSING_URL', message: 'Website source requires a URL' },
      }
    }

    // SSRF check
    const ssrfError = validateTargetUrl(url)
    if (ssrfError) {
      return {
        ok: false,
        error: { code: 'SSRF_BLOCKED', message: ssrfError },
      }
    }

    if (!this.apiKey) {
      return {
        ok: false,
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'Firecrawl API key not configured' },
      }
    }

    const budget: CrawlBudget = {
      maxPages: (source.metadata.maxPages as number) ?? DEFAULT_CRAWL_BUDGET.maxPages,
      maxTextBytes: (source.metadata.maxTextBytes as number) ?? DEFAULT_CRAWL_BUDGET.maxTextBytes,
      maxCredits: (source.metadata.maxCredits as number) ?? DEFAULT_CRAWL_BUDGET.maxCredits,
    }

    // Determine strategy: single page scrape vs multi-page crawl
    const pageCount = (source.metadata.pageCount as number) ?? 1
    if (pageCount <= 1) {
      return this.scrapePage(url, source, budget)
    }
    return this.crawlSite(url, source, budget, pageCount)
  }

  // ─── Single-page scrape ─────────────────────────────────────────────────

  private async scrapePage(
    url: string,
    source: ContextSource,
    budget: CrawlBudget,
  ): Promise<ServiceResult<CollectedSource>> {
    const response = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        limit: 1,
        timeout: 30000,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const text = await response.text()
      return {
        ok: false,
        error: {
          code: 'PROVIDER_5XX',
          message: `Firecrawl scrape failed: ${response.status} ${text.slice(0, 200)}`,
        },
      }
    }

    const body: FirecrawlResponse = await response.json()

    if (!body.success || !body.data) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: body.error ?? 'Firecrawl scrape returned no data',
        },
      }
    }

    const creditsUsed = body.creditsUsed ?? 0
    if (creditsUsed > budget.maxCredits) {
      return {
        ok: false,
        error: {
          code: 'BUDGET_EXCEEDED',
          message: `Credits used ${creditsUsed} exceeds budget ${budget.maxCredits}`,
        },
      }
    }

    const markdown = body.data.markdown ?? ''
    const truncated = markdown.length > budget.maxTextBytes

    const content = truncated ? markdown.slice(0, budget.maxTextBytes) : markdown

    return {
      ok: true,
      data: {
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        externalReference: url,
        metadata: {
          providerRequestId: body.requestId ?? null,
          creditsUsed,
          pageCount: 1,
          parserMode: 'markdown',
          truncated,
        },
        documents: [
          {
            url,
            title: (body.data.metadata?.title as string) ?? undefined,
            contentText: content,
            mimeType: 'text/markdown',
            httpStatus: 200,
            metadata: (body.data.metadata ?? {}) as Record<string, string>,
          },
        ],
      },
    }
  }

  // ─── Multi-page crawl ───────────────────────────────────────────────────

  private async crawlSite(
    url: string,
    source: ContextSource,
    budget: CrawlBudget,
    pageCount: number,
  ): Promise<ServiceResult<CollectedSource>> {
    const limit = Math.min(pageCount, budget.maxPages)

    const response = await fetch(`${this.baseUrl}/crawl`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url,
        limit,
        scrapeOptions: {
          formats: ['markdown'],
        },
        pollInterval: 5000,
        timeout: 300000,
      }),
      signal: AbortSignal.timeout(360000),
    })

    if (!response.ok) {
      const text = await response.text()
      return {
        ok: false,
        error: {
          code: 'PROVIDER_5XX',
          message: `Firecrawl crawl failed: ${response.status} ${text.slice(0, 200)}`,
        },
      }
    }

    const body: FirecrawlResponse = await response.json()

    if (!body.success) {
      return {
        ok: false,
        error: {
          code: 'PROVIDER_ERROR',
          message: body.error ?? 'Firecrawl crawl failed',
        },
      }
    }

    const creditsUsed = body.creditsUsed ?? 0
    if (creditsUsed > budget.maxCredits) {
      return {
        ok: false,
        error: {
          code: 'BUDGET_EXCEEDED',
          message: `Credits used ${creditsUsed} exceeds budget ${budget.maxCredits}`,
        },
      }
    }

    const pages = body.data?.pages ?? []
    let totalTextBytes = 0
    let truncated = false
    const documents: CollectedSource['documents'] = []

    for (const page of pages) {
      const markdown = page.markdown ?? ''
      totalTextBytes += Buffer.byteLength(markdown, 'utf-8')

      if (totalTextBytes > budget.maxTextBytes) {
        truncated = true
        break
      }

      documents.push({
        url: page.url,
        title: page.title,
        contentText: markdown,
        mimeType: 'text/markdown',
        httpStatus: page.statusCode,
        metadata: {
          description: page.description,
          ...page.metadata,
        } as Record<string, string>,
      })
    }

    return {
      ok: true,
      data: {
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        externalReference: url,
        metadata: {
          providerRequestId: body.requestId ?? null,
          creditsUsed,
          pageCount: documents.length,
          parserMode: 'markdown',
          truncated,
        },
        documents,
      },
    }
  }
}
