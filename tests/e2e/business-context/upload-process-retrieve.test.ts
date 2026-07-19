import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";
import { DoclingDocumentParserAdapter } from "@/infrastructure/business-context/docling-document-parser.adapter";
import { UploadedDocumentProcessor } from "@/core/business-context/service/uploaded-document.processor";
import { RetrievalRepository } from "@/infrastructure/business-context/retrieval.repository";
import { RetrievalService } from "@/core/business-context/service/retrieval.service";
import { SupabaseMetaRepository } from "@/infrastructure/meta/supabase-meta.repository";
import type { EmbeddingPort } from "@/core/business-context/embedding.port";

// ---------------------------------------------------------------------------
// E2E test — full upload → process → retrieve flow.
//
// Exercises: Docling parsing, chunking, embedding, Supabase storage upload,
// document_chunks insert, hybrid_search_document_chunks RPC, and citation
// resolution end-to-end with real Supabase and real Docling.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const canRun = Boolean(SUPABASE_KEY);

// ── Test IDs ──────────────────────────────────────────────────────────────

const WORKSPACE_ID = crypto.randomUUID();
const BUSINESS_ID = crypto.randomUUID();
const SOURCE_ID = crypto.randomUUID();
const DOCUMENT_ID = crypto.randomUUID();

// ── Supabase client ───────────────────────────────────────────────────────

let supabase: ReturnType<typeof createClient>;

// ── Fixtures ──────────────────────────────────────────────────────────────

const FIXTURES_DIR = join(__dirname, "../../fixtures/documents");
const E2E_SAMPLE_HTML = join(FIXTURES_DIR, "e2e-sample.html");

// ── Mock embeddings ───────────────────────────────────────────────────────

const EMBEDDING_DIMS = 1536;
const MOCK_MODEL = "text-embedding-3-small";

function deterministicVector(seed: number, dims = EMBEDDING_DIMS): number[] {
  const vec: number[] = [];
  for (let i = 0; i < dims; i++) {
    vec.push(Math.round(Math.sin(seed * (i + 1)) * 1000) / 1000);
  }
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

  // Seed workspace + business
  await upsertRow("workspaces", { id: WORKSPACE_ID, name: "E2E Test Workspace" });
  await upsertRow("businesses", {
    id: BUSINESS_ID,
    workspace_id: WORKSPACE_ID,
    name: "E2E Test Business",
    status: "active",
  });
}, 30_000);

afterAll(async () => {
  if (!canRun || !supabase) return;

  // Clean document chunks for all documents under this source
  const { data: docs } = await supabase
    .from("source_documents")
    .select("id")
    .eq("source_id", SOURCE_ID);

  if (docs) {
    for (const doc of docs) {
      await supabase.from("document_chunks").delete().eq("source_document_id", doc.id);
    }
  }

  await deleteRow("source_documents", { source_id: SOURCE_ID });
  await deleteRow("context_sources", { id: SOURCE_ID });
  await deleteRow("businesses", { id: BUSINESS_ID });
  await deleteRow("workspaces", { id: WORKSPACE_ID });
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("E2E — full upload → process → retrieve flow", () => {
  it(
    "full upload → process → retrieve flow",
    async () => {
      // ── Step 1: Create workspace and business ────────────────────────────
      // Already done in beforeAll via upsertRow

      // ── Step 2: Upload e2e-sample.html to storage ────────────────────────
      const htmlContent = readFileSync(E2E_SAMPLE_HTML);
      const storagePath = `workspaces/${WORKSPACE_ID}/businesses/${BUSINESS_ID}/uploads/e2e-sample.html`;

      const { error: uploadError } = await supabase.storage
        .from("business-context-sources")
        .upload(storagePath, htmlContent, {
          contentType: "text/html; charset=utf-8",
          upsert: true,
        });
      expect(uploadError).toBeNull();

      // ── Step 3: Create source and document rows ─────────────────────────
      await upsertRow("context_sources", {
        id: SOURCE_ID,
        workspace_id: WORKSPACE_ID,
        business_id: BUSINESS_ID,
        source_type: "upload",
        source_name: "E2E sample upload",
        external_reference: null,
        status: "registered",
      });

      const docContentHash = "e2e-test-hash-" + Date.now();
      await upsertRow("source_documents", {
        id: DOCUMENT_ID,
        workspace_id: WORKSPACE_ID,
        business_id: BUSINESS_ID,
        source_id: SOURCE_ID,
        url: null,
        title: "E2E Test Document",
        document_type: "webpage",
        mime_type: "text/html",
        storage_path: storagePath,
        content_hash: docContentHash,
        content_text: "placeholder — overwritten by processor",
        retrieved_at: new Date().toISOString(),
      });

      // ── Step 4: Process via UploadedDocumentProcessor ────────────────────
      const storage = new (await import("@/infrastructure/business-context/supabase-upload.storage")).SupabaseUploadStorage();
      const parser = new DoclingDocumentParserAdapter(storage, {
        pythonPath: process.env.DOCLING_PYTHON_PATH || ".venv-docling/bin/python",
      });
      const repo = new SupabaseRepository(supabase);
      const processor = new UploadedDocumentProcessor(repo, parser, storage, mockEmbeddingPort);

      const processResult = await processor.process({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        sourceId: SOURCE_ID,
        documentId: DOCUMENT_ID,
      });

      expect(processResult.ok).toBe(true);
      if (!processResult.ok) {
        console.error("Process error:", processResult.error);
        return;
      }
      expect(processResult.data.status).toBe("indexed");

      // ── Step 5: Verify document is indexed ───────────────────────────────
      const { data: docRow, error: docErr } = await supabase
        .from("source_documents")
        .select("processing_status, embedding_model, indexed_at, processed_storage_path")
        .eq("id", DOCUMENT_ID)
        .single();

      expect(docErr).toBeNull();
      expect(docRow).not.toBeNull();
      expect(docRow!.processing_status).toBe("indexed");
      expect(docRow!.embedding_model).toBe(MOCK_MODEL);
      expect(docRow!.indexed_at).not.toBeNull();
      expect(docRow!.processed_storage_path).toContain(".md");

      // ── Step 6: Verify chunks exist with correct ownership ───────────────
      const { data: chunks, error: chunksErr } = await supabase
        .from("document_chunks")
        .select("id, source_document_id, content, heading_path, embedding_model")
        .eq("source_document_id", DOCUMENT_ID);

      expect(chunksErr).toBeNull();
      expect(chunks).not.toBeNull();
      expect(chunks!.length).toBeGreaterThan(0);

      for (const chunk of chunks!) {
        expect(chunk.source_document_id).toBe(DOCUMENT_ID);
        expect(chunk.content).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.embedding_model).toBe(MOCK_MODEL);
      }

      // ── Step 7: Verify Markdown artifact uploaded ────────────────────────
      const mdPath = docRow!.processed_storage_path;
      const { data: mdData, error: mdErr } = await supabase.storage
        .from("business-context-sources")
        .download(mdPath!);

      expect(mdErr).toBeNull();
      expect(mdData).not.toBeNull();

      const mdContent = await mdData!.text();
      expect(mdContent.length).toBeGreaterThan(50);
      // e2e-sample.html contains "Nova Platform" — should appear in markdown
      expect(mdContent).toContain("Nova Platform");

      // ── Step 8: Call hybrid_search_document_chunks RPC ───────────────────
      const { data: searchResults, error: searchErr } = await supabase.rpc(
        "hybrid_search_document_chunks",
        {
          query_text: "Nova Platform product features",
          query_embedding: deterministicVector(1),
          match_workspace_id: WORKSPACE_ID,
          match_business_id: BUSINESS_ID,
          match_count: 10,
        },
      );

      expect(searchErr).toBeNull();
      expect(searchResults).toBeDefined();
      expect(Array.isArray(searchResults)).toBe(true);
      expect(searchResults!.length).toBeGreaterThan(0);

      // ── Step 9: Assert results contain expected content ──────────────────
      const allContent = searchResults!
        .map((r: { content: string }) => r.content)
        .join(" ");
      // The HTML contains "Nova Platform" — chunks should capture this
      expect(allContent.length).toBeGreaterThan(0);

      // All returned chunks belong to our document
      for (const result of searchResults!) {
        expect(result.source_document_id).toBe(DOCUMENT_ID);
      }

      // At least one chunk has a positive score
      const maxScore = Math.max(
        ...searchResults!.map((r: { score: number }) => r.score),
      );
      expect(maxScore).toBeGreaterThan(0);

      // ── Step 10: Verify RetrievalService end-to-end ──────────────────────
      const retrievalPort = new RetrievalRepository(supabase);
      const metaRepo = new SupabaseMetaRepository(supabase);
      const retrievalService = new RetrievalService(repo, retrievalPort, mockEmbeddingPort, metaRepo);

      const ctxResult = await retrievalService.retrieveBusinessContext({
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        query: "Nova Platform features and pricing",
        limit: 5,
      });

      expect(ctxResult.ok).toBe(true);
      if (!ctxResult.ok) return;

      expect(ctxResult.data.evidenceChunks.length).toBeGreaterThan(0);
      expect(Array.isArray(ctxResult.data.metaMetrics.adAccounts)).toBe(true);
    },
    180_000,
  );
});
