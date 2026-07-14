import type { ServiceResult } from '@/core/business-context/types'
import type {
  CollectedSource,
  SourceAdapterPort,
} from '@/core/business-context/source-adapter.port'
import type { ContextSource } from '@/core/business-context/types'
import { config } from '@/infrastructure/config'
import { URL } from 'url'
import { scrapePage, type FirecrawlClient } from './scrape'
import { crawlSite } from './crawl'
import { CrawlBudget, DEFAULT_CRAWL_BUDGET } from './metadata'

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

// ─── Adapter ────────────────────────────────────────────────────────────────

export class FirecrawlWebsiteAdapter implements SourceAdapterPort {
  private readonly client: FirecrawlClient

  constructor(apiKey?: string) {
    this.client = {
      baseUrl: 'https://api.firecrawl.dev/v1',
      apiKey: apiKey ?? config.businessContext.firecrawlApiKey,
    }
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

    const ssrfError = validateTargetUrl(url)
    if (ssrfError) {
      return {
        ok: false,
        error: { code: 'SSRF_BLOCKED', message: ssrfError },
      }
    }

    if (!this.client.apiKey) {
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

    const pageCount = (source.metadata.pageCount as number) ?? 1
    if (pageCount <= 1) {
      return scrapePage(this.client, url, source, budget)
    }
    return crawlSite(this.client, url, source, budget, pageCount)
  }
}
