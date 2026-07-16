import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { FirecrawlWebsiteAdapter } from "@/infrastructure/business-context/firecrawl/firecrawl-adapter";
import type { ContextSource } from "@/core/business-context/types";

// ---------------------------------------------------------------------------
// Integration test: FirecrawlWebsiteAdapter against real Firecrawl API
// Crawls https://novi-health.com/ and validates the actual response shape.
// Skipped if FIRECRAWL_API_KEY is not set.
// ---------------------------------------------------------------------------

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY?.trim();
console.log("FIRECRAWL_KEY at import:", FIRECRAWL_KEY ? `${FIRECRAWL_KEY.slice(0, 10)}...` : "UNDEFINED");
const TARGET_URL = "https://novi-health.com/";

function envOrSkip(): boolean {
  if (!process.env.FIRECRAWL_API_KEY?.trim()) {
    console.log("⊘ Skipping: FIRECRAWL_API_KEY not set");
    return false;
  }
  return true;
}

const itIf = envOrSkip() ? it : it.skip;

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";

function websiteSource(url: string): ContextSource {
  return {
    id: "src-novi",
    workspaceId: WORKSPACE_ID,
    businessId: BUSINESS_ID,
    sourceType: "website",
    sourceName: "Novi Health Website",
    externalReference: url,
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: { maxPages: 5 },
    collectedAt: new Date(),
  };
}

describe("FirecrawlWebsiteAdapter — real novi-health.com", () => {
  itIf(
    "scrapes https://novi-health.com/ and returns markdown content",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource(TARGET_URL),
      });

      console.log("Firecrawl result.ok =", result.ok);
      if (!result.ok) {
        console.log("Error:", JSON.stringify(result.error, null, 2));
      }

      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = (result.data as any).documents?.[0]?.contentText ?? "";
        console.log("Markdown length:", text.length);
        console.log("First 300 chars:", text.slice(0, 300));
        expect(text.length).toBeGreaterThan(100);
      }
    },
    60_000,
  );

  itIf(
    "scraped content includes Novi Health branding text",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource(TARGET_URL),
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = ((result.data as any).documents?.[0]?.contentText ?? "").toLowerCase();
        const hasBranding =
          text.includes("novi") ||
          text.includes("wellness") ||
          text.includes("health");
        console.log("Has Novi/wellness/health mention:", hasBranding);
        expect(hasBranding).toBe(true);
      }
    },
    60_000,
  );

  itIf(
    "rejects localhost URL even with valid API key (SSRF guard)",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource("http://localhost:3000/admin"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SSRF_BLOCKED");
      }
    },
    10_000,
  );

  itIf(
    "rejects 127.0.0.1 (loopback) — defense in depth",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource("http://127.0.0.1/api"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SSRF_BLOCKED");
      }
    },
    10_000,
  );

  itIf(
    "rejects 10.x private network",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource("http://10.0.0.5/internal"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SSRF_BLOCKED");
      }
    },
    10_000,
  );

  itIf(
    "rejects non-HTTP protocols (file://)",
    async () => {
      const adapter = new FirecrawlWebsiteAdapter(FIRECRAWL_KEY);
      const result = await adapter.collect({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        source: websiteSource("file:///etc/passwd"),
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("SSRF_BLOCKED");
      }
    },
    10_000,
  );
});
