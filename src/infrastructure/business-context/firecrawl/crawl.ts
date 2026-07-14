import type { ServiceResult, ContextSource } from '@/core/business-context/types'
import type { CollectedSource } from '@/core/business-context/source-adapter.port'
import type { CrawlBudget, FirecrawlResponse } from './metadata'
import type { FirecrawlClient } from './scrape'

// ─── Multi-page crawl ─────────────────────────────────────────────────────

export async function crawlSite(
  client: FirecrawlClient,
  url: string,
  source: ContextSource,
  budget: CrawlBudget,
  pageCount: number,
): Promise<ServiceResult<CollectedSource>> {
  const limit = Math.min(pageCount, budget.maxPages)

  const response = await fetch(`${client.baseUrl}/crawl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${client.apiKey}`,
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
