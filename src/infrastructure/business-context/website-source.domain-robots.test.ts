import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse, enqueueCrawl } from "./website-source.test-helpers";

// ─── Approved-domain confinement ────────────────────────────────────────────

describe("approved-domain confinement", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects URLs not in the approved domain list", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://evil.com/phish",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOMAIN_NOT_APPROVED");
    }
  });

  it("allows URLs matching exact approved domain", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/about",
        statusCode: 200,
        markdown: "Content",
        html: "<p>Content</p>",
      },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/about",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
  });

  it("allows URLs on subdomains of approved domains", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    enqueueCrawl(fetchSpy, [
      {
        url: "https://blog.example.com/post",
        statusCode: 200,
        markdown: "Content",
        html: "<p>Content</p>",
      },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://blog.example.com/post",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
  });

  it("rejects when approved domain list is empty", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: [] },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DOMAIN_NOT_APPROVED");
    }
  });
});

// ─── Robots respect ─────────────────────────────────────────────────────────

describe("robots respect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches robots.txt before crawling", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nDisallow: /private/\n"),
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/page",
        statusCode: 200,
        markdown: "Content",
        html: "<p>Content</p>",
      },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/page",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://example.com/robots.txt",
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "https://api.firecrawl.dev/v2/crawl",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("https://api.firecrawl.dev/v2/crawl/"),
      expect.anything(),
    );
  });

  it("rejects URLs disallowed by robots.txt", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nDisallow: /admin/\n"),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/admin/secret",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ROBOTS_DISALLOWED");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://example.com/robots.txt",
    );
  });
});
