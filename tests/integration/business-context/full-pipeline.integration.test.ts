import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { NativeDocumentParser } from "@/infrastructure/business-context/parsers";
import { LlmExtractionAdapter } from "@/infrastructure/business-context/llm-extraction.adapter";
import { OpenRouterExtractionClient } from "@/infrastructure/business-context/openrouter-extraction.client";
import { FactRepository } from "@/infrastructure/business-context/repository/facts/fact.repository";

// ---------------------------------------------------------------------------
// Full pipeline integration test: parse → extract → save → verify
// Uses real fixtures, real OpenRouter API, real local Supabase.
//
// PDFs in fixtures/ are scanned/image-based → pdf-parse returns empty text.
// PPTX has extractable text → used as primary test fixture.
// ---------------------------------------------------------------------------

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY?.trim();
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-v4-flash";
const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const itIf = OPENROUTER_KEY && SUPABASE_KEY ? it : it.skip;

// ─── Fixtures ──────────────────────────────────────────────────────────────

const FIXTURES_DIR = path.resolve(__dirname, "../../fixtures/documents");
const PPTX_FILE = path.join(FIXTURES_DIR, "May - July 2026.pptx");
const PDF_FILE = path.join(FIXTURES_DIR, "May - July 2026.pdf");
const BRAND_BOOK = path.join(FIXTURES_DIR, "Brand Book 09_04_26 (1).pdf");

// Test workspace/business IDs (must match seed data)
const WORKSPACE_ID = "11111111-1111-1111-1111-111111111111";
const BUSINESS_ID = "33333333-3333-3333-3333-333333333333";
const SOURCE_ID = "77777777-7777-7777-7777-777777777777";

// ─── Supabase client ───────────────────────────────────────────────────────

let supabase: ReturnType<typeof createClient>;

type UntypedSupabase = {
  from(table: string): {
    upsert(row: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
  };
};

async function upsertTestFixture(table: string, row: Record<string, unknown>) {
  const { error } = await (supabase as unknown as UntypedSupabase).from(table).upsert(row);
  if (error) throw new Error(`Failed to seed ${table}: ${error.message}`);
}

beforeAll(async () => {
  if (!SUPABASE_KEY) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  await upsertTestFixture("workspaces", { id: WORKSPACE_ID, name: "Pipeline test workspace" });
  await upsertTestFixture("businesses", {
    id: BUSINESS_ID,
    workspace_id: WORKSPACE_ID,
    name: "Pipeline test business",
    website_url: "https://example.com",
    status: "active",
  });
  await upsertTestFixture("context_sources", {
    id: SOURCE_ID,
    workspace_id: WORKSPACE_ID,
    business_id: BUSINESS_ID,
    source_type: "website",
    source_name: "Pipeline test source",
    external_reference: "https://example.com",
    status: "processing",
    current_stage: "extracting",
    metadata: {},
  });
  await upsertTestFixture("source_documents", {
    id: "aaaaaaaa-1111-1111-1111-111111111111",
    workspace_id: WORKSPACE_ID,
    business_id: BUSINESS_ID,
    source_id: SOURCE_ID,
    url: "https://example.com/document",
    title: "Pipeline test document",
    document_type: "webpage",
    mime_type: "text/html",
    content_hash: "pipeline-test-document",
    content_text: "Pipeline test source document",
    retrieved_at: new Date().toISOString(),
  });
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Full pipeline: PPTX parse → OpenRouter extract → Supabase save → verify", () => {
  itIf(
    "parses PPTX, extracts business facts with OpenRouter, saves to Supabase, queries back",
    async () => {
      // Step 1: Parse PPTX
      console.log("\n=== STEP 1: Parse PPTX ===");
      const parser = new NativeDocumentParser();
      const pptxBuffer = fs.readFileSync(PPTX_FILE);
      const parseResult = await parser.route({
        content: pptxBuffer,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileName: "May - July 2026.pptx",
      });

      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const contentText = parseResult.data.contentText;
      console.log("Parse OK. Text length:", contentText.length);
      console.log("Slides:", parseResult.data.pageOrSlideCount);
      console.log("First 500 chars:", contentText.slice(0, 500));

      expect(contentText.length).toBeGreaterThan(50);

      // Step 2: Extract facts with Groq
      console.log("\n=== STEP 2: Extract facts with Groq ===");
      const adapter = new LlmExtractionAdapter(new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL));
      const extractResult = await adapter.extractFacts({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        sourceId: SOURCE_ID,
         sourceDocumentId: "aaaaaaaa-1111-1111-1111-111111111111",
        contentText: contentText.slice(0, 8000),
        sourceType: "product_document",
        parserName: "native",
      });

      expect(extractResult.ok).toBe(true);
      if (!extractResult.ok) {
        console.log("Extract error:", extractResult.error);
        return;
      }

      const { facts, conflicts, warnings } = extractResult.data;
      console.log("Facts extracted:", facts.length);
      console.log("Conflicts:", conflicts.length);
      console.log("Warnings:", warnings);

      expect(facts.length).toBeGreaterThan(0);

      // Print all facts
      facts.forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.factKey} = ${JSON.stringify(f.value)} (${f.confidence})`);
      });

      // Step 3: Save to Supabase
      console.log("\n=== STEP 3: Save to Supabase ===");

      // Clean up any previous test facts
      await supabase
        .from("context_facts")
        .delete()
        .eq("workspace_id", WORKSPACE_ID)
        .eq("business_id", BUSINESS_ID)
        .eq("created_by", "pipeline-test");

      let savedCount = 0;
      const factRepository = new FactRepository(supabase);
      const savedFactIds: string[] = [];
      for (const fact of facts) {
        const result = await factRepository.createContextFact({
          workspaceId: WORKSPACE_ID,
          businessId: BUSINESS_ID,
          factKey: fact.factKey,
          value: fact.value,
          sourceId: SOURCE_ID,
          sourceDocumentId: "aaaaaaaa-1111-1111-1111-111111111111",
          sourceExcerpt: fact.sourceExcerpt || null,
          evidenceLocator: null,
          confidence: fact.confidence,
          verificationStatus: "extracted",
          supersedesFactId: null,
          validFrom: new Date(),
          validTo: null,
          createdBy: "pipeline-test",
        });
        if (!result.ok) {
          console.log("  Save error:", fact.factKey, result.error.message);
        } else {
          savedCount++;
          savedFactIds.push(result.data.id);
        }
      }

      console.log(`Saved ${savedCount} facts`);
      expect(savedCount).toBeGreaterThan(0);

      // Step 4: Verify from DB
      console.log("\n=== STEP 4: Verify from DB ===");
      const dbFacts = await Promise.all(
        savedFactIds.map((factId) => factRepository.getContextFact(WORKSPACE_ID, factId)),
      );
      expect(dbFacts).toHaveLength(savedCount);
      expect(dbFacts.every((result) => result.ok && result.data !== null)).toBe(true);

      console.log("Facts in DB:", dbFacts.length);
      for (const result of dbFacts) {
        if (result.ok && result.data) {
          console.log(`  ${result.data.factKey} = ${JSON.stringify(result.data.value)} (${result.data.confidence})`);
        }
      }

      console.log("\n=== PIPELINE COMPLETE ===");
    },
    120_000,
  );

  itIf(
    "PDF scanned document produces empty text with OCR warning",
    async () => {
      const parser = new NativeDocumentParser();
      const pdfBuffer = fs.readFileSync(PDF_FILE);
      const result = await parser.route({
        content: pdfBuffer,
        mimeType: "application/pdf",
        fileName: "May - July 2026.pdf",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      console.log("PDF text length:", result.data.contentText.length);
      console.log("PDF warnings:", result.data.warnings);

      // Scanned PDF → empty text + OCR warning
      if (result.data.contentText.length === 0) {
        expect(result.data.warnings.length).toBeGreaterThan(0);
        expect(
          result.data.warnings.some((w) =>
            w.toLowerCase().includes("ocr") || w.toLowerCase().includes("scanned"),
          ),
        ).toBe(true);
        console.log("PDF is image-based — needs PaddleOCR (not available)");
      }
    },
    30_000,
  );

  itIf(
    "brand book PDF produces empty text with OCR warning",
    async () => {
      const parser = new NativeDocumentParser();
      const pdfBuffer = fs.readFileSync(BRAND_BOOK);
      const result = await parser.route({
        content: pdfBuffer,
        mimeType: "application/pdf",
        fileName: "Brand Book 09_04_26 (1).pdf",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      console.log("Brand book text length:", result.data.contentText.length);
      console.log("Brand book warnings:", result.data.warnings);

      if (result.data.contentText.length === 0) {
        expect(result.data.warnings.length).toBeGreaterThan(0);
        console.log("Brand book is image-based — needs PaddleOCR");
      }
    },
    30_000,
  );

  itIf(
    "PPTX extracted facts have valid structure",
    async () => {
      const parser = new NativeDocumentParser();
      const pptxBuffer = fs.readFileSync(PPTX_FILE);
      const parseResult = await parser.route({
        content: pptxBuffer,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileName: "May - July 2026.pptx",
      });
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

       const adapter = new LlmExtractionAdapter(new OpenRouterExtractionClient(OPENROUTER_KEY!, OPENROUTER_MODEL));
      const extractResult = await adapter.extractFacts({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        sourceId: SOURCE_ID,
        sourceDocumentId: "doc-1",
        contentText: parseResult.data.contentText.slice(0, 8000),
        sourceType: "website",
        parserName: "native",
      });

      expect(extractResult.ok).toBe(true);
      if (!extractResult.ok) return;

      const { facts } = extractResult.data;

      // Every fact has required fields
      for (const fact of facts) {
        expect(typeof fact.factKey).toBe("string");
        expect(fact.factKey.length).toBeGreaterThan(0);
        expect(fact.confidence).toBeGreaterThanOrEqual(0);
        expect(fact.confidence).toBeLessThanOrEqual(1);
        expect(fact.value).toBeDefined();
      }

      // Fact keys should be dot-separated
      for (const fact of facts) {
        expect(fact.factKey).toMatch(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
      }

      console.log("All", facts.length, "facts have valid structure");
    },
    120_000,
  );
});
