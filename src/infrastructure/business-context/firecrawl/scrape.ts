import type { ServiceResult, ContextSource } from '@/core/business-context/types'
import type { CollectedSource } from '@/core/business-context/source-adapter.port'
import type { CrawlBudget, FirecrawlResponse } from './metadata'

export interface FirecrawlClient {
  baseUrl: string
  apiKey: string
}

// ─── Single-page scrape ───────────────────────────────────────────────────

export async function scrapePage(
  client: FirecrawlClient,
  url: string,
  source: ContextSource,
  budget: CrawlBudget,
): Promise<ServiceResult<CollectedSource>> {
  const response = await fetch(`${client.baseUrl}/scrape`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${client.apiKey}`,
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
