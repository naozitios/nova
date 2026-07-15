import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

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
    // 4. Firecrawl API call → success
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Redirected content" },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("allows redirect to subdomain of approved domain", async () => {
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
    // 4. Firecrawl API call → success
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Subdomain content" },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(4);
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
    // 5. Firecrawl API call
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Final content" },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(true);
    // robots + 3 preflights + Firecrawl = 5
    expect(fetchSpy).toHaveBeenCalledTimes(5);
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
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3. Firecrawl → page with malformed url
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: {
          pages: [
            {
              url: "not-a-valid-url",
              markdown: "Some content",
              statusCode: 200,
            },
          ],
        },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("malformed");
    }
    // robots + preflight + Firecrawl = 3
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("rejects when Firecrawl returns page with javascript: URL", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3. Firecrawl → page with javascript: url
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: {
          pages: [
            {
              url: "javascript:alert(1)",
              markdown: "Payload",
              statusCode: 200,
            },
          ],
        },
        creditsUsed: 1,
      })
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
    // robots + preflight + Firecrawl = 3
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("rejects when Firecrawl returns page with private network URL", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3. Firecrawl → page with private network URL
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: {
          pages: [
            {
              url: "http://10.0.0.1/admin",
              markdown: "Internal content",
              statusCode: 200,
            },
          ],
        },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
      expect(result.error.message).toContain("private network");
    }
    // robots + preflight + Firecrawl = 3
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("rejects when Firecrawl returns page with non-approved domain URL", async () => {
    // 1. robots.txt
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    // 2. preflight → 200 (no redirect)
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    // 3. Firecrawl → page with non-approved domain URL
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: {
          pages: [
            {
              url: "https://evil.com/phish",
              markdown: "Malicious content",
              statusCode: 200,
            },
          ],
        },
        creditsUsed: 1,
      })
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
    // robots + preflight + Firecrawl = 3
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

// ─── Full redirect-chain preflight verification ─────────────────────────────

describe("full redirect-chain preflight", () => {
  beforeEach(initAdapter);

  it("validates every hop in chain before Firecrawl", async () => {
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
    // 5. Firecrawl API call
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Final content" },
        creditsUsed: 1,
      })
    );

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    expect(result.ok).toBe(true);
    // robots + 3 preflights + Firecrawl = 5
    expect(fetchSpy).toHaveBeenCalledTimes(5);
    // Verify fetch was called with redirect: 'manual' for preflights
    expect(fetchSpy.mock.calls[1][1]).toEqual({ redirect: "manual" });
    expect(fetchSpy.mock.calls[2][1]).toEqual({ redirect: "manual" });
    expect(fetchSpy.mock.calls[3][1]).toEqual({ redirect: "manual" });
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
