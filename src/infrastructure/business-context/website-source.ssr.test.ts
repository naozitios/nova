import { describe, expect, it, beforeEach, vi } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse, enqueueCrawl } from "./website-source.test-helpers";

function redirectResponse(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location },
  });
}

// ─── Pre-redirect private-network rejection ─────────────────────────────────

describe("pre-redirect private-network rejection", () => {
  beforeEach(initAdapter);

  it("rejects URL pointing to 10.x before following redirects", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "http://10.0.0.1/admin" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects URL pointing to 172.16.x before following redirects", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "http://172.16.0.1/internal" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects URL pointing to 192.168.x before following redirects", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "http://192.168.1.1/router" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects URL pointing to 169.254.x (link-local) before following redirects", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "http://169.254.169.254/metadata" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects localhost URLs before following redirects", async () => {
    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "http://localhost:3000/secret" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ─── Post-redirect domain confinement ────────────────────────────────────────

describe("post-redirect domain confinement", () => {
  beforeEach(initAdapter);

  it("rejects when redirect lands on non-approved domain", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 to non-approved domain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://evil.com/phish")
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("non-approved domain");
    }
  });

  it("allows redirect to same approved domain", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 to same approved domain (validates OK)
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://example.com/new-page")
    );
    // 3. 2nd preflight on redirect target → 200 (loop ends)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 4-5. Firecrawl start + poll → success
    enqueueCrawl(fetchSpy, [
      { url: "https://example.com/new-page", markdown: "Redirected content", html: "<p>Redirected content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    // robots + 2 preflights + Firecrawl start + poll = 5
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });

  it("allows redirect to subdomain of approved domain", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 to approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://blog.example.com/post")
    );
    // 3. 2nd preflight on redirect target → 200 (loop ends)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 4-5. Firecrawl start + poll → success
    enqueueCrawl(fetchSpy, [
      { url: "https://blog.example.com/post", markdown: "Subdomain content", html: "<p>Subdomain content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    // robots + 2 preflights + Firecrawl start + poll = 5
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
  });
});

// ─── Post-redirect private-network rejection ────────────────────────────────

describe("post-redirect private-network rejection", () => {
  beforeEach(initAdapter);

  it("rejects when redirect lands on private network IP", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 to private IP
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("http://10.0.0.1/internal")
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
    }
  });

  it("rejects when redirect chain lands on localhost", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 to localhost
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("http://127.0.0.1/loopback")
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
    }
  });
});

// ─── Redirect chain validation (multi-hop) ──────────────────────────────────

describe("redirect chain validation", () => {
  beforeEach(initAdapter);

  it("follows and validates two-hop redirect chain to approved domain", async () => {
    vi.useFakeTimers();
    // 1. robots.txt for initial domain
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight hop 1 → 302 to approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://blog.example.com/intermediate")
    );
    // 3. preflight hop 2 → 302 to another approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://docs.example.com/final")
    );
    // 4. preflight on final target → 200 (loop ends)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 5-6. Firecrawl start + poll
    enqueueCrawl(fetchSpy, [
      { url: "https://docs.example.com/final", markdown: "Final content", html: "<p>Final content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    // robots + 3 preflights + Firecrawl start + poll = 6
    expect(fetchSpy).toHaveBeenCalledTimes(6);
    vi.useRealTimers();
  });

  it("rejects second hop when it lands on non-approved domain", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight hop 1 → 302 to approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://blog.example.com/intermediate")
    );
    // 3. preflight hop 2 → 302 to non-approved domain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://evil.com/steal")
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("non-approved domain");
    }
    // robots + 2 preflights = 3 (no Firecrawl)
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("rejects when any hop in chain targets private network", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight hop 1 → 302 to approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://blog.example.com/intermediate")
    );
    // 3. preflight hop 2 → 302 to private network
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("http://10.0.0.1/admin")
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("rejects after max redirect hops exceeded", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2-6. five preflight hops (all to approved domain, hitting max)
    for (let i = 0; i < 5; i++) {
      fetchSpy.mockResolvedValueOnce(
        redirectResponse(`https://example.com/hop-${i}`)
      );
    }

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_CHAIN_EXCEEDED");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });
});

// ─── 3xx missing/invalid Location rejection ─────────────────────────────────

describe("3xx missing or invalid Location", () => {
  beforeEach(initAdapter);

  it("rejects 302 with missing Location header", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 302 with no Location header
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 302)
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("missing or invalid");
    }
    // Only robots + preflight, no Firecrawl
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects 301 with empty Location header", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 301 with empty Location
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 301, headers: { Location: "" } })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("missing or invalid");
    }
    // Only robots + preflight, no Firecrawl
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects 307 with unparseable Location", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 307 with garbage Location
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 307, headers: { Location: "not-a-url" } })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("missing or invalid");
    }
    // Only robots + preflight, no Firecrawl
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("rejects 301 with whitespace-only Location", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 301 with whitespace-only Location
    fetchSpy.mockResolvedValueOnce(
      new Response(null, { status: 301, headers: { Location: "   " } })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("missing or invalid");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ─── Malformed Firecrawl page.url rejection ─────────────────────────────────

describe("malformed Firecrawl page URL", () => {
  beforeEach(initAdapter);

  it("rejects when Firecrawl returns page with unparseable URL", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3-4. Firecrawl start + poll → page with malformed url
    enqueueCrawl(fetchSpy, [
      { url: "not-a-valid-url", markdown: "Some content", html: "<p>Some content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("malformed");
    }
    // robots + preflight + Firecrawl start + poll = 4
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("rejects when Firecrawl returns page with javascript: URL", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3-4. Firecrawl start + poll → page with javascript: url
    enqueueCrawl(fetchSpy, [
      { url: "javascript:alert(1)", markdown: "Payload", html: "<p>Payload</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("non-approved domain");
    }
    // robots + preflight + Firecrawl start + poll = 4
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("rejects when Firecrawl returns page with private network URL", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3-4. Firecrawl start + poll → page with private network URL
    enqueueCrawl(fetchSpy, [
      { url: "http://10.0.0.1/admin", markdown: "Internal content", html: "<p>Internal content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("private network");
    }
    // robots + preflight + Firecrawl start + poll = 4
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });

  it("rejects when Firecrawl returns page with non-approved domain URL", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3-4. Firecrawl start + poll → page with non-approved domain URL
    enqueueCrawl(fetchSpy, [
      { url: "https://evil.com/phish", markdown: "Malicious content", html: "<p>Malicious content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("non-approved domain");
    }
    // robots + preflight + Firecrawl start + poll = 4
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});

// ─── Full redirect-chain preflight verification ─────────────────────────────

describe("full redirect-chain preflight", () => {
  beforeEach(initAdapter);

  it("validates every hop in chain before Firecrawl", async () => {
    vi.useFakeTimers();
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight hop 1 → 302 to approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://blog.example.com/intermediate")
    );
    // 3. preflight hop 2 → 302 to another approved subdomain
    fetchSpy.mockResolvedValueOnce(
      redirectResponse("https://docs.example.com/final")
    );
    // 4. preflight on final target → 200 (loop ends)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 5-6. Firecrawl start + poll
    enqueueCrawl(fetchSpy, [
      { url: "https://docs.example.com/final", markdown: "Final content", html: "<p>Final content</p>", statusCode: 200 },
    ]);

    const resultPromise = adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });
    await vi.advanceTimersByTimeAsync(6000);
    const result = await resultPromise;

    expect(result.ok).toBe(true);
    // robots + 3 preflights + Firecrawl start + poll = 6
    expect(fetchSpy).toHaveBeenCalledTimes(6);
    // Verify fetch was called with redirect: 'manual' for preflights
    expect(fetchSpy.mock.calls[1][1]).toEqual({ redirect: "manual" });
    expect(fetchSpy.mock.calls[2][1]).toEqual({ redirect: "manual" });
    expect(fetchSpy.mock.calls[3][1]).toEqual({ redirect: "manual" });
    vi.useRealTimers();
  });

  it("fails closed on 6th hop even if all previous approved", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2-6. five preflight hops (all to approved domain, hitting max)
    for (let i = 0; i < 5; i++) {
      fetchSpy.mockResolvedValueOnce(
        redirectResponse(`https://example.com/hop-${i}`)
      );
    }

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_CHAIN_EXCEEDED");
      expect(result.error.message).toContain("5 hops");
    }
    // No Firecrawl should be called
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });
});
