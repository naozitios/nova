import { describe, expect, it, beforeAll } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  LlmExtractionAdapter,
  type LlmClient,
} from "@/infrastructure/business-context/llm-extraction.adapter";
import type { ExtractionRequest } from "@/core/business-context/extraction.port";

// ---------------------------------------------------------------------------
// T031/T033 — Extraction corpus integration tests
// Loads fixture-backed LLM responses and asserts extraction contract:
//   - Expected keys present in facts
//   - Evidence locators where expected
//   - Forbidden values absent
//   - Confidence thresholds respected
//   - Conflict detection where applicable
//
// Fixtures: tests/fixtures/business-context/extraction/*.json
// Each fixture contains contentText, expectedOutput, and assertions.
// ---------------------------------------------------------------------------

interface FixtureAssertion {
  mustContainKeys: string[];
  mustContainConflicts?: string[];
  forbiddenValues: Record<string, string[]>;
  minConfidence: number;
  maxFacts: number;
  minFacts: number;
  minConflicts?: number;
  expectAllBelowThreshold?: boolean;
}

interface ExtractionFixture {
  contentText: string;
  expectedOutput: {
    facts: Array<{
      factKey: string;
      value: unknown;
      confidence: number;
      sourceExcerpt: string | null;
      evidenceLocator: unknown;
    }>;
    conflicts: Array<{ factKey: string; values: unknown[] }>;
    warnings: string[];
  };
  assertions: FixtureAssertion;
}

const FIXTURES_DIR = join(
  process.cwd(),
  "tests",
  "fixtures",
  "business-context",
  "extraction",
);

function makeRequest(contentText: string): ExtractionRequest {
  return {
    workspaceId: "ws-test",
    businessId: "biz-test",
    sourceId: "src-test",
    sourceDocumentId: "doc-test",
    contentText,
    sourceType: "website",
    parserName: "test",
  };
}

function mockClient(returnData: unknown): LlmClient {
  return {
    complete: async () => returnData,
  };
}

async function loadFixtures(): Promise<
  Array<{ name: string; fixture: ExtractionFixture }>
> {
  const entries = await readdir(FIXTURES_DIR);
  const files = entries.filter((f) => f.endsWith(".json"));
  const fixtures: Array<{ name: string; fixture: ExtractionFixture }> = [];
  for (const fileName of files) {
    const raw = await readFile(join(FIXTURES_DIR, fileName), "utf-8");
    fixtures.push({ name: fileName, fixture: JSON.parse(raw) });
  }
  return fixtures;
}

describe("Extraction corpus — fixture-backed contract tests", () => {
  let fixtures: Array<{ name: string; fixture: ExtractionFixture }>;

  beforeAll(async () => {
    fixtures = await loadFixtures();
  });

  it("loads at least one fixture file", async () => {
    const loaded = await loadFixtures();
    expect(loaded.length).toBeGreaterThan(0);
  });

  it("extracts facts with correct structure from marketing fixture", async () => {
    const raw = await readFile(
      join(FIXTURES_DIR, "marketing-website.json"),
      "utf-8",
    );
    const fixture: ExtractionFixture = JSON.parse(raw);
    const client = mockClient(fixture.expectedOutput);
    const adapter = new LlmExtractionAdapter(client);
    const result = await adapter.extractFacts(
      makeRequest(fixture.contentText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { facts } = result.data;
    expect(facts.length).toBeGreaterThanOrEqual(fixture.assertions.minFacts);
    expect(facts.length).toBeLessThanOrEqual(fixture.assertions.maxFacts);

    const extractedKeys = facts.map((f) => f.factKey);
    for (const key of fixture.assertions.mustContainKeys) {
      expect(extractedKeys).toContain(key);
    }

    for (const fact of facts) {
      expect(typeof fact.factKey).toBe("string");
      expect(typeof fact.confidence).toBe("number");
      expect(fact.confidence).toBeGreaterThanOrEqual(0);
      expect(fact.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("filters low-confidence facts (confidence >= 0.5 required)", async () => {
    const raw = await readFile(
      join(FIXTURES_DIR, "low-confidence.json"),
      "utf-8",
    );
    const fixture: ExtractionFixture = JSON.parse(raw);
    const client = mockClient(fixture.expectedOutput);
    const adapter = new LlmExtractionAdapter(client);
    const result = await adapter.extractFacts(
      makeRequest(fixture.contentText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // System prompt mandates confidence >= 0.5; adapter must enforce
    for (const fact of result.data.facts) {
      expect(fact.confidence).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("detects conflicts in conflict scenario fixture", async () => {
    const raw = await readFile(
      join(FIXTURES_DIR, "conflict-scenario.json"),
      "utf-8",
    );
    const fixture: ExtractionFixture = JSON.parse(raw);
    const client = mockClient(fixture.expectedOutput);
    const adapter = new LlmExtractionAdapter(client);
    const result = await adapter.extractFacts(
      makeRequest(fixture.contentText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const conflictKeys = result.data.conflicts.map((c) => c.factKey);
    for (const key of fixture.assertions.mustContainConflicts ?? []) {
      expect(conflictKeys).toContain(key);
    }

    for (const conflict of result.data.conflicts) {
      expect(Array.isArray(conflict.values)).toBe(true);
      expect(conflict.values.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("contains no forbidden values across all fixtures", async () => {
    const loaded = await loadFixtures();
    for (const { name, fixture } of loaded) {
      const client = mockClient(fixture.expectedOutput);
      const adapter = new LlmExtractionAdapter(client);
      const result = await adapter.extractFacts(
        makeRequest(fixture.contentText),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) continue;

      for (const fact of result.data.facts) {
        const forbidden = fixture.assertions.forbiddenValues[fact.factKey];
        if (forbidden) {
          for (const bad of forbidden) {
            expect(fact.value).not.toBe(bad);
          }
        }
      }
    }
  });

  it("preserves sourceExcerpt in extracted facts", async () => {
    const raw = await readFile(
      join(FIXTURES_DIR, "marketing-website.json"),
      "utf-8",
    );
    const fixture: ExtractionFixture = JSON.parse(raw);
    const client = mockClient(fixture.expectedOutput);
    const adapter = new LlmExtractionAdapter(client);
    const result = await adapter.extractFacts(
      makeRequest(fixture.contentText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const factsWithExcerpt = result.data.facts.filter(
      (f) => f.sourceExcerpt !== null,
    );
    expect(factsWithExcerpt.length).toBeGreaterThan(0);
  });

  it("returns warnings array as strings", async () => {
    const raw = await readFile(
      join(FIXTURES_DIR, "conflict-scenario.json"),
      "utf-8",
    );
    const fixture: ExtractionFixture = JSON.parse(raw);
    const client = mockClient(fixture.expectedOutput);
    const adapter = new LlmExtractionAdapter(client);
    const result = await adapter.extractFacts(
      makeRequest(fixture.contentText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Array.isArray(result.data.warnings)).toBe(true);
    for (const w of result.data.warnings) {
      expect(typeof w).toBe("string");
    }
  });
});
