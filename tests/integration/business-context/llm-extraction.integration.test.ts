import { describe, expect, it } from "vitest";
import { LlmExtractionAdapter } from "@/infrastructure/business-context/llm-extraction.adapter";
import { OpenRouterExtractionClient } from "@/infrastructure/business-context/openrouter-extraction.client";

// ---------------------------------------------------------------------------
// Integration test: LLM extraction against real OpenRouter API
// Uses the real Firecrawl-scraped content from novi-health.com to extract
// structured business facts. Validates the LLM produces schema-conformant
// output that the adapter can parse.
// Skipped if OPENROUTER_API_KEY is not set.
// ---------------------------------------------------------------------------

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim();
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const itIf = OPENROUTER_KEY ? it : it.skip;

const EXTRACTION_SCHEMA = {
  type: "object" as const,
  properties: {
    facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          factKey: { type: "string" },
          value: {},
          confidence: { type: "number", minimum: 0, maximum: 1 },
          sourceExcerpt: { type: ["string", "null"] },
          evidenceLocator: { type: ["object", "null"] },
        },
        required: ["factKey", "value", "confidence"],
      },
    },
    conflicts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          factKey: { type: "string" },
          values: { type: "array" },
        },
        required: ["factKey", "values"],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["facts", "conflicts", "warnings"],
};

const EXTRACTION_SYSTEM_PROMPT = `Extract structured business context facts from the provided content.
Return JSON matching this schema:
{"facts":[{"factKey":"dot.separated.key","value":<any>,"confidence":<0-1>,"sourceExcerpt":"<text or null>","evidenceLocator":{}|null}],"conflicts":[{"factKey":"...","values":[<different>]}],"warnings":["issues"]}
Fact keys: business.name, offers.primary, customers.target_segment, brand.tone, economics.ltv, etc.
Only extract facts with confidence >= 0.5.`;

const SAMPLE_CONTENT = `
Novi Health is a wellness platform that helps employers offer holistic health benefits to their teams.
We provide services like nutrition coaching, mental wellness sessions, and fitness programs.

Our target customers are mid-market employers in the United States, typically 100-1000 employees,
who want to differentiate their benefits package to attract and retain talent.

Our primary offer is a subscription-based wellness program priced at $25 per employee per month.
We compete with OneMedical and Ginger.

Our brand tone is warm, evidence-based, and clinically credible. We avoid jargon and focus on
practical guidance employees can use immediately.

We are HIPAA compliant and work with licensed dietitians, therapists, and personal trainers.
`;

describe("LlmExtractionAdapter — real OpenRouter extraction", () => {
  itIf(
    "extracts business facts from sample content",
    async () => {
      const adapter = new LlmExtractionAdapter(new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL));
      const result = await adapter.extractFacts({
        workspaceId: "ws-1",
        businessId: "biz-1",
        sourceId: "src-1",
        sourceDocumentId: "doc-1",
        contentText: SAMPLE_CONTENT,
        sourceType: "website",
        parserName: "llm",
      });

      console.log("Extract result.ok =", result.ok);
      if (!result.ok) console.log("Error:", result.error);
      if (result.ok) {
        console.log("Facts extracted:", result.data.facts.length);
        console.log("Sample fact:", JSON.stringify(result.data.facts[0], null, 2));
        console.log("Conflicts:", result.data.conflicts.length);
        console.log("Warnings:", result.data.warnings);
      }

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.facts.length).toBeGreaterThan(0);
        const factKeys = result.data.facts.map((f) => f.factKey);
        console.log("Fact keys:", factKeys);
        expect(factKeys.length).toBeGreaterThan(0);
      }
    },
    120_000,
  );

  itIf(
    "extracted facts have valid confidence scores (0-1)",
    async () => {
      const adapter = new LlmExtractionAdapter(new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL));
      const result = await adapter.extractFacts({
        workspaceId: "ws-1",
        businessId: "biz-1",
        sourceId: "src-1",
        sourceDocumentId: "doc-1",
        contentText: SAMPLE_CONTENT,
        sourceType: "website",
        parserName: "llm",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const fact of result.data.facts) {
          expect(fact.confidence).toBeGreaterThanOrEqual(0);
          expect(fact.confidence).toBeLessThanOrEqual(1);
          expect(typeof fact.factKey).toBe("string");
        }
      }
    },
    120_000,
  );

  itIf(
    "handles empty content gracefully without crashing",
    async () => {
      const adapter = new LlmExtractionAdapter(new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL));
      const result = await adapter.extractFacts({
        workspaceId: "ws-1",
        businessId: "biz-1",
        sourceId: "src-1",
        sourceDocumentId: "doc-1",
        contentText: "",
        sourceType: "website",
        parserName: "llm",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.data.facts)).toBe(true);
      }
    },
    120_000,
  );

  itIf(
    "OpenRouter API is reachable and returns valid JSON",
    async () => {
      const client = new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL);
      await expect(
        client.complete({
          schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
          systemPrompt: "Return JSON with an ok field set to true.",
          content: "ping",
          maxTokens: 50,
        }),
      ).resolves.toEqual({ ok: true });
    },
    30_000,
  );
});
