import { describe, expect, it, beforeEach, vi } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, enqueueCrawl } from "./website-source.test-helpers";

// ─── Page budget ────────────────────────────────────────────────────────────

describe("page budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  it("rejects crawl when page count exceeds 30 pages per site", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    const pages = Array.from({ length: 31 }, (_, i) => ({
      url: `https://example.com/page/${i}`,
      markdown: `Page ${i}`,
      html: `<p>Page ${i}</p>`,
      statusCode: 200,
    }));

    enqueueCrawl(fetchSpy, pages);

    const collectPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com",
        metadata: { approvedDomains: ["example.com"], maxPages: 30 },
      }),
    });

    await vi.advanceTimersByTimeAsync(6000);
    const result = await collectPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });

  it("tracks cumulative page count across multiple collects", async () => {
    const page = (i: number) => ({
      url: `https://example.com/page/${i}`,
      markdown: `Content ${i}`,
      html: `<p>Content ${i}</p>`,
      statusCode: 200,
    });

    // Collect 1: robots + preflight + crawl start + crawl poll
    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    enqueueCrawl(fetchSpy, [page(0)]);

    // Collect 2: robots + preflight + crawl start + crawl poll
    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    enqueueCrawl(fetchSpy, [page(1)]);

    // Collect 3: robots + preflight + crawl start + crawl poll (should exceed)
    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    enqueueCrawl(fetchSpy, [page(2)]);

    const source = makeSource({
      externalReference: "https://example.com",
      metadata: { approvedDomains: ["example.com"], maxPages: 2 },
    });

    const p1 = adapter.collect({ workspaceId: "ws-1", businessId: "biz-1", source });
    await vi.advanceTimersByTimeAsync(6000);
    await p1;

    const p2 = adapter.collect({ workspaceId: "ws-1", businessId: "biz-1", source });
    await vi.advanceTimersByTimeAsync(6000);
    await p2;

    const p3 = adapter.collect({ workspaceId: "ws-1", businessId: "biz-1", source });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await p3;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });
});

// ─── Text budget ────────────────────────────────────────────────────────────

describe("text budget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initAdapter();
  });

  it("rejects when text content exceeds 5 MB limit", async () => {
    const largeContent = "x".repeat(5 * 1024 * 1024 + 1);

    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/huge-page",
        markdown: largeContent,
        html: "<p>large</p>",
        statusCode: 200,
      },
    ]);

    const collectPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/huge-page",
        metadata: { approvedDomains: ["example.com"], maxTextBytes: 5 * 1024 * 1024 },
      }),
    });

    await vi.advanceTimersByTimeAsync(6000);
    const result = await collectPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("BUDGET_EXCEEDED");
    }
  });

  it("truncates content approaching text budget", async () => {
    const content = "x".repeat(4 * 1024 * 1024);

    fetchSpy.mockResolvedValueOnce(
      new Response("User-agent: *\nAllow: /\n", { status: 200 }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );

    enqueueCrawl(fetchSpy, [
      {
        url: "https://example.com/large",
        markdown: content,
        html: "<p>large</p>",
        statusCode: 200,
      },
    ]);

    const collectPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/large",
        metadata: { approvedDomains: ["example.com"], maxTextBytes: 5 * 1024 * 1024 },
      }),
    });

    await vi.advanceTimersByTimeAsync(6000);
    const result = await collectPromise;

    expect(result.ok).toBe(true);
  });
});
