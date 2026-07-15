import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

// ─── Approved-domain confinement ────────────────────────────────────────────

describe("approved-domain confinement", () => {
  beforeEach(initAdapter);

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
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Content", metadata: { title: "Home" } },
        creditsUsed: 1,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/about",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(result.ok).toBe(true);
  });

  it("allows URLs on subdomains of approved domains", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Content", metadata: { title: "Blog" } },
        creditsUsed: 1,
      }),
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://blog.example.com/post",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

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
  beforeEach(initAdapter);

  it("fetches robots.txt before crawling", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nDisallow: /private/\n"),
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

    await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/page",
        metadata: { approvedDomains: ["example.com"] },
      }),
    });

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://example.com/robots.txt",
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      "https://api.firecrawl.dev/v1/scrape",
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
