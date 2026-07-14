import { describe, expect, it } from "vitest";
import { LlmExtractionAdapter, type LlmClient } from "@/infrastructure/business-context/llm-extraction.adapter";

function validOutput() {
  return {
    facts: [
      {
        factKey: "business.name",
        value: "Acme",
        confidence: 0.9,
        sourceExcerpt: "Acme Corp",
        evidenceLocator: null,
      },
    ],
    conflicts: [],
    warnings: [],
  };
}

describe("LlmExtractionAdapter.extractFacts", () => {
  it("returns facts from a valid LLM response", async () => {
    const calls: number[] = [];
    const client: LlmClient = {
      complete: async () => {
        calls.push(1);
        return validOutput();
      },
    };
    const adapter = new LlmExtractionAdapter(client);
    const r = await adapter.extractFacts({
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceId: "src-1",
      sourceDocumentId: "doc-1",
      contentText: "Acme Corp",
      sourceType: "website",
      parserName: "firecrawl",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.facts[0].factKey).toBe("business.name");
      expect(r.data.facts[0].value).toBe("Acme");
    }
    expect(calls).toHaveLength(1);
  });

  it("attempts one repair on invalid shape", async () => {
    let i = 0;
    const client: LlmClient = {
      complete: async () => {
        i++;
        if (i === 1) return { nonsense: true };
        return validOutput();
      },
    };
    const adapter = new LlmExtractionAdapter(client);
    const r = await adapter.extractFacts({
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceId: "src-1",
      sourceDocumentId: "doc-1",
      contentText: "x",
      sourceType: "website",
      parserName: "firecrawl",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.warnings).toContain("Output required repair");
    expect(i).toBe(2);
  });

  it("returns EXTRACTION_FAILED when both attempts invalid", async () => {
    const client: LlmClient = {
      complete: async () => ({ not: "valid" }),
    };
    const adapter = new LlmExtractionAdapter(client);
    const r = await adapter.extractFacts({
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceId: "src-1",
      sourceDocumentId: "doc-1",
      contentText: "x",
      sourceType: "website",
      parserName: "firecrawl",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("EXTRACTION_FAILED");
  });

  it("surfaces LLM_ERROR when provider throws", async () => {
    const client: LlmClient = {
      complete: async () => {
        throw new Error("provider down");
      },
    };
    const adapter = new LlmExtractionAdapter(client);
    const r = await adapter.extractFacts({
      workspaceId: "ws-1",
      businessId: "biz-1",
      sourceId: "src-1",
      sourceDocumentId: "doc-1",
      contentText: "x",
      sourceType: "website",
      parserName: "firecrawl",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("LLM_ERROR");
  });
});

describe("LlmExtractionAdapter.reconcileFacts", () => {
  it("supersedes lower-precedence facts", async () => {
    const client: LlmClient = { complete: async () => validOutput() };
    const adapter = new LlmExtractionAdapter(client);
    const r = await adapter.reconcileFacts({
      businessId: "biz-1",
      workspaceId: "ws-1",
      factKey: "business.name",
      existingFacts: [
        {
          id: "f-1",
          value: "Old Name",
          confidence: 0.5,
          verificationStatus: "extracted",
          validFrom: new Date(),
        },
      ],
      newFacts: [
        {
          factKey: "business.name",
          value: "New Name",
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: null,
        },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.superseded).toHaveLength(1);
      expect(r.data.toCreate).toHaveLength(1);
    }
  });
});
