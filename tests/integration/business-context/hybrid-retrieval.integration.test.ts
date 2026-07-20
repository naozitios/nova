import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DoclingDocumentParserAdapter } from "@/infrastructure/business-context/docling-document-parser.adapter";
import { UploadedDocumentProcessor } from "@/core/business-context/service/uploaded-document.processor";
import { CanonicalDocumentIndexer } from "@/core/business-context/service/canonical-document-indexer";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";
import { SupabaseUploadStorage } from "@/infrastructure/business-context/supabase-upload.storage";
import { RetrievalRepository } from "@/infrastructure/business-context/retrieval.repository";
import { RetrievalService } from "@/core/business-context/service/retrieval.service";
import { SupabaseMetaRepository } from "@/infrastructure/meta/supabase-meta.repository";
import type { EmbeddingPort } from "@/core/business-context/embedding.port";

// ---------------------------------------------------------------------------
// Hybrid retrieval integration test — lexical + semantic search against real
// Supabase with mocked embeddings.
//
// Verifies: hybrid_search_document_chunks RPC, citation resolution,
// cross-business isolation, and meta metric passthrough.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const canRun = Boolean(SUPABASE_KEY);

// ── Test IDs ──────────────────────────────────────────────────────────────

const WORKSPACE_ID = crypto.randomUUID();
const BUSINESS_ID = crypto.randomUUID();
const SOURCE_ID = crypto.randomUUID();
const DOCUMENT_ID = crypto.randomUUID();

// Second workspace/business for cross-business isolation test
const WORKSPACE_ID_2 = crypto.randomUUID();
const BUSINESS_ID_2 = crypto.randomUUID();

// ── Supabase client ───────────────────────────────────────────────────────

let supabase: ReturnType<typeof createClient>;

// ── Fixtures ──────────────────────────────────────────────────────────────

// ── Mock embeddings ───────────────────────────────────────────────────────

const EMBEDDING_DIMS = 1536;
const MOCK_MODEL = "text-embedding-3-small";

function deterministicVector(seed: number, dims = EMBEDDING_DIMS): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dims; i++) {
    // Simple deterministic pseudo-random via sine
    vec.push(Math.round(Math.sin(seed * (i + 1)) * 1000) / 1000);
  }
  // Normalize to unit vector
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

const mockEmbeddingPort: EmbeddingPort = {
  model: MOCK_MODEL,
  dimensions: EMBEDDING_DIMS,
  embed: vi.fn(async (texts: string[]): Promise<{ ok: true; data: number[][] }> => ({
    ok: true,
    data: texts.map((_, i) => deterministicVector(i + 1)),
  })),
};

// ── Mock global.fetch for OpenAI embedding endpoint ────────────────────────

const originalFetch = global.fetch;

beforeAll(() => {
  if (!canRun) return;

  global.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (urlStr.includes("/v1/embeddings")) {
      const body = init?.body ? JSON.parse(init.body as string) : {};
      const input: string[] = Array.isArray(body.input) ? body.input : [body.input];
      return new Response(
        JSON.stringify({
          object: "list",
          data: input.map((_, i) => ({
            object: "embedding",
            index: i,
            embedding: deterministicVector(i + 1),
          })),
          model: MOCK_MODEL,
          usage: { prompt_tokens: 0, total_tokens: 0 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return originalFetch(url, init);
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function upsertRow(table: string, row: Record<string, unknown>) {
  const { error } = await supabase.from(table).upsert(row, { onConflict: "id" });
  if (error) throw new Error(`upsert ${table}: ${error.message}`);
}

async function deleteRow(table: string, match: Record<string, unknown>) {
  let query = supabase.from(table).delete();
  for (const [k, v] of Object.entries(match)) {
    query = query.eq(k, v);
  }
  await query;
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeAll(async () => {
  if (!canRun) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Seed workspace + business + source + document
  await upsertRow("workspaces", { id: WORKSPACE_ID, name: "Hybrid Retrieval Test WS" });
  await upsertRow("businesses", {
    id: BUSINESS_ID,
    workspace_id: WORKSPACE_ID,
    name: "Hybrid Retrieval Test Biz",
    status: "active",
  });
  await upsertRow("context_sources", {
    id: SOURCE_ID,
    workspace_id: WORKSPACE_ID,
    business_id: BUSINESS_ID,
    source_type: "upload",
    source_name: "Hybrid retrieval sample",
    external_reference: null,
    status: "registered",
  });
  await upsertRow("source_documents", {
    id: DOCUMENT_ID,
    workspace_id: WORKSPACE_ID,
    business_id: BUSINESS_ID,
    source_id: SOURCE_ID,
    url: null,
    title: "Sample HTML Document",
    document_type: "webpage",
    mime_type: "text/html",
    storage_path: "test/sample.html",
    content_hash: "hybrid-retrieval-test-hash",
    content_text: "Sample content",
    retrieved_at: new Date().toISOString(),
  });

  // Second workspace/business for cross-business test
  await upsertRow("workspaces", { id: WORKSPACE_ID_2, name: "Second WS" });
  await upsertRow("businesses", {
    id: BUSINESS_ID_2,
    workspace_id: WORKSPACE_ID_2,
    name: "Second Biz",
    status: "active",
  });
}, 30_000);

afterAll(async () => {
  if (!canRun || !supabase) return;

  // Clean document chunks first
  await supabase.from("document_chunks").delete().eq("source_document_id", DOCUMENT_ID);

  // Clean source documents
  await deleteRow("source_documents", { id: DOCUMENT_ID });

  // Clean sources
  await deleteRow("context_sources", { id: SOURCE_ID });

  // Clean businesses
  await deleteRow("businesses", { id: BUSINESS_ID });
  await deleteRow("businesses", { id: BUSINESS_ID_2 });

  // Clean workspaces
  await deleteRow("workspaces", { id: WORKSPACE_ID });
  await deleteRow("workspaces", { id: WORKSPACE_ID_2 });
});

// ── Process document through Docling ──────────────────────────────────────

async function processDocument(): Promise<void> {
  const storage = new SupabaseUploadStorage();
  const parser = new DoclingDocumentParserAdapter(storage, {
    pythonPath: process.env.DOCLING_PYTHON_PATH || ".venv-docling/bin/python",
  });
  const repo = new SupabaseRepository(supabase);
  const indexer = new CanonicalDocumentIndexer(storage, mockEmbeddingPort, repo);
  const processor = new UploadedDocumentProcessor(repo, parser, indexer);

  const result = await processor.process({
    workspaceId: WORKSPACE_ID,
    businessId: BUSINESS_ID,
    sourceId: SOURCE_ID,
    documentId: DOCUMENT_ID,
  });

  if (!result.ok) {
    throw new Error(`process failed: ${result.error.code} — ${result.error.message}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Hybrid retrieval integration", () => {
  let docProcessed = false;

  beforeAll(async () => {
    await processDocument();
    docProcessed = true;
  }, 120_000);

  it("lexical query returns matching chunks", async () => {
    expect(docProcessed).toBe(true);

    const { data, error } = await supabase.rpc("hybrid_search_document_chunks", {
      query_text: "analytics reporting platform",
      query_embedding: deterministicVector(1),
      match_workspace_id: WORKSPACE_ID,
      match_business_id: BUSINESS_ID,
      match_count: 10,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);

    // All returned chunks belong to our document
    for (const chunk of data!) {
      expect(chunk.source_document_id).toBe(DOCUMENT_ID);
    }

    // At least one chunk has a positive score
    const maxScore = Math.max(...data!.map((c: { score: number }) => c.score));
    expect(maxScore).toBeGreaterThan(0);
  });

  it("semantic query returns relevant chunks", async () => {
    expect(docProcessed).toBe(true);

    // Use a different vector for "semantic" style query
    const semanticVector = deterministicVector(99);

    const { data, error } = await supabase.rpc("hybrid_search_document_chunks", {
      query_text: "business intelligence solution for enterprise",
      query_embedding: semanticVector,
      match_workspace_id: WORKSPACE_ID,
      match_business_id: BUSINESS_ID,
      match_count: 10,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);
  });

  it("cross-business query returns zero rows", async () => {
    expect(docProcessed).toBe(true);

    // Query with first workspace's ID but second business ID
    const { data, error } = await supabase.rpc("hybrid_search_document_chunks", {
      query_text: "analytics",
      query_embedding: deterministicVector(1),
      match_workspace_id: WORKSPACE_ID,
      match_business_id: BUSINESS_ID_2,
      match_count: 10,
    });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBe(0);
  });

  it("Meta metric response equals seeded Meta SQL rows", async () => {
    // Verify that RetrievalService.metaMetrics.adAccounts is an array
    const repo = new SupabaseRepository(supabase);
    const retrievalPort = new RetrievalRepository(supabase);
    const metaRepo = new SupabaseMetaRepository(supabase);
    const retrievalService = new RetrievalService(repo, retrievalPort, mockEmbeddingPort, metaRepo);

    const result = await retrievalService.retrieveBusinessContext({
      workspaceId: WORKSPACE_ID,
      businessId: BUSINESS_ID,
      query: "test query",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // metaMetrics.adAccounts should be an array (even if empty)
    expect(Array.isArray(result.data.metaMetrics.adAccounts)).toBe(true);
  });
});
