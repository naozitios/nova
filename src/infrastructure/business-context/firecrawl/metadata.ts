import { config } from '@/infrastructure/config'

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

export interface FirecrawlPage {
  markdown?: string
  html?: string
  url: string
  title?: string
  description?: string
  statusCode: number
  metadata?: Record<string, unknown>
}

export interface FirecrawlResponse {
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
