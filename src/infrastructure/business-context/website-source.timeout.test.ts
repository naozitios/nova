import { describe, expect, it, beforeEach } from "vitest";
import { adapter, fetchSpy, initAdapter, makeSource, makeFetchResponse } from "./website-source.test-helpers";

// ─── Timeouts ───────────────────────────────────────────────────────────────

describe("timeouts", () => {
  beforeEach(initAdapter);

  it("enforces configurable request timeout", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockRejectedValueOnce(new DOMException("Timeout", "AbortError"));

    const result = await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({
        externalReference: "https://example.com/slow-page",
        metadata: { approvedDomains: ["example.com"], timeoutMs: 5000 },
      }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROVIDER_TIMEOUT");
    }
  });

  it("applies default timeout when none specified", async () => {
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse("User-agent: *\nAllow: /\n")
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse(null, 200)
    );
    fetchSpy.mockResolvedValueOnce(
      makeFetchResponse({
        success: true,
        data: { markdown: "Fast content" },
        creditsUsed: 1,
      }),
    );

    await adapter.collect({
      workspaceId: "ws-1",
      businessId: "biz-1",
      source: makeSource({ externalReference: "https://example.com" }),
    });

    const fetchCall = fetchSpy.mock.calls[2];
    expect(fetchCall[1].signal).toBeInstanceOf(AbortSignal);
  });
});
