import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

// ─── Canonical dedupe ───────────────────────────────────────────────────────

describe("canonical dedupe", () => {
  beforeEach(initAdapter);

  it("deduplicates pages with same canonical URL", async () => {
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
          pages: [
            {
              url: "https://example.com/page",
              markdown: "Content A",
              statusCode: 200,
              metadata: { canonical_url: "https://example.com/canonical" },
            },
            {
              url: "https://example.com/page?ref=1",
              markdown: "Content A",
              statusCode: 200,
              metadata: { canonical_url: "https://example.com/canonical" },
            },
          ],
        },
        creditsUsed: 2,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const uniqueUrls = new Set(result.data.documents.map((d) => d.url));
      expect(uniqueUrls.size).toBe(1);
    }
  });
});

// ─── Content dedupe ─────────────────────────────────────────────────────────

describe("content dedupe", () => {
  beforeEach(initAdapter);

  it("deduplicates pages with identical content", async () => {
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
          pages: [
            {
              url: "https://example.com/page1",
              markdown: "Identical content",
              statusCode: 200,
            },
            {
              url: "https://example.com/page2",
              markdown: "Identical content",
              statusCode: 200,
            },
          ],
        },
        creditsUsed: 2,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.documents.length).toBe(1);
    }
  });
});
