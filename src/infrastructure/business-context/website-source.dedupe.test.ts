import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse, enqueueCrawl } from "./website-source.test-helpers";
import { dedupeByContentHash, DedupePage } from "./website-source.dedupe";

// ─── Canonical dedupe ───────────────────────────────────────────────────────

describe("canonical dedupe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates pages with same canonical URL", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/page",
        html: "<p>Content A</p>",
        markdown: "Content A",
        statusCode: 200,
        metadata: { canonical_url: "https://example.com/canonical" },
      },
      {
        url: "https://example.com/page?ref=1",
        html: "<p>Content A</p>",
        markdown: "Content A",
        statusCode: 200,
        metadata: { canonical_url: "https://example.com/canonical" },
      },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      const uniqueUrls = new Set(result.data.documents.map((d) => d.url));
      expect(uniqueUrls.size).toBe(1);
    }
  });
});

// ─── Content dedupe ─────────────────────────────────────────────────────────

describe("content dedupe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates pages with identical content", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/page1",
        html: "<p>Identical content</p>",
        markdown: "Identical content",
        statusCode: 200,
      },
      {
        url: "https://example.com/page2",
        html: "<p>Identical content</p>",
        markdown: "Identical content",
        statusCode: 200,
      },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.documents.length).toBe(1);
    }
  });
});

// ─── Unit: dedupeByContentHash ───────────────────────────────────────────────

describe("dedupeByContentHash unit", () => {
  it("keeps two pages with same markdown but different HTML", async () => {
    const pages: DedupePage[] = [
      { url: "https://a.com", markdown: "hello", html: "<p>hello</p>", statusCode: 200 },
      { url: "https://b.com", markdown: "hello", html: "<div>hello</div>", statusCode: 200 },
    ];
    const result = await dedupeByContentHash(pages);
    expect(result.length).toBe(2);
  });

  it("dedupes pages with identical markdown AND identical HTML", async () => {
    const pages: DedupePage[] = [
      { url: "https://a.com", markdown: "hello", html: "<p>hello</p>", statusCode: 200 },
      { url: "https://b.com", markdown: "hello", html: "<p>hello</p>", statusCode: 200 },
    ];
    const result = await dedupeByContentHash(pages);
    expect(result.length).toBe(1);
  });

  it("dedupes pages with identical markdown when HTML is undefined on both", async () => {
    const pages: DedupePage[] = [
      { url: "https://a.com", markdown: "hello", statusCode: 200 },
      { url: "https://b.com", markdown: "hello", statusCode: 200 },
    ];
    const result = await dedupeByContentHash(pages);
    expect(result.length).toBe(1);
  });
});
