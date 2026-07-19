# Docling Hybrid Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Process uploaded business documents through local Docling, persist one Markdown artifact plus searchable pgvector chunks, and retrieve cited evidence without replacing existing facts, conflicts, verification, profile versions, or structured Meta metrics.

**Architecture:** Keep one TypeScript business-context worker and one `source_processing` job. For uploaded documents, worker launches a local Python Docling subprocess, uploads deterministic Markdown, chunks and embeds it in TypeScript, then runs existing extraction/reconciliation against same document row. No Docling HTTP service, second worker, second queue, or worker handoff.

**Tech Stack:** Next.js 16, TypeScript, Python 3.10+, Docling 2.70.x, Supabase Storage/Postgres, pgvector, PostgreSQL full-text search, OpenAI-compatible embeddings (`text-embedding-3-small`, 1536 dimensions), Vitest, pytest.

## Global Constraints

- Begin execution only after syncing local `feature/work`, currently 11 commits behind `origin/feature/work`, and revalidating paths changed by remote commits.
- Supabase remains system of record.
- Storage contains exactly original upload and one processed Markdown artifact per document; no OCR, page-image, or intermediate artifacts.
- Temporary local files are deleted in `finally` on success, timeout, and failure.
- Docling runs locally as subprocess inside existing business-context worker; no HTTP service.
- One `source_processing` job owns parsing, indexing, extraction, reconciliation, and quality checks.
- Keep Meta Ads metrics in normalized SQL tables; never embed metric snapshots as document truth.
- Preserve existing facts, conflicts, user verification, and `business_profile_versions` behavior.
- Add migrations only; never rewrite already-applied migrations.
- Keep `source_documents.content_text` during rollout, but processed Markdown becomes canonical parsed artifact.
- Use deterministic paths, chunk order, and job idempotency so retries create no duplicate artifacts, documents, or chunks.
- Initial chunking uses heading-aware 4,000-character chunks with 400-character overlap. Avoid tokenizer dependency until measured need exists.
- Initial embedding contract is fixed to `text-embedding-3-small` and 1536 dimensions. Changing model or dimensions requires new migration and explicit reindex.

## File Map

- `supabase/migrations/202607190001_document_retrieval.sql`: pgvector extension, document columns, chunk table, RLS, indexes, hybrid-search function.
- `src/core/business-context/document-parser.port.ts`: canonical Docling parse contract.
- `src/core/business-context/embedding.port.ts`: batch embedding boundary.
- `src/core/business-context/document-chunk.ts`: deterministic Markdown chunking and citation locators.
- `src/core/business-context/repository/source.port.ts`: document/chunk persistence methods.
- `src/core/business-context/types/entities.ts`: processed-document and chunk types.
- `workers/document-processing/convert.py`: one-file Docling-to-JSON subprocess entrypoint.
- `workers/document-processing/requirements.txt`: pinned local parser dependency.
- `src/infrastructure/business-context/docling-document-parser.adapter.ts`: storage download, subprocess timeout, JSON validation, cleanup.
- `src/infrastructure/business-context/openai-embedding.adapter.ts`: OpenAI-compatible embedding request.
- `src/infrastructure/business-context/repository/source.repository.ts`: processed-document and chunk persistence.
- `src/infrastructure/business-context/retrieval.repository.ts`: hybrid-search RPC adapter.
- `src/core/business-context/service/uploaded-document.processor.ts`: parse, artifact upload, chunk, embed, persist, extract.
- `src/core/business-context/service/source-processing.service.ts`: route uploaded job to uploaded-document processor; retain website/manual path.
- `src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts`: pass existing job and document ID through one pipeline.
- `src/di/providers/business-context.ts`: wire Docling, embeddings, storage, and uploaded processor.
- `src/infrastructure/config.ts`: Docling and embedding configuration; plural storage defaults.
- `src/core/business-context/service/retrieval.service.ts`: profile/facts/evidence assembly and Meta SQL separation.
- `src/app/api/businesses/[id]/context/search/route.ts`: authenticated retrieval endpoint.
- Legacy parser/Paddle files and dependencies: remove only after replacement integration tests pass.

---

### Task 1: Add Retrieval Schema And Correct Storage Defaults

**Files:**

- Create: `supabase/migrations/202607190001_document_retrieval.sql`
- Modify: `src/infrastructure/config.ts:45-53`
- Modify: `src/core/business-context/types/entities.ts:69-91`
- Modify: `src/infrastructure/business-context/repository/mappers/source.ts`
- Test: `tests/rls/business-context-document-chunks.rls.test.ts`
- Test: `src/infrastructure/business-context/repository/source.repository.test.ts`

**Interfaces:**

- Produces: `SourceDocument.processedStoragePath`, `processingStatus`, `embeddingModel`, `indexedAt`; SQL table `document_chunks`; RPC `hybrid_search_document_chunks`.

- [x] **Step 1: Write failing mapper and RLS tests**

Add assertions that snake-case columns map to new entity fields and that authenticated users can select chunks only for workspaces they belong to. Assert service role can insert/update/delete. Assert another workspace receives zero rows.

```typescript
expect(mapped).toMatchObject({
  processedStoragePath: 'workspaces/w1/businesses/b1/uploads/u1/source.pdf.md',
  processingStatus: 'indexed',
  embeddingModel: 'text-embedding-3-small',
});
```

- [x] **Step 2: Run tests and verify failure**

Run: `npm run test:unit -- src/infrastructure/business-context/repository/source.repository.test.ts && npm run test:rls -- tests/rls/business-context-document-chunks.rls.test.ts`

Expected: FAIL because columns/table do not exist.

- [x] **Step 3: Add additive migration**

Migration must implement this schema exactly:

```sql
create extension if not exists vector with schema extensions;

alter table source_documents
  add column if not exists processed_storage_path text,
  add column if not exists processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'indexed', 'failed')),
  add column if not exists embedding_model text,
  add column if not exists indexed_at timestamptz;

create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_document_id uuid not null references source_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading_path text[] not null default '{}',
  content text not null check (length(btrim(content)) > 0),
  locator jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  embedding_model text not null,
  search_vector tsvector generated always as
    (to_tsvector('simple', coalesce(array_to_string(heading_path, ' '), '') || ' ' || content)) stored,
  created_at timestamptz not null default now(),
  unique (source_document_id, chunk_index)
);

create index document_chunks_scope_idx
  on document_chunks (workspace_id, business_id, source_document_id);
create index document_chunks_fts_idx on document_chunks using gin (search_vector);
create index document_chunks_embedding_idx on document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table document_chunks enable row level security;
```

Use workspace-membership SELECT and service-role write policies for `document_chunks`. Do not copy current Storage path expression: uploaded paths are `workspaces/{workspaceId}/businesses/...`, so workspace UUID is segment 2, not segment 1. In this migration, drop and recreate existing source/archive object policies using `(string_to_array(name, '/'))[2]`, while retaining owner/admin delete restrictions. Create `hybrid_search_document_chunks(query_text text, query_embedding extensions.vector(1536), match_workspace_id uuid, match_business_id uuid, match_count integer default 8)` as `security invoker`; filter workspace/business inside both lexical and semantic CTEs before ranking, combine top 50 from each with reciprocal-rank fusion, join `source_documents`, and require `processing_status = 'indexed'`.

- [x] **Step 4: Correct runtime bucket defaults**

Set defaults to migration-created names:

```typescript
storageSourceBucket: process.env.SUPABASE_STORAGE_SOURCE_BUCKET || 'business-context-sources',
storageArchiveBucket: process.env.SUPABASE_STORAGE_ARCHIVE_BUCKET || 'business-context-archives',
```

- [x] **Step 5: Update entity and mapper**

Add fields without removing `contentText` or `storagePath`:

```typescript
processedStoragePath: string | null;
processingStatus: 'pending' | 'processing' | 'indexed' | 'failed';
embeddingModel: string | null;
indexedAt: Date | null;
```

- [x] **Step 6: Reset local Supabase and rerun tests**

Run: `npm run supabase:reset && npm run test:rls && npm run test:unit -- src/infrastructure/business-context/repository/source.repository.test.ts`

Expected: PASS; existing migrations and business-context tables remain intact.

- [x] **Step 7: Commit**

```bash
git add supabase/migrations/202607190001_document_retrieval.sql src/infrastructure/config.ts src/core/business-context/types/entities.ts src/infrastructure/business-context/repository/mappers/source.ts tests/rls/business-context-document-chunks.rls.test.ts src/infrastructure/business-context/repository/source.repository.test.ts
git commit -m "feat: add document retrieval schema"
```

### Task 2: Implement Local Docling Subprocess Adapter

**Files:**

- Create: `workers/document-processing/convert.py`
- Create: `workers/document-processing/requirements.txt`
- Create: `workers/document-processing/tests/test_convert.py`
- Create: `src/infrastructure/business-context/docling-document-parser.adapter.ts`
- Create: `src/infrastructure/business-context/docling-document-parser.adapter.test.ts`
- Modify: `src/core/business-context/document-parser.port.ts`
- Modify: `src/core/business-context/upload-storage.port.ts`
- Modify: `src/infrastructure/business-context/supabase-upload.storage.ts`

**Interfaces:**

- Consumes: `UploadStoragePort.download({ bucket, path })`.
- Produces: `DoclingDocumentParserAdapter.parse(...) -> ServiceResult<ParsedDocument>`; `ParsedDocument.contentText` is Markdown.

- [x] **Step 1: Write failing Python converter tests**

Use a tiny generated HTML fixture, not a downloaded binary. Test valid conversion returns JSON on stdout and invalid input exits non-zero without creating output files.

```python
payload = json.loads(result.stdout)
assert "# Product" in payload["contentText"]
assert payload["parserName"] == "docling"
assert payload["warnings"] == []
```

- [x] **Step 2: Implement converter entrypoint**

Pin `docling==2.70.0` in `requirements.txt`. `convert.py` must use `DocumentConverter().convert(Path(input_path)).document`, call `export_to_markdown()` with default image handling, and print one JSON object containing `contentText`, `parserName`, `parserVersion`, `pageOrSlideCount`, `warnings`, and `metadata`. Never write images or Markdown files.

```python
from importlib.metadata import version
from pathlib import Path
import json
import sys

from docling.document_converter import DocumentConverter

document = DocumentConverter().convert(Path(sys.argv[1])).document
print(json.dumps({
    "contentText": document.export_to_markdown(),
    "parserName": "docling",
    "parserVersion": version("docling"),
    "pageOrSlideCount": len(document.pages),
    "warnings": [],
    "metadata": {},
}))
```

- [x] **Step 3: Run Python tests**

Run: `python -m venv .venv-docling && .venv-docling/bin/pip install -r workers/document-processing/requirements.txt && .venv-docling/bin/pytest workers/document-processing/tests -q`

Expected: PASS.

- [x] **Step 4: Write failing TypeScript adapter tests**

Mock `execFile`, storage download, and temporary directory operations. Cover supported MIME types, timeout mapping to `DOCLING_TIMEOUT`, malformed JSON mapping to `DOCLING_OUTPUT_INVALID`, and cleanup after every outcome.

```typescript
expect(rm).toHaveBeenCalledWith(expect.stringContaining('nova-docling-'), {
  recursive: true,
  force: true,
});
```

- [x] **Step 5: Implement adapter**

Support PDF, DOCX, PPTX, XLSX, HTML, PNG, JPEG, WEBP, and TIFF. Download original, create `mkdtemp(join(tmpdir(), 'nova-docling-'))`, write sanitized basename, call Python through promisified `execFile` with configurable 180-second timeout and 20 MB stdout limit, validate JSON, and remove directory in `finally`.

Keep `parseContent` by writing supplied buffer into same temporary flow. Do not upload anything from adapter. Extend `UploadStoragePort.upload` with optional `upsert?: boolean`, pass it through `SupabaseUploadStorage`, and keep default `false`; processed Markdown is only caller using `true`.

- [x] **Step 6: Run focused tests**

Run: `npm run test:unit -- src/infrastructure/business-context/docling-document-parser.adapter.test.ts`

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add workers/document-processing src/core/business-context/document-parser.port.ts src/core/business-context/upload-storage.port.ts src/infrastructure/business-context/supabase-upload.storage.ts src/infrastructure/business-context/docling-document-parser.adapter.ts src/infrastructure/business-context/docling-document-parser.adapter.test.ts
git commit -m "feat: parse documents with local docling"
```

### Task 3: Add Deterministic Chunking And Embeddings

**Files:**

- Create: `src/core/business-context/embedding.port.ts`
- Create: `src/core/business-context/document-chunk.ts`
- Create: `src/core/business-context/document-chunk.test.ts`
- Create: `src/infrastructure/business-context/openai-embedding.adapter.ts`
- Create: `src/infrastructure/business-context/openai-embedding.adapter.test.ts`
- Modify: `src/infrastructure/config.ts`

**Interfaces:**

- Produces: `chunkMarkdown(markdown: string): DocumentChunkDraft[]`.
- Produces: `EmbeddingPort.embed(texts: string[]): Promise<ServiceResult<number[][]>>`.

- [x] **Step 1: Write failing chunker tests**

Assert headings remain attached, no chunk exceeds 4,000 characters except one indivisible paragraph, overlap is at most 400 characters, empty input returns no chunks, and repeated execution is deeply equal.

```typescript
expect(chunkMarkdown(markdown)).toEqual(chunkMarkdown(markdown));
expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1, 2]);
expect(chunks[0].locator).toEqual({ startChar: 0, endChar: expect.any(Number) });
```

- [x] **Step 2: Implement chunk contract and chunker**

```typescript
export interface DocumentChunkDraft {
  chunkIndex: number;
  headingPath: string[];
  content: string;
  locator: { startChar: number; endChar: number };
}

export function chunkMarkdown(
  markdown: string,
  options = { maxChars: 4000, overlapChars: 400 }
): DocumentChunkDraft[];
```

Split on Markdown headings and blank-line paragraphs. Track heading stack by heading level. Fill chunks in order; carry only trailing text up to `overlapChars` into next chunk.

- [x] **Step 3: Write failing embedding adapter tests**

Mock `fetch`. Assert one request to `/v1/embeddings`, model `text-embedding-3-small`, input order preserved, non-2xx responses return `EMBEDDING_FAILED`, and every vector has 1536 numbers.

- [x] **Step 4: Implement embedding port and adapter**

```typescript
export interface EmbeddingPort {
  readonly model: string;
  readonly dimensions: number;
  embed(texts: string[]): Promise<ServiceResult<number[][]>>;
}
```

Use native `fetch`; add no SDK dependency. Read `EMBEDDING_API_KEY`, optional `EMBEDDING_API_URL` defaulting to `https://api.openai.com/v1`, and fixed model from config. Batch at 64 texts.

- [x] **Step 5: Run focused tests**

Run: `npm run test:unit -- src/core/business-context/document-chunk.test.ts src/infrastructure/business-context/openai-embedding.adapter.test.ts`

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/business-context/embedding.port.ts src/core/business-context/document-chunk.ts src/core/business-context/document-chunk.test.ts src/infrastructure/business-context/openai-embedding.adapter.ts src/infrastructure/business-context/openai-embedding.adapter.test.ts src/infrastructure/config.ts
git commit -m "feat: chunk and embed document markdown"
```

### Task 4: Persist Processed Documents And Chunks

**Files:**

- Modify: `src/core/business-context/types/entities.ts`
- Modify: `src/core/business-context/repository/source.port.ts`
- Modify: `src/infrastructure/business-context/repository/source.repository.ts`
- Modify: `src/infrastructure/business-context/supabase.repository.ts`
- Test: `src/infrastructure/business-context/repository/source.repository.test.ts`

**Interfaces:**

- Produces: `replaceDocumentChunks(workspaceId, businessId, documentId, chunks)`.
- Produces: expanded `updateSourceDocument(...)` supporting processed fields.

- [x] **Step 1: Write failing repository tests**

Test chunk rows include all ownership columns, vectors, model, heading path, and locator. Test replacement deletes only target document chunks. Test document update cannot cross workspace.

- [x] **Step 2: Add chunk entity and repository methods**

```typescript
export interface DocumentChunk {
  id: string;
  workspaceId: string;
  businessId: string;
  sourceDocumentId: string;
  chunkIndex: number;
  headingPath: string[];
  content: string;
  locator: Record<string, JsonValue>;
  embedding: number[];
  embeddingModel: string;
  createdAt: Date;
}
```

`replaceDocumentChunks` must set document status to `processing`, delete rows scoped by `workspace_id` and `source_document_id`, insert complete batch, then caller marks document `indexed`. Retrieval excludes documents not indexed, so interrupted replacements are invisible and retryable.

- [x] **Step 3: Expand document update allowlist**

Allow only `processedStoragePath`, `processingStatus`, `embeddingModel`, `indexedAt`, `contentText`, `pageOrSlideCount`, `parserName`, `parserVersion`, and `metadata` in addition to existing fields.

- [x] **Step 4: Run repository tests**

Run: `npm run test:unit -- src/infrastructure/business-context/repository/source.repository.test.ts`

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/core/business-context/types/entities.ts src/core/business-context/repository/source.port.ts src/infrastructure/business-context/repository/source.repository.ts src/infrastructure/business-context/supabase.repository.ts src/infrastructure/business-context/repository/source.repository.test.ts
git commit -m "feat: persist processed document chunks"
```

### Task 5: Repair Single-Job Upload Processing Pipeline

**Files:**

- Create: `src/core/business-context/service/uploaded-document.processor.ts`
- Create: `src/core/business-context/service/uploaded-document.processor.test.ts`
- Modify: `src/core/business-context/service/source-processing.service.ts:62-626`
- Modify: `src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts`
- Modify: `src/di/providers/business-context.ts:137-226`
- Modify: `src/core/business-context/service/upload.service.ts:294-434`
- Test: `src/core/business-context/service/source-processing.pipeline.test.ts`
- Test: `tests/contract/business-context/uploads-completion.test.ts`

**Interfaces:**

- Consumes: existing job input `{ sourceId: string, documentId: string }`.
- Produces: one indexed `source_documents` row and existing reconciled facts with document provenance.

- [x] **Step 1: Write failing end-to-end service test**

Given one uploaded document row, assert processor parses same row, uploads `${storagePath}.md`, stores chunks, extracts facts, and never calls `createSourceDocument`.

```typescript
expect(repo.createSourceDocument).not.toHaveBeenCalled();
expect(storage.upload).toHaveBeenCalledWith(
  expect.objectContaining({
    path: `${document.storagePath}.md`,
    contentType: 'text/markdown; charset=utf-8',
    upsert: true,
  })
);
expect(repo.updateSourceDocument).toHaveBeenCalledWith(
  workspaceId,
  document.id,
  expect.objectContaining({ processingStatus: 'indexed' })
);
```

- [x] **Step 2: Implement uploaded processor in one linear method**

Order must be: validate job/document ownership; return success if already indexed with same model; mark processing; parse original; upload deterministic Markdown with upsert; chunk; embed; replace chunks; update same document; extract facts; reconcile; run quality gates; mark source complete. On error mark document failed and rethrow service error for existing job retry policy. Do not create another job or processing run.

- [x] **Step 3: Route upload jobs before adapter collection**

In `SourceProcessingService.processSource`, read `documentId` from `options.job.input`. If present, call uploaded processor. Otherwise retain website/manual adapter path. Remove timestamp-based nested job creation from worker-owned execution path.

- [x] **Step 4: Preserve fact provenance**

Replace flattened `ExtractedFact[]` with document-bound values:

```typescript
const extractedWithSource = extractionResult.data.facts.map((fact) => ({
  fact,
  sourceDocumentId: document.id,
}));
```

Set `PersistFactReconciliationCreate.sourceDocumentId` from wrapper. Add matching chunk ID to existing `evidenceLocator` JSON by locating chunk containing `sourceExcerpt`; retain extractor locator when no exact match exists.

- [x] **Step 5: Keep Meta out of document indexing**

Do not send `SourceType.META` through uploaded processor. Keep current SQL sync. Remove metric-generated documents from extraction path only after retrieval task consumes Meta repository directly.

- [x] **Step 6: Run pipeline tests**

Run: `npm run test:unit -- src/core/business-context/service/uploaded-document.processor.test.ts src/core/business-context/service/source-processing.pipeline.test.ts && npm run test:contract -- tests/contract/business-context/uploads-completion.test.ts`

Expected: PASS; duplicate upload reuses existing document and deterministic job.

- [x] **Step 7: Commit**

```bash
git add src/core/business-context/service/uploaded-document.processor.ts src/core/business-context/service/uploaded-document.processor.test.ts src/core/business-context/service/source-processing.service.ts src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts src/di/providers/business-context.ts src/core/business-context/service/upload.service.ts src/core/business-context/service/source-processing.pipeline.test.ts tests/contract/business-context/uploads-completion.test.ts
git commit -m "fix: process uploads through one document pipeline"
```

### Task 6: Add Hybrid Retrieval With Structured Meta Metrics

**Files:**

- Create: `src/core/business-context/retrieval.port.ts`
- Create: `src/core/business-context/service/retrieval.service.ts`
- Create: `src/core/business-context/service/retrieval.service.test.ts`
- Create: `src/infrastructure/business-context/retrieval.repository.ts`
- Create: `src/infrastructure/business-context/retrieval.repository.test.ts`
- Create: `src/app/api/businesses/[id]/context/search/route.ts`
- Create: `src/app/api/businesses/[id]/context/search/route.test.ts`
- Modify: `src/di/providers/business-context.ts`
- Modify: `src/infrastructure/business-context/meta/meta-adapter.ts`

**Interfaces:**

- Produces: `retrieveBusinessContext({ workspaceId, businessId, query, purpose, limit }): RetrievedBusinessContext`.
- Produces: authenticated `POST /api/businesses/:id/context/search` with `{ query, purpose, limit? }`.

- [x] **Step 1: Write failing retrieval service tests**

Assert result contains current profile version, active facts, cited chunk matches, and separate `metaMetrics`. Assert no Meta metric value appears in `evidenceChunks` unless it came from non-Meta uploaded content.

```typescript
expect(result.data).toMatchObject({
  businessContextVersionId: 'version-1',
  evidenceChunks: [expect.objectContaining({ sourceDocumentId: 'doc-1' })],
  metaMetrics: expect.any(Object),
});
```

- [x] **Step 2: Define retrieval contract**

```typescript
export interface RetrievalPort {
  hybridSearch(input: {
    workspaceId: string;
    businessId: string;
    query: string;
    queryEmbedding: number[];
    limit: number;
  }): Promise<ServiceResult<RetrievedChunk[]>>;
}
```

Each `RetrievedChunk` includes chunk/document/source IDs, title, content, heading path, locator, and score.

- [x] **Step 3: Implement RPC repository and service**

Embed query once, call `hybrid_search_document_chunks`, load current profile and active facts through existing repository, and load Meta campaigns/ads/daily insights through `SupabaseMetaRepository`. Keep four result sections distinct: `profile`, `facts`, `evidenceChunks`, `metaMetrics`.

- [x] **Step 4: Implement authenticated route**

Reuse existing business-to-workspace authorization helper. Validate with Zod: non-empty query up to 2,000 characters, valid purpose, limit integer 1-20 default 8. Never accept workspace ID from request body.

- [x] **Step 5: Stop generating Meta metric evidence documents**

Change `MetaSourceAdapter` so metric synchronization remains SQL-only. If descriptive creative text remains useful, index it only through an explicitly non-metric source document; do not serialize spend, impressions, clicks, conversions, or derived ratios into chunks.

- [x] **Step 6: Run retrieval and route tests**

Run: `npm run test:unit -- src/core/business-context/service/retrieval.service.test.ts src/infrastructure/business-context/retrieval.repository.test.ts && npm run test:contract -- src/app/api/businesses/[id]/context/search/route.test.ts`

Expected: PASS, including cross-business and unauthorized requests.

- [x] **Step 7: Commit**

```bash
git add src/core/business-context/retrieval.port.ts src/core/business-context/service/retrieval.service.ts src/core/business-context/service/retrieval.service.test.ts src/infrastructure/business-context/retrieval.repository.ts src/infrastructure/business-context/retrieval.repository.test.ts src/app/api/businesses/[id]/context/search src/di/providers/business-context.ts src/infrastructure/business-context/meta/meta-adapter.ts
git commit -m "feat: retrieve cited business evidence"
```

### Task 7: Remove PaddleOCR And Native Parser Paths

**Files:**

- Delete: `workers/paddleocr/`
- Delete: `src/infrastructure/business-context/paddleocr-document-parser.adapter.ts`
- Delete: `src/infrastructure/business-context/paddleocr-document-parser.adapter.test.ts`
- Delete: `src/infrastructure/business-context/native-document.parser.adapter.ts`
- Delete: `src/infrastructure/business-context/parsers/`
- Delete: `src/infrastructure/business-context/document-parser-router.ts`
- Delete: `tests/unit/business-context/document-parser-router.test.ts`
- Delete: `tests/unit/business-context/native-document.parser.adapter.test.ts`
- Modify: `src/di/providers/business-context.ts`
- Modify: `src/core/business-context/types/enums.ts:198-204`
- Modify: `src/infrastructure/config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `docs/testing.md`
- Modify: `PRD/006_business_context_supabase_prd.md`

**Interfaces:**

- Produces: `getDocumentParser()` returns only `DoclingDocumentParserAdapter`.

- [x] **Step 1: Switch DI to Docling only**

Remove router/native/Paddle imports. Instantiate Docling adapter with source bucket, Python binary, converter path, timeout, and storage dependency.

- [x] **Step 2: Remove active legacy code and configuration**

Delete runtime files and tests listed above. Remove `PADDLEOCR_WORKER_MODE`, `PADDLEOCR_VL_ENABLED`, and `PADDLEOCR_WORKER_URL`. Remove `native_parser` and `paddleocr` from `Provider`; add `docling`.

- [x] **Step 3: Remove obsolete Node parser dependencies**

Run: `npm uninstall mammoth pdf-parse xlsx jszip html-to-text`

Expected: `package.json` and `package-lock.json` no longer contain those packages unless another live import remains. If a live non-parser import remains, keep only its required package and document that use in commit body.

- [x] **Step 4: Update current docs without rewriting history**

Replace Paddle worker commands in `docs/testing.md` with `.venv-docling/bin/pytest workers/document-processing/tests -q`. In historical PRD, retain original text and add one supersession note pointing to this plan rather than rewriting old acceptance criteria.

- [x] **Step 5: Verify no active references remain**

Run indexed search for `PADDLEOCR|paddleocr|NativeDocumentParser|DocumentParserRouter|native_parser` excluding historical PRDs. Expected: zero runtime/config/test matches.

- [x] **Step 6: Run full static and test verification**

Run: `npm run lint && npm run build && npm run test:all && .venv-docling/bin/pytest workers/document-processing/tests -q`

Expected: all commands exit 0.

- [x] **Step 7: Commit**

```bash
git add -A workers/paddleocr workers/document-processing src/infrastructure/business-context src/core/business-context src/di/providers/business-context.ts package.json package-lock.json docs/testing.md PRD/006_business_context_supabase_prd.md
git commit -m "refactor: replace legacy parsers with docling"
```

### Task 8: Add Representative Integration Coverage And Rollout Guard

**Files:**

- Create: `tests/fixtures/documents/sample.html`
- Create: `tests/fixtures/documents/sample.pdf`
- Create: `tests/integration/business-context/docling-upload-pipeline.integration.test.ts`
- Create: `tests/integration/business-context/hybrid-retrieval.integration.test.ts`
- Modify: `tests/integration/business-context/full-pipeline.integration.test.ts`
- Modify: `docs/testing.md`
- Modify: `.env.example`

**Interfaces:**

- Verifies public upload, worker, storage, database, extraction, and retrieval contracts together.

- [x] **Step 1: Add small owned fixtures**

Fixtures must contain known headings, body text, one table, and one citation phrase. Keep each under 100 KB and document source/license in `tests/fixtures/documents/README.md`.

- [x] **Step 2: Write upload-pipeline integration test**

Run real local Docling against fixtures. Mock only embedding and LLM network calls. Assert one source document, one original object, one Markdown object, non-empty chunks, parser `docling`, indexed status, facts linked to source document, and no temporary directory after completion.

- [x] **Step 3: Write hybrid-retrieval integration test**

Seed deterministic vectors. Assert lexical-only phrase and semantic-neighbor query both return expected chunk, citations resolve to document, another workspace returns no rows, and Meta metric response equals seeded Meta SQL rows.

- [x] **Step 4: Add rollout configuration**

Document required values:

```dotenv
DOCLING_PYTHON_PATH=.venv-docling/bin/python
DOCLING_TIMEOUT_MS=180000
EMBEDDING_API_KEY=
EMBEDDING_API_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

Use existing worker deployment switch to stop job claims during rollback; do not add a new feature-flag system. Retry skips Docling when same document already has processed path, parser version, embedding model, and indexed status.

- [x] **Step 5: Run final verification**

Run: `npm run supabase:reset && npm run lint && npm run build && npm run test:all && .venv-docling/bin/pytest workers/document-processing/tests -q`

Expected: all pass.

- [x] **Step 6: Commit**

```bash
git add tests/fixtures/documents tests/integration/business-context/docling-upload-pipeline.integration.test.ts tests/integration/business-context/hybrid-retrieval.integration.test.ts tests/integration/business-context/full-pipeline.integration.test.ts docs/testing.md .env.example
git commit -m "test: add docling pipeline integration coverage"
```

### Task 9: Add End-to-End Upload-Process-Retrieve Test

**Files:**

- Create: `tests/e2e/business-context/upload-process-retrieve.test.ts`
- Create: `tests/fixtures/documents/e2e-sample.html`

**Interfaces:**

- Verifies complete flow: upload service → job queue → Docling parse → chunk → embed → persist → retrieval.

- [x] **Step 1: Create minimal HTML fixture**

Create `tests/fixtures/documents/e2e-sample.html` with known structure:
```html
<!DOCTYPE html>
<html>
<head><title>E2E Test Document</title></head>
<body>
  <h1>Product Overview</h1>
  <p>This document describes our flagship product, the Nova Platform.</p>
  <h2>Key Features</h2>
  <p>The Nova Platform includes real-time analytics, automated reporting, and AI-powered insights.</p>
  <h2>Pricing</h2>
  <p>Starting at $99/month for teams up to 10 users.</p>
</body>
</html>
```

- [x] **Step 2: Write E2E test with real Docling and mocked embeddings**

```typescript
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client';
import { completeUploadIntent } from '@/core/business-context/service/upload.service';
import { getSourceProcessingService } from '@/di/providers/business-context';
import { getJobRunner } from '@/di/providers/business-context';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock embedding API at fetch boundary
const mockFetch = vi.fn().mockImplementation((url: string, options: any) => {
  if (url.includes('/embeddings')) {
    const body = JSON.parse(options.body);
    const vectors = body.input.map(() => Array(1536).fill(0).map((_, i) => Math.random() * 0.1 + (i % 2 === 0 ? 0.01 : -0.01)));
    return Promise.resolve({
      ok: true,
      json: async () => ({ data: vectors.map(embedding => ({ embedding })) }),
    });
  }
  return Promise.reject(new Error(`Unexpected fetch to ${url}`));
});
global.fetch = mockFetch;

describe('E2E: Upload → Process → Retrieve', () => {
  const db = getSupabaseServiceClient();
  let workspaceId: string;
  let businessId: string;
  let documentId: string;

  beforeAll(async () => {
    // Seed workspace and business
    const { data: ws } = await db.from('workspaces').insert({ name: 'E2E Workspace' }).select().single();
    workspaceId = ws.id;
    const { data: biz } = await db.from('businesses').insert({ workspace_id: workspaceId, name: 'E2E Business' }).select().single();
    businessId = biz.id;
  });

  it('processes uploaded HTML through Docling and retrieves chunks', async () => {
    // 1. Upload original file to Storage
    const fixturePath = join(process.cwd(), 'tests/fixtures/documents/e2e-sample.html');
    const fixtureBuffer = readFileSync(fixturePath);
    const storagePath = `workspaces/${workspaceId}/businesses/${businessId}/uploads/e2e-test/sample.html`;
    
    await db.storage.from('business-context-sources').upload(storagePath, fixtureBuffer, {
      contentType: 'text/html',
      upsert: true,
    });

    // 2. Create source and document rows
    const { data: source } = await db.from('context_sources').insert({
      workspace_id: workspaceId,
      business_id: businessId,
      source_type: 'product_document',
      source_name: 'E2E Test Source',
      external_reference: null,
      status: 'queued',
      current_stage: null,
      terminal_outcome: null,
      metadata: {},
      collected_at: new Date().toISOString(),
    }).select().single();

    const { data: doc } = await db.from('source_documents').insert({
      workspace_id: workspaceId,
      business_id: businessId,
      source_id: source.id,
      url: null,
      title: 'E2E Test Document',
      document_type: 'product_document',
      mime_type: 'text/html',
      file_name: 'sample.html',
      file_size_bytes: fixtureBuffer.length,
      content_text: null,
      storage_path: storagePath,
      processed_storage_path: null,
      processing_status: 'pending',
      embedding_model: null,
      indexed_at: null,
      content_hash: 'e2e-hash',
      http_status: null,
      page_or_slide_count: null,
      parser_name: null,
      parser_version: null,
      effective_at: null,
      supersedes_document_id: null,
      metadata: {},
      retrieved_at: new Date().toISOString(),
    }).select().single();
    documentId = doc.id;

    // 3. Create processing job
    const { data: job } = await db.from('context_jobs').insert({
      workspace_id: workspaceId,
      business_id: businessId,
      session_id: null,
      job_type: 'source_processing',
      status: 'queued',
      attempt_count: 0,
      max_attempts: 3,
      idempotency_key: `e2e-${Date.now()}`,
      stage: 'queued',
      input: { sourceId: source.id, documentId: doc.id },
      output: null,
      error: null,
      error_class: null,
      retry_policy: {},
      next_run_at: null,
      locked_by: null,
      locked_at: null,
      heartbeat_at: null,
      stage_timeout_seconds: 30,
      started_at: null,
      completed_at: null,
    }).select().single();

    // 4. Process via service (real Docling, mocked embeddings)
    const processor = getSourceProcessingService();
    const result = await processor.processSource(businessId, workspaceId, source.id, { job });

    expect(result.ok).toBe(true);

    // 5. Verify document updated
    const { data: updatedDoc } = await db.from('source_documents').select().eq('id', documentId).single();
    expect(updatedDoc.processing_status).toBe('indexed');
    expect(updatedDoc.processed_storage_path).toBe(`${storagePath}.md`);
    expect(updatedDoc.embedding_model).toBe('text-embedding-3-small');
    expect(updatedDoc.parser_name).toBe('docling');
    expect(updatedDoc.indexed_at).not.toBeNull();

    // 6. Verify chunks created
    const { data: chunks } = await db.from('document_chunks').select().eq('source_document_id', documentId);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c: any) => c.embedding.length === 1536)).toBe(true);
    expect(chunks.every((c: any) => c.workspace_id === workspaceId)).toBe(true);
    expect(chunks.every((c: any) => c.business_id === businessId)).toBe(true);

    // 7. Verify Markdown artifact uploaded
    const { data: mdFile, error: mdError } = await db.storage.from('business-context-sources').download(`${storagePath}.md`);
    expect(mdError).toBeNull();
    expect(mdFile).toBeTruthy();
    const mdText = await mdFile!.text();
    expect(mdText).toContain('Product Overview');
    expect(mdText).toContain('Nova Platform');

    // 8. Verify retrieval works
    const { data: searchResults } = await db.rpc('hybrid_search_document_chunks', {
      query_text: 'Nova Platform features',
      query_embedding: Array(1536).fill(0.05),
      match_workspace_id: workspaceId,
      match_business_id: businessId,
      match_count: 5,
    });
    expect(searchResults.length).toBeGreaterThan(0);
    expect(searchResults[0].source_document_id).toBe(documentId);
  });
});
```

- [x] **Step 3: Run E2E test**

Run: `npm run supabase:reset && npm run test:e2e -- tests/e2e/business-context/upload-process-retrieve.test.ts`

Expected: PASS; verifies full flow with real Docling subprocess, real Supabase, mocked embeddings.

- [x] **Step 4: Commit**

```bash
git add tests/e2e/business-context/upload-process-retrieve.test.ts tests/fixtures/documents/e2e-sample.html
git commit -m "test: add e2e upload-process-retrieve flow"
```

Expected: all commands exit 0; integration assertions confirm artifact count, idempotency, citations, RLS, and structured Meta metrics.

- [x] **Step 6: Commit**

```bash
git add tests/fixtures/documents tests/integration/business-context docs/testing.md .env.example
git commit -m "test: cover docling retrieval pipeline"
```

## Rollout And Rollback

1. Deploy additive migration first.
2. Build worker image with Node, Python 3.10+, and pinned Docling environment.
3. Deploy worker with job polling stopped; run one fixture smoke test in target environment.
4. Enable worker for one workspace and inspect Markdown, chunk count, citation links, processing latency, and memory.
5. Enable remaining workspaces. Existing unprocessed rows can be requeued using deterministic `source_processing` jobs; no separate backfill framework is added.
6. Roll back by stopping worker polling and disabling retrieval route deployment. Originals, processed Markdown, chunks, facts, and profile versions remain intact; no down migration or destructive column removal is required.

## Acceptance Criteria

- Uploaded PDF, DOCX, PPTX, XLSX, HTML, and supported images process through local Docling without HTTP service.
- One upload owns one `source_documents` row and exactly two Storage objects: original plus Markdown.
- Retry creates no duplicate document, artifact, chunk, or fact.
- Worker always deletes temporary files.
- Hybrid search combines lexical and vector relevance under workspace/business scope.
- Every returned evidence chunk includes resolvable document and locator metadata.
- Extracted facts preserve source-document provenance and chunk citation when excerpt matches.
- Meta Ads metrics come from SQL, never embedded snapshots.
- Facts, conflicts, verification, and profile-version tests continue passing.
- PaddleOCR and native-parser runtime paths are absent.
- Full lint, build, TypeScript tests, RLS tests, integration tests, and Python tests pass.
