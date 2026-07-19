import { vi } from "vitest";
import { WebsiteSourceAdapter } from "./website-source.adapter";
import type { ContextSource } from "@/core/business-context/types";

// ─── Shared fixtures ────────────────────────────────────────────────────────

export function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
  const { metadata: metaOverrides, ...rest } = overrides;
  return {
    id: "src-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Acme Site",
    externalReference: "https://example.com",
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: { approvedDomains: ["example.com"], ...metaOverrides },
    collectedAt: new Date(),
    ...rest,
  };
}

export function makeFetchResponse(body: unknown, status = 200): Response {
  if (typeof body === "string") {
    return new Response(body, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Firecrawl v2 crawl helpers ─────────────────────────────────────────────

/** Firecrawl v2 crawl page (matches adapter's internal FirecrawlPage). */
export interface CrawlPage {
  url?: string
  markdown?: string
  html?: string
  statusCode?: number
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

/** Overrides for the start or poll response. */
export interface CrawlOverrides {
  /** Override start response fields (success, id/jobId, error). */
  start?: { success?: boolean; id?: string; jobId?: string; error?: string }
  /** Override terminal poll response fields. */
  poll?: {
    status?: "in_progress" | "scraping" | "completed" | "failed" | "cancelled"
    data?: CrawlPage[] | { pages?: CrawlPage[]; creditsUsed?: number }
    creditsUsed?: number
    next?: string
    error?: string
  }
}

/**
 * Appends a documented Firecrawl v2 start + terminal poll to the fetch mock
 * sequence.  Pages are caller-supplied; no hidden mutation.
 *
 * - First fetch mock → POST `https://api.firecrawl.dev/v2/crawl` (start)
 * - Second fetch mock → GET  `…/v2/crawl/{jobId}` (terminal poll)
 *
 * Default start: `{ success: true, id: "crawl-job-1" }`
 * Default poll:  `{ success: true, status: "completed", data: pages }`
 *
 * @param fetchMock  The vi.fn() spy (typically `fetchSpy`)
 * @param pages      Pages to return in the terminal poll response
 * @param overrides  Optional partial overrides for start/poll responses
 */
export function enqueueCrawl(
  fetchMock: ReturnType<typeof vi.fn>,
  pages: CrawlPage[],
  overrides?: CrawlOverrides,
) {
  const jobId = overrides?.start?.jobId ?? overrides?.start?.id ?? "crawl-job-1"

  fetchMock.mockResolvedValueOnce(
    makeFetchResponse({ success: true, id: jobId, ...overrides?.start }),
  )

  fetchMock.mockResolvedValueOnce(
    makeFetchResponse({
      success: true,
      status: "completed" as const,
      data: pages,
      ...overrides?.poll,
    }),
  )
}

// ─── Shared mutable state (call beforeEach in your describe) ────────────────

export let adapter: WebsiteSourceAdapter;
export let fetchSpy: ReturnType<typeof vi.fn>;

export function initAdapter() {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  adapter = new WebsiteSourceAdapter({ apiKey: "test-key" });
}
