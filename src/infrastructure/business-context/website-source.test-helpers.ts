import { vi } from "vitest";
import { WebsiteSourceAdapter } from "./website-source.adapter";
import type { ContextSource } from "@/core/business-context/types";

// ─── Shared fixtures ────────────────────────────────────────────────────────

export function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
  const { metadata: metaOverrides, ...rest } = overrides;
  return {
    id: "src-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Acme Site",
    externalReference: "https://example.com",
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: { approvedDomains: ["example.com"], ...metaOverrides },
    collectedAt: new Date(),
    ...rest,
  };
}

export function makeFetchResponse(body: unknown, status = 200): Response {
  if (typeof body === "string") {
    return new Response(body, { status });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Shared mutable state (call beforeEach in your describe) ────────────────

export let adapter: WebsiteSourceAdapter;
export let fetchSpy: ReturnType<typeof vi.fn>;

export function initAdapter() {
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  adapter = new WebsiteSourceAdapter({ apiKey: "test-key" });
}
