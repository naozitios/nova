import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

// ─── Page budget ────────────────────────────────────────────────────────────

describe("page budget", () => {
  beforeEach(initAdapter);

  it("rejects crawl when page count exceeds 30 pages per site", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: {
          pages: Array.from({ length: 31 }, (_, i) => ({
            url: `https://example.com/page/${i}`,
            markdown: `Page ${i}`,
            statusCode: 200,
          })),
        },
        creditsUsed: 31,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"], maxPages: 30 },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });

  it("tracks cumulative page count across multiple collects", async () => {
    // First collect: robots.txt + preflight + Firecrawl
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Content" },
        creditsUsed: 1,
      }),
    );

    // Second collect: robots.txt + preflight + Firecrawl
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Content" },
        creditsUsed: 1,
      }),
    );

    // Third collect: robots.txt + preflight + Firecrawl (should exceed budget)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Content" },
        creditsUsed: 1,
      }),
    );

    const source = makeSource({
      externalReference: "https://example.com",
      metadata: { approvedDomains: ["example.com"], maxPages: 2 },
    });

    await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source,
    });

    await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source,
    });

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });
});

// ─── Text budget ────────────────────────────────────────────────────────────

describe("text budget", () => {
  beforeEach(initAdapter);

  it("rejects when text content exceeds 5 MB limit", async () => {
    const largeContent = "x".repeat(5 * 1024 * 1024 + 1);

    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: largeContent },
        creditsUsed: 1,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/huge-page",
        metadata: { approvedDomains: ["example.com"], maxTextBytes: 5 * 1024 * 1024 },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });

  it("truncates content approaching text budget", async () => {
    const content = "x".repeat(4 * 1024 * 1024);

    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: content },
        creditsUsed: 1,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/large",
        metadata: { approvedDomains: ["example.com"], maxTextBytes: 5 * 1024 * 1024 },
      }),
    });

    expect(result.ok).toBe(true);
  });
});
