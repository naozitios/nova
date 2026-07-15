import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

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

// ─── Post-redirect private-network rejection ────────────────────────────────

describe("post-redirect private-network rejection", () => {
  beforeEach(initAdapter);

  it("rejects when redirect lands on private network IP", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 302),
    );

    const responseWithRedirect = new Response(null, {
      status: 302,
      headers: { Location: "http://10.0.0.1/internal" },
    });
    fetchSpy.mockResolvedValueOnce(responseWithRedirect);

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
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 302),
    );

    const chainResponse = new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/loopback" },
    });
    fetchSpy.mockResolvedValueOnce(chainResponse);

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
