import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { DoclingDocumentParserAdapter } from '@/infrastructure/business-context/docling-document-parser.adapter';
import { UploadedDocumentProcessor } from '@/core/business-context/service/uploaded-document.processor';
import { CanonicalDocumentIndexer } from '@/core/business-context/service/canonical-document-indexer';
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository';


// ---------------------------------------------------------------------------
// Docling upload pipeline integration test: parse → chunk → embed → save
// Uses real local Docling, real Supabase, mocked embeddings.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PYTHON_PATH = process.env.DOCLING_PYTHON_PATH || '.venv-docling/bin/python';

const canRun = Boolean(SUPABASE_KEY);

const FIXTURES_DIR = path.resolve(__dirname, '../../fixtures/documents');
const HTML_FIXTURE = path.join(FIXTURES_DIR, 'sample.html');
const PDF_FIXTURE = path.join(FIXTURES_DIR, 'sample.pdf');

// ─── IDs (unique per run to avoid pollution) ───────────────────────────────

const wsId = crypto.randomUUID();
const bizId = crypto.randomUUID();
const sourceId = crypto.randomUUID();
const docHtmlId = crypto.randomUUID();
const docPdfId = crypto.randomUUID();

// ─── Supabase client ───────────────────────────────────────────────────────

let db: ReturnType<typeof createClient>;

// ─── Mock embedder ─────────────────────────────────────────────────────────

const mockEmbedder = {
  model: 'text-embedding-3-small',
  dimensions: 1536,
  embed: vi.fn().mockImplementation(async (texts: string[]) => ({
    ok: true,
    data: texts.map(() =>
      Array(1536)
        .fill(0)
        .map((_, i) => Math.sin(i * 0.01) * 0.1),
    ),
  })),
};

// ─── Mock adapter storage (for DoclingDocumentParserAdapter) ───────────────
// The adapter hardcodes bucket 'documents' for downloads, but we upload to
// 'business-context-sources'. Redirect the download to the correct bucket.

const mockAdapterStorage = {
  upload: vi.fn().mockResolvedValue({ ok: true, data: { storagePath: 'test' } }),
  download: vi.fn().mockImplementation(async ({ path: p }: { bucket: string; path: string }) => {
    const { data, error } = await db.storage.from('business-context-sources').download(p);
    if (error) return { ok: false, error: { code: 'DOWNLOAD_FAILED', message: error.message } };
    return { ok: true, data: Buffer.from(await data.arrayBuffer()) };
  }),
  getSignedUrl: vi.fn(),
  delete: vi.fn(),
};

// ─── Processor storage (records calls, actually uploads .md for verification) ─

const processorStorage = {
  upload: vi.fn().mockImplementation(
    async ({
      bucket,
      path: p,
      content,
      contentType,
      upsert,
    }: {
      bucket: string;
      path: string;
      content: Buffer;
      contentType: string;
      upsert?: boolean;
    }) => {
      await db.storage.from(bucket).upload(p, content, { contentType, upsert: upsert ?? false });
      return { ok: true, data: { storagePath: p } };
    },
  ),
  download: vi.fn(),
  getSignedUrl: vi.fn(),
  delete: vi.fn(),
};

// ─── Global fetch mock for embedding API ────────────────────────────────────

const originalFetch = global.fetch;

beforeAll(() => {
  global.fetch = vi.fn().mockImplementation(async (url: string | URL, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString();
    if (urlStr.includes('/embeddings')) {
      // Return random 1536-dim vectors
      return new Response(
        JSON.stringify({
          data: [
            {
              embedding: Array(1536)
                .fill(0)
                .map((_, i) => Math.sin(i * 0.01) * 0.1),
              index: 0,
            },
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return originalFetch(url, _init);
  });
});

afterAll(() => {
  global.fetch = originalFetch;
});

// ─── Setup / teardown ──────────────────────────────────────────────────────

beforeAll(async () => {
  if (!canRun) return;

  db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Seed workspace
  const { error: wsErr } = await db.from('workspaces').upsert(
    { id: wsId, name: 'Docling pipeline test workspace' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (wsErr) throw new Error(`Failed to create workspace: ${wsErr.message}`);

  // Seed business
  const { error: bizErr } = await db.from('businesses').upsert(
    {
      id: bizId,
      workspace_id: wsId,
      name: 'Docling pipeline test business',
      status: 'active',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (bizErr) throw new Error(`Failed to create business: ${bizErr.message}`);

  // Seed context source
  const { error: srcErr } = await db.from('context_sources').upsert(
    {
      id: sourceId,
      workspace_id: wsId,
      business_id: bizId,
      source_type: 'upload',
      source_name: 'Docling pipeline test source',
      external_reference: null,
      status: 'processing',
      current_stage: 'extracting',
      terminal_outcome: null,
      metadata: {},
      collected_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (srcErr) throw new Error(`Failed to create source: ${srcErr.message}`);

  // Upload HTML fixture to storage
  const htmlBuffer = fs.readFileSync(HTML_FIXTURE);
  const htmlStoragePath = `workspaces/${wsId}/businesses/${bizId}/uploads/test/sample.html`;
  const { error: uploadHtmlErr } = await db.storage
    .from('business-context-sources')
    .upload(htmlStoragePath, htmlBuffer, {
      contentType: 'text/html',
      upsert: true,
    });
  if (uploadHtmlErr) throw new Error(`Failed to upload HTML fixture: ${uploadHtmlErr.message}`);

  // Seed HTML document row
  const { error: docHtmlErr } = await db.from('source_documents').upsert(
    {
      id: docHtmlId,
      workspace_id: wsId,
      business_id: bizId,
      source_id: sourceId,
      url: null,
      title: 'Sample HTML Document',
      document_type: 'upload',
      mime_type: 'text/html',
      file_name: 'sample.html',
      file_size_bytes: htmlBuffer.length,
      storage_path: htmlStoragePath,
      content_hash: `html-test-${crypto.randomUUID()}`,
      processing_status: 'pending',
      retrieved_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (docHtmlErr) throw new Error(`Failed to create HTML document: ${docHtmlErr.message}`);

  // Upload PDF fixture to storage
  const pdfBuffer = fs.readFileSync(PDF_FIXTURE);
  const pdfStoragePath = `workspaces/${wsId}/businesses/${bizId}/uploads/test/sample.pdf`;
  const { error: uploadPdfErr } = await db.storage
    .from('business-context-sources')
    .upload(pdfStoragePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadPdfErr) throw new Error(`Failed to upload PDF fixture: ${uploadPdfErr.message}`);

  // Seed PDF document row
  const { error: docPdfErr } = await db.from('source_documents').upsert(
    {
      id: docPdfId,
      workspace_id: wsId,
      business_id: bizId,
      source_id: sourceId,
      url: null,
      title: 'Sample PDF Document',
      document_type: 'upload',
      mime_type: 'application/pdf',
      file_name: 'sample.pdf',
      file_size_bytes: pdfBuffer.length,
      storage_path: pdfStoragePath,
      content_hash: `pdf-test-${crypto.randomUUID()}`,
      processing_status: 'pending',
      retrieved_at: new Date().toISOString(),
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (docPdfErr) throw new Error(`Failed to create PDF document: ${docPdfErr.message}`);
});

afterAll(async () => {
  if (!canRun || !db) return;

  // Delete in FK-safe order
  await db.from('document_chunks').delete().eq('workspace_id', wsId);
  await db.from('context_facts').delete().eq('workspace_id', wsId);
  await db.from('source_documents').delete().eq('workspace_id', wsId);
  await db.from('context_sources').delete().eq('workspace_id', wsId);
  await db.from('businesses').delete().eq('id', bizId);
  await db.from('workspaces').delete().eq('id', wsId);

  // Delete uploaded storage objects
  await db.storage.from('business-context-sources').remove([
    `workspaces/${wsId}/businesses/${bizId}/uploads/test/sample.html`,
    `workspaces/${wsId}/businesses/${bizId}/uploads/test/sample.pdf`,
  ]);
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function createParser() {
  return new DoclingDocumentParserAdapter(mockAdapterStorage, {
    pythonPath: PYTHON_PATH,
  });
}

function createRepo() {
  return new SupabaseRepository();
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)(
  'Docling upload pipeline integration — HTML',
  () => {
    it(
      'processes HTML through Docling and creates chunks + Markdown artifact',
      async () => {
        const parser = createParser();
        const repo = createRepo();

        const indexer = new CanonicalDocumentIndexer(processorStorage, mockEmbedder, repo);
        const processor = new UploadedDocumentProcessor(repo, parser, indexer);

        const result = await processor.process({
          workspaceId: wsId,
          businessId: bizId,
          sourceId,
          documentId: docHtmlId,
        });

        // Result ok
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Query document from DB
        const { data: doc, error: docErr } = await db
          .from('source_documents')
          .select('*')
          .eq('id', docHtmlId)
          .single();
        expect(docErr).toBeNull();
        expect(doc).not.toBeNull();

        // Processing status
        expect(doc!.processing_status).toBe('indexed');

        // Processed storage path ends with .md
        expect(doc!.processed_storage_path).toMatch(/\.md$/);

        // Embedding model
        expect(doc!.embedding_model).toBe('text-embedding-3-small');

        // Parser name
        expect(doc!.parser_name).toBe('docling');

        // Indexed at not null
        expect(doc!.indexed_at).not.toBeNull();

        // Embedder was called
        expect(mockEmbedder.embed).toHaveBeenCalled();

        // Query document_chunks
        const { data: chunks, error: chunkErr } = await db
          .from('document_chunks')
          .select('*')
          .eq('workspace_id', wsId)
          .eq('source_document_id', docHtmlId);
        expect(chunkErr).toBeNull();
        expect(chunks).not.toBeNull();
        expect(chunks!.length).toBeGreaterThan(0);

        // All chunks have 1536-dim embeddings and correct workspace/business
        for (const chunk of chunks!) {
          expect(chunk.embedding).toHaveLength(1536);
          expect(chunk.workspace_id).toBe(wsId);
          expect(chunk.business_id).toBe(bizId);
          expect(chunk.source_document_id).toBe(docHtmlId);
        }

        // Download the .md artifact from storage and verify content
        const processedPath = doc!.processed_storage_path!;
        const { data: mdData, error: mdErr } = await db.storage
          .from('business-context-sources')
          .download(processedPath);
        expect(mdErr).toBeNull();
        expect(mdData).not.toBeNull();
        const mdText = Buffer.from(await mdData!.arrayBuffer()).toString('utf-8');
        expect(mdText.length).toBeGreaterThan(0);
        // Docling HTML output should contain content from the fixture
        expect(mdText).toMatch(/Nova Platform|Product Overview|Key Features/i);

        // Verify no temp directories remain
        const { readdirSync } = await import('node:fs');
        const tmpFiles = readdirSync('/tmp').filter((f) => f.startsWith('nova-docling-'));
        expect(tmpFiles).toHaveLength(0);
      },
      180_000,
    );
  },
);

describe.skipIf(!canRun)(
  'Docling upload pipeline integration — PDF',
  () => {
    it(
      'processes PDF through Docling',
      async () => {
        const parser = createParser();
        const repo = createRepo();

        const indexer = new CanonicalDocumentIndexer(processorStorage, mockEmbedder, repo);
        const processor = new UploadedDocumentProcessor(repo, parser, indexer);

        const result = await processor.process({
          workspaceId: wsId,
          businessId: bizId,
          sourceId,
          documentId: docPdfId,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const { data: doc, error: docErr } = await db
          .from('source_documents')
          .select('*')
          .eq('id', docPdfId)
          .single();
        expect(docErr).toBeNull();
        expect(doc).not.toBeNull();

        expect(doc!.processing_status).toBe('indexed');
        expect(doc!.processed_storage_path).toMatch(/\.md$/);
        expect(doc!.embedding_model).toBe('text-embedding-3-small');
        expect(doc!.parser_name).toBe('docling');
        expect(doc!.indexed_at).not.toBeNull();

        expect(mockEmbedder.embed).toHaveBeenCalled();

        const { data: chunks, error: chunkErr } = await db
          .from('document_chunks')
          .select('*')
          .eq('workspace_id', wsId)
          .eq('source_document_id', docPdfId);
        expect(chunkErr).toBeNull();
        expect(chunks).not.toBeNull();
        expect(chunks!.length).toBeGreaterThan(0);

        for (const chunk of chunks!) {
          expect(chunk.embedding).toHaveLength(1536);
          expect(chunk.workspace_id).toBe(wsId);
          expect(chunk.business_id).toBe(bizId);
          expect(chunk.source_document_id).toBe(docPdfId);
        }

        // Download .md artifact
        const processedPath = doc!.processed_storage_path!;
        const { data: mdData, error: mdErr } = await db.storage
          .from('business-context-sources')
          .download(processedPath);
        expect(mdErr).toBeNull();
        expect(mdData).not.toBeNull();
        const mdText = Buffer.from(await mdData!.arrayBuffer()).toString('utf-8');
        expect(mdText.length).toBeGreaterThan(0);

        // Verify no temp directories remain
        const { readdirSync } = await import('node:fs');
        const tmpFiles = readdirSync('/tmp').filter((f) => f.startsWith('nova-docling-'));
        expect(tmpFiles).toHaveLength(0);
      },
      180_000,
    );
  },
);
