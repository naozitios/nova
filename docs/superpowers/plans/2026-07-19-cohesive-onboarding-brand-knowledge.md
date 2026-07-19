# Cohesive Onboarding Brand Knowledge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make website pages, uploaded documents, and user answers feed one canonical evidence and fact pipeline whose compiled result is shown in onboarding instead of mock business context.

**Architecture:** Keep crawler responsible for page discovery and rendered HTML retrieval. Normalize crawler HTML and uploaded files through Docling, then run both through shared Markdown artifact, chunking, embedding, extraction, reconciliation, quality-gate, and question-lifecycle services. Expose canonical compiled profile through one onboarding review endpoint and render that response in existing onboarding UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Docling Python subprocess, Firecrawl, Supabase Storage/Postgres, pgvector, OpenAI-compatible embeddings, Vitest, agent-browser verification.

## Global Constraints

- Supabase remains system of record for sources, documents, chunks, facts, conflicts, questions, and profile versions.
- Firecrawl remains crawler; Docling never performs site discovery, robots handling, redirect validation, or page budgeting.
- Website adapter must request rendered HTML. Never label Markdown as `text/html` to force Docling parsing.
- Every website page and uploaded file produces one canonical Markdown artifact, deterministic chunks, embeddings, and extracted facts.
- One `source_processing` job owns normalization, indexing, extraction, reconciliation, quality gates, and question lifecycle.
- User-verified facts remain authoritative. Conflicting inferred facts create conflicts and never overwrite user answers.
- Keep existing `document_chunks` schema and `hybrid_search_document_chunks` RPC; no migration is required.
- Keep normalized Meta metrics outside document embeddings.
- Retries must replace chunks and upsert deterministic Markdown artifacts without duplicates.
- Docling failure fails affected source document processing; no silent passthrough parser fallback.
- Website page URL must survive in source document metadata and every chunk locator for citations.
- Backend profile is canonical section-keyed data using `REQUIRED_PROFILE_SECTIONS`; frontend must not invent a second profile schema.
- Remove mock onboarding data only from live page path after backend endpoint and E2E coverage pass.
- Each implementation task is limited to one production seam plus its focused test; do not combine adjacent tasks.

## File Map

- `src/core/business-context/service/canonical-document-indexer.ts`: shared Markdown artifact, chunk, embed, and document-update service.
- `src/core/business-context/service/source-fact-pipeline.ts`: shared extraction, reconciliation, fact gates, and question lifecycle.
- `src/core/business-context/service/uploaded-document.processor.ts`: Docling parse for uploaded file, then shared index and fact services.
- `src/core/business-context/service/source-processing.service.ts`: source job orchestration; website HTML normalization and shared services.
- `src/core/business-context/source-adapter.port.ts`: collected page raw-content contract.
- `src/infrastructure/business-context/website-source.adapter.ts`: Firecrawl HTML plus Markdown collection.
- `src/di/providers/business-context.ts`: shared service wiring.
- `src/core/business-context/onboarding-review.ts`: canonical onboarding review response assembly.
- `src/app/api/businesses/[id]/onboarding/review/route.ts`: authenticated review endpoint.
- `src/lib/onboarding/api.ts`: typed browser API client.
- `src/lib/onboarding/profile-view.ts`: deterministic canonical-section presentation mapper.
- `src/components/onboarding/BusinessContextReview.tsx`: canonical profile renderer.
- `src/app/onboarding/[businessId]/page.tsx`: live review fetch and state integration.
- `tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts`: website and upload backend acceptance.

---

### Task 1: Extract Shared Canonical Document Indexer

**Files:**
- Create: `src/core/business-context/service/canonical-document-indexer.ts`
- Create: `src/core/business-context/service/canonical-document-indexer.test.ts`

**Interfaces:**
- Consumes: `RepositoryPort`, `UploadStoragePort`, `EmbeddingPort`, `chunkMarkdown(markdown)`.
- Produces: `CanonicalDocumentIndexer.index(input): Promise<ServiceResult<{ chunkCount: number }>>`.

- [ ] **Step 1: Write failing unit tests**

Cover deterministic artifact upload, heading-aware chunking, embedding, locator enrichment, chunk replacement, document update, and failed status on upload/embed/persistence error.

```typescript
const result = await indexer.index({
  workspaceId: 'w1',
  businessId: 'b1',
  documentId: 'd1',
  markdown: '# Pricing\nStarter is $49.',
  processedStoragePath: 'workspaces/w1/businesses/b1/sources/s1/documents/d1.md',
  parserName: 'docling',
  parserVersion: '2.70.0',
  pageOrSlideCount: 1,
  baseLocator: { url: 'https://example.com/pricing' },
})

expect(result).toEqual({ ok: true, data: { chunkCount: 1 } })
expect(repo.replaceDocumentChunks).toHaveBeenCalledWith(
  'w1',
  'b1',
  'd1',
  expect.arrayContaining([
    expect.objectContaining({ locator: expect.objectContaining({ url: 'https://example.com/pricing' }) }),
  ]),
)
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/canonical-document-indexer.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement indexer**

```typescript
export interface CanonicalDocumentIndexInput {
  workspaceId: string
  businessId: string
  documentId: string
  markdown: string
  processedStoragePath: string
  parserName: string
  parserVersion: string
  pageOrSlideCount: number | null
  baseLocator?: Record<string, JsonValue>
}

export class CanonicalDocumentIndexer {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly storage: UploadStoragePort,
    private readonly embedder: EmbeddingPort,
  ) {}

  async index(input: CanonicalDocumentIndexInput): Promise<ServiceResult<{ chunkCount: number }>> {
    // Mark processing, upload Markdown with upsert, chunk, embed, merge baseLocator,
    // replace chunks, then set indexed fields. On any failure set processingStatus='failed'.
  }
}
```

Artifact upload must use bucket `business-context-sources`, content type `text/markdown; charset=utf-8`, and `upsert: true`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `npm run test:unit -- src/core/business-context/service/canonical-document-indexer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/canonical-document-indexer.ts src/core/business-context/service/canonical-document-indexer.test.ts
git commit -m "refactor: extract canonical document indexer"
```

---

### Task 2: Refactor Upload Indexing Onto Shared Indexer

**Files:**
- Modify: `src/core/business-context/service/uploaded-document.processor.ts`
- Modify: `src/core/business-context/service/uploaded-document.processor.test.ts`

**Interfaces:**
- Consumes: `CanonicalDocumentIndexer` from Task 1.
- Produces: unchanged `UploadedDocumentProcessor.process()` behavior and return shape.

- [ ] **Step 1: Update test constructor and assert delegation**

```typescript
const indexer = { index: vi.fn().mockResolvedValue({ ok: true, data: { chunkCount: 2 } }) }
const processor = new UploadedDocumentProcessor(repo, parser, indexer as never)

expect(indexer.index).toHaveBeenCalledWith(expect.objectContaining({
  documentId: 'doc-1',
  markdown: '# Brand',
  processedStoragePath: 'uploads/doc-1.pdf.md',
  parserName: 'docling',
}))
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/uploaded-document.processor.test.ts`

Expected: FAIL because constructor and index delegation are not implemented.

- [ ] **Step 3: Replace inline upload/chunk/embed block**

Constructor becomes:

```typescript
constructor(
  private readonly repo: RepositoryPort,
  private readonly parser: DocumentParserPort,
  private readonly indexer: CanonicalDocumentIndexer,
) {}
```

After Docling parse, call `indexer.index()` with `processedStoragePath: `${doc.storagePath}.md``. Remove direct `UploadStoragePort`, `EmbeddingPort`, and `chunkMarkdown` dependencies.

- [ ] **Step 4: Run focused test and existing Docling units**

Run: `npm run test:unit -- src/core/business-context/service/uploaded-document.processor.test.ts src/infrastructure/business-context/docling-document-parser.adapter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/uploaded-document.processor.ts src/core/business-context/service/uploaded-document.processor.test.ts
git commit -m "refactor: share upload document indexing"
```

---

### Task 3: Extract Shared Source Fact Pipeline

**Files:**
- Create: `src/core/business-context/service/source-fact-pipeline.ts`
- Create: `src/core/business-context/service/source-fact-pipeline.test.ts`

**Interfaces:**
- Consumes: `RepositoryPort`, `ExtractionPort`, `resolveFacts`, `runFactGates`, `computeQuestionLifecycle`.
- Produces: `SourceFactPipeline.process(input): Promise<ServiceResult<{ factsExtracted: number }>>`.

- [ ] **Step 1: Write failing reconciliation tests**

Test extraction from every document, `sourceDocumentId` provenance, user-verified conflict preservation, atomic `persistFactReconciliation`, quality gates, and question creation when `sessionId` exists.

```typescript
const result = await pipeline.process({
  workspaceId: 'w1',
  businessId: 'b1',
  sourceId: 's1',
  sourceType: SourceType.UPLOAD,
  runId: 'run-1',
  sessionId: 'session-1',
  documents: [{
    sourceDocumentId: 'd1',
    contentText: '# Offer\nStarter plan',
    parserName: 'docling',
  }],
})

expect(repo.persistFactReconciliation).toHaveBeenCalledWith(
  'w1',
  'b1',
  expect.any(Array),
  expect.arrayContaining([expect.objectContaining({ sourceDocumentId: 'd1' })]),
  expect.any(Array),
)
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/source-fact-pipeline.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement fact pipeline**

```typescript
export interface SourceFactDocument {
  sourceDocumentId: string
  contentText: string
  parserName: string
}

export interface SourceFactPipelineInput {
  workspaceId: string
  businessId: string
  sourceId: string
  sourceType: SourceType
  runId: string | null
  sessionId: string | null
  documents: SourceFactDocument[]
}

export class SourceFactPipeline {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly extraction: ExtractionPort,
  ) {}

  async process(input: SourceFactPipelineInput): Promise<ServiceResult<{ factsExtracted: number }>> {
    // Extract each document, retain sourceDocumentId beside each fact, reconcile by normalized key,
    // persist atomically, run fact gates when runId exists, and apply question lifecycle.
  }
}
```

Port existing behavior from `SourceProcessingService` lines 459-657. Include `sourceDocumentId` in each `PersistFactReconciliationCreate`; preserve special Meta conflict behavior.

- [ ] **Step 4: Run fact pipeline and resolver tests**

Run: `npm run test:unit -- src/core/business-context/service/source-fact-pipeline.test.ts tests/unit/business-context/resolver.test.ts tests/unit/business-context/resolver.b12.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/source-fact-pipeline.ts src/core/business-context/service/source-fact-pipeline.test.ts
git commit -m "refactor: extract shared source fact pipeline"
```

---

### Task 4: Move Existing Website Fact Work Onto Shared Pipeline

**Files:**
- Modify: `src/core/business-context/service/source-processing.service.ts`
- Modify: `src/core/business-context/service/source-processing.pipeline.test.ts`

**Interfaces:**
- Consumes: `SourceFactPipeline` from Task 3.
- Produces: website extraction behavior unchanged, with document-level fact provenance fixed.

- [ ] **Step 1: Add delegation regression test**

Construct service with a mocked `SourceFactPipeline`; process a website source; assert persisted documents are passed to one batch call and `factsExtracted` updates processing run.

```typescript
expect(factPipeline.process).toHaveBeenCalledWith(expect.objectContaining({
  sourceType: SourceType.WEBSITE,
  documents: [expect.objectContaining({ sourceDocumentId: 'doc-1' })],
}))
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/source-processing.pipeline.test.ts`

Expected: FAIL because service still owns inline extraction/reconciliation.

- [ ] **Step 3: Replace inline extraction/reconciliation block**

Add `SourceFactPipeline` constructor dependency. Keep document persistence and document quality gates in orchestrator. Collect persisted document inputs, call `factPipeline.process()` once, and delete moved reconciliation/gate/question code plus unused imports.

- [ ] **Step 4: Run all source-processing units**

Run: `npm run test:unit -- src/core/business-context/service/source-processing.*.test.ts`

Expected: PASS with existing terminal statuses, warnings, and counters unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/source-processing.service.ts src/core/business-context/service/source-processing.pipeline.test.ts
git commit -m "refactor: share website fact processing"
```

---

### Task 5: Extract Facts From Uploaded Documents

**Files:**
- Modify: `src/core/business-context/service/uploaded-document.processor.ts`
- Modify: `src/core/business-context/service/uploaded-document.processor.test.ts`

**Interfaces:**
- Consumes: `SourceFactPipeline` from Task 3.
- Produces: `process()` accepts optional `runId` and `sessionId`; returned status includes indexed and reconciled document.

- [ ] **Step 1: Write failing upload fact test**

```typescript
await processor.process({
  workspaceId: 'w1',
  businessId: 'b1',
  sourceId: 's1',
  documentId: 'd1',
  runId: 'run-1',
  sessionId: 'session-1',
})

expect(factPipeline.process).toHaveBeenCalledWith(expect.objectContaining({
  sourceType: SourceType.UPLOAD,
  runId: 'run-1',
  sessionId: 'session-1',
  documents: [{ sourceDocumentId: 'd1', contentText: '# Brand', parserName: 'docling' }],
}))
```

Also assert extraction failure marks document failed and returns error rather than reporting indexed success.

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/uploaded-document.processor.test.ts`

Expected: FAIL because upload processor never invokes fact pipeline.

- [ ] **Step 3: Add fact pipeline dependency and call**

Add `SourceFactPipeline` as fourth constructor parameter. After successful indexing, call it with one canonical Markdown document. `runId` and `sessionId` remain optional on direct processor calls; pass `null` to fact pipeline when absent. Keep idempotency only when both indexing and fact processing are complete; merge `factsProcessed: true` into existing document metadata after success so old indexed rows receive extraction on retry.

- [ ] **Step 4: Run focused tests**

Run: `npm run test:unit -- src/core/business-context/service/uploaded-document.processor.test.ts src/core/business-context/service/source-fact-pipeline.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/uploaded-document.processor.ts src/core/business-context/service/uploaded-document.processor.test.ts
git commit -m "feat: extract facts from uploaded documents"
```

---

### Task 6: Extend Collected Document Raw-Content Contract

**Files:**
- Modify: `src/core/business-context/source-adapter.port.ts`

**Interfaces:**
- Produces: optional `rawContent` and `rawMimeType` used before canonical normalization.

- [ ] **Step 1: Add explicit raw-content fields**

```typescript
export interface CollectedDocument {
  url?: string
  title?: string
  contentText: string
  rawContent?: string
  rawMimeType?: string
  mimeType?: string
  // existing fields remain unchanged
}
```

Document that `contentText` is crawler fallback/display content, while `rawContent` is parser input. Do not rename existing fields.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: no new errors outside pre-existing `.next/dev` generated types.

- [ ] **Step 3: Commit**

```bash
git add src/core/business-context/source-adapter.port.ts
git commit -m "feat: carry raw source document content"
```

---

### Task 7: Crawl Website Pages With Rendered HTML

**Files:**
- Modify: `src/infrastructure/business-context/website-source.adapter.ts`
- Modify: `src/infrastructure/business-context/website-source.adapter.test.ts`

**Interfaces:**
- Consumes: raw-content fields from Task 6.
- Produces: bounded multi-page Firecrawl v2 crawl where every collected page includes `rawContent: html`, `rawMimeType: 'text/html'`.

- [ ] **Step 1: Write failing Firecrawl crawl tests**

Mock `POST /v2/crawl` returning `{ id: 'crawl-1' }`, then `GET /v2/crawl/crawl-1` returning `status: 'scraping'` followed by `status: 'completed'`. Include two pages with both `markdown` and `html`; assert both pages survive and HTML remains separate.

```typescript
expect(result.data.documents[0]).toMatchObject({
  contentText: '# Pricing',
  rawContent: '<html><body><h1>Pricing</h1></body></html>',
  rawMimeType: 'text/html',
  mimeType: 'text/html',
})
```

Add failure assertion for successful Firecrawl response missing HTML: `FIRECRAWL_HTML_MISSING`.
Add assertions for failed/cancelled crawl, timeout while polling, non-2xx status, `next` result-page pagination, and `limit` forwarding from `maxPages`.

- [ ] **Step 2: Run adapter test and verify RED**

Run: `npm run test:unit -- src/infrastructure/business-context/website-source.adapter.test.ts`

Expected: FAIL because response types and collected documents omit HTML.

- [ ] **Step 3: Start, poll, and collect Firecrawl v2 crawl**

Replace single-page `POST https://api.firecrawl.dev/v1/scrape` with:

```json
{
  "url": "https://example.com",
  "limit": 30,
  "scrapeOptions": {
    "formats": ["markdown", "html"],
    "onlyMainContent": true
  }
}
```

Start with `POST https://api.firecrawl.dev/v2/crawl`; accept documented start ID as `id` and tolerate legacy `jobId` only in response parsing. Poll `GET https://api.firecrawl.dev/v2/crawl/{id}` until `completed`, `failed`, or `cancelled`, using same overall `AbortController` deadline rather than resetting timeout per poll. Follow authenticated same-origin `next` URLs until absent. Extend page response with `html?: string`; derive URL and status from `metadata.sourceURL`/`metadata.url` and `metadata.statusCode`. Preserve sanitized Markdown as `contentText`; assign rendered HTML to raw fields. Reject any accepted page without non-empty HTML instead of pretending Markdown is HTML.

- [ ] **Step 4: Run website adapter tests**

Run: `npm run test:unit -- src/infrastructure/business-context/website-source*.test.ts`

Expected: PASS, including SSRF, robots, redirects, budgets, and dedupe tests.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/business-context/website-source.adapter.ts src/infrastructure/business-context/website-source.adapter.test.ts
git commit -m "feat: collect rendered website html"
```

---

### Task 8: Normalize And Index Website Pages With Docling

**Files:**
- Modify: `src/core/business-context/service/source-processing.service.ts`
- Modify: `src/core/business-context/service/source-processing.processing.test.ts`

**Interfaces:**
- Consumes: `DocumentParserPort`, `CanonicalDocumentIndexer`, collected raw HTML.
- Produces: website source documents with Docling Markdown, parser metadata, Markdown artifact, chunks, embeddings, and URL locators.

- [ ] **Step 1: Write failing website normalization test**

```typescript
expect(parser.parseContent).toHaveBeenCalledWith({
  content: Buffer.from('<html><h1>Pricing</h1></html>'),
  mimeType: 'text/html',
  fileName: 'pricing.html',
})
expect(indexer.index).toHaveBeenCalledWith(expect.objectContaining({
  markdown: '# Pricing',
  baseLocator: { url: 'https://example.com/pricing' },
  parserName: 'docling',
}))
```

Assert `createSourceDocument` receives canonical Markdown and `parserName: 'docling'`. Assert parser failure ends source processing with failure and never calls extraction.

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run test:unit -- src/core/business-context/service/source-processing.processing.test.ts`

Expected: FAIL because website documents are persisted as passthrough and never indexed.

- [ ] **Step 3: Add parser and indexer orchestration**

Inject `DocumentParserPort` and `CanonicalDocumentIndexer`. For each website document:

1. Require `rawContent` and `rawMimeType`.
2. Call `parseContent()`.
3. Hash canonical Markdown, not crawler fallback text.
4. Persist source document with Docling parser metadata.
5. Use deterministic artifact path `workspaces/{workspaceId}/businesses/{businessId}/sources/{sourceId}/documents/{documentId}.md`.
6. Index with URL in `baseLocator`.
7. Pass canonical Markdown to `SourceFactPipeline`.

- [ ] **Step 4: Run source-processing tests**

Run: `npm run test:unit -- src/core/business-context/service/source-processing.*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/service/source-processing.service.ts src/core/business-context/service/source-processing.processing.test.ts
git commit -m "feat: normalize website pages with docling"
```

---

### Task 9: Wire Shared Pipeline Dependencies

**Files:**
- Modify: `src/di/providers/business-context.ts`
- Modify: `tests/integration/business-context/source-processing-wiring.integration.test.ts`

**Interfaces:**
- Consumes: indexer, fact pipeline, parser, storage, embedder, extraction service.
- Produces: singleton providers and correctly constructed upload/source processors.

- [ ] **Step 1: Write failing wiring assertions**

Exercise `getUploadedDocumentProcessor()` and `getSourceProcessingService()` with provider reset. Assert website and upload processing no longer throws constructor/dependency errors.

- [ ] **Step 2: Run wiring test and verify RED**

Run: `npm run test:integration -- tests/integration/business-context/source-processing-wiring.integration.test.ts`

Expected: FAIL because constructors changed in Tasks 2, 4, 5, and 8.

- [ ] **Step 3: Add lazy singleton providers**

```typescript
export function getCanonicalDocumentIndexer(): CanonicalDocumentIndexer {
  return _documentIndexer ??= new CanonicalDocumentIndexer(
    getBusinessContextRepository(),
    getUploadStorage(),
    getEmbeddingAdapter(),
  )
}

export function getSourceFactPipeline(): SourceFactPipeline {
  return _sourceFactPipeline ??= new SourceFactPipeline(
    getBusinessContextRepository(),
    getExtractionService(),
  )
}
```

Use these in both processors. Ensure provider reset clears both new singletons.

- [ ] **Step 4: Run wiring and DI units**

Run: `npm run test:integration -- tests/integration/business-context/source-processing-wiring.integration.test.ts && npm run test:unit -- src/di`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/di/providers/business-context.ts tests/integration/business-context/source-processing-wiring.integration.test.ts
git commit -m "feat: wire cohesive source pipeline"
```

---

### Task 10: Prove Website And Upload Backend Convergence

**Files:**
- Create: `tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts`

**Interfaces:**
- Consumes: real `SourceProcessingService`, Docling, Supabase, mocked external Firecrawl and embedding APIs.
- Produces: backend acceptance proof for both source types.

- [ ] **Step 1: Write integration test**

Seed one business with website and upload sources. Process one HTML website page and `tests/fixtures/documents/sample.pdf`. Assert:

```typescript
expect(websiteDocument.parserName).toBe('docling')
expect(uploadDocument.parserName).toBe('docling')
expect(websiteChunks.length).toBeGreaterThan(0)
expect(uploadChunks.length).toBeGreaterThan(0)
expect(websiteFacts.some((fact) => fact.sourceDocumentId === websiteDocument.id)).toBe(true)
expect(uploadFacts.some((fact) => fact.sourceDocumentId === uploadDocument.id)).toBe(true)
expect(compiled.profile).toMatchObject({ business: expect.any(Object) })
```

Also assert a conflicting inferred value does not supersede a seeded user-verified fact.

- [ ] **Step 2: Run integration test**

Run: `npm run test:integration -- tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts`

Expected: PASS when Supabase and Docling environment are available; otherwise test must skip with explicit environment reason.

- [ ] **Step 3: Commit**

```bash
git add tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts
git commit -m "test: prove cohesive brand knowledge ingestion"
```

---

### Task 11: Build Canonical Onboarding Review Service

**Files:**
- Create: `src/core/business-context/onboarding-review.ts`
- Create: `src/core/business-context/onboarding-review.test.ts`

**Interfaces:**
- Consumes: `compileDraftFromFacts`, sources, current session, open questions.
- Produces: `getOnboardingReview(repo, businessId, workspaceId): Promise<ServiceResult<OnboardingReview>>`.

- [ ] **Step 1: Write failing review assembly test**

```typescript
expect(result.data).toEqual({
  profile: expect.objectContaining({ business: expect.any(Object) }),
  unresolvedFields: expect.any(Array),
  warnings: expect.any(Array),
  sources: expect.arrayContaining([
    expect.objectContaining({ id: 'website-1', sourceType: 'website', status: 'processed' }),
  ]),
  questions: expect.arrayContaining([
    expect.objectContaining({ factKey: 'offers.pricing', status: 'open' }),
  ]),
})
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/core/business-context/onboarding-review.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement canonical response**

```typescript
export interface OnboardingReview {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
  sources: Array<Pick<ContextSource, 'id' | 'sourceType' | 'sourceName' | 'status' | 'currentStage' | 'terminalOutcome'>>
  questions: OnboardingQuestion[]
}
```

Return `NO_SESSION` when onboarding session is absent. Query only open questions. Do not flatten canonical profile into `MockCompiledProfile`.

- [ ] **Step 4: Run review and compiler tests**

Run: `npm run test:unit -- src/core/business-context/onboarding-review.test.ts tests/unit/business-context/compiler.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/onboarding-review.ts src/core/business-context/onboarding-review.test.ts
git commit -m "feat: assemble onboarding context review"
```

---

### Task 12: Expose Authenticated Onboarding Review Endpoint

**Files:**
- Create: `src/app/api/businesses/[id]/onboarding/review/route.ts`
- Create: `tests/contract/business-context/onboarding-review.test.ts`

**Interfaces:**
- Consumes: `getOnboardingReview` from Task 11.
- Produces: `GET /api/businesses/:id/onboarding/review` with snake-case transport fields.

- [ ] **Step 1: Write failing contract tests**

Cover 401 unauthenticated, 403 non-member, 404 missing business/session, and 200 response:

```typescript
expect(await response.json()).toMatchObject({
  profile: expect.any(Object),
  unresolved_fields: expect.any(Array),
  warnings: expect.any(Array),
  sources: expect.any(Array),
  questions: expect.any(Array),
})
```

- [ ] **Step 2: Run contract test and verify RED**

Run: `npm run test:contract -- tests/contract/business-context/onboarding-review.test.ts`

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement GET route**

Follow auth/workspace resolution from `src/app/api/businesses/[id]/onboarding/route.ts`. Require viewer role. Build repository from service client, call review service, and map dates/enums without altering profile values.

- [ ] **Step 4: Run contract tests**

Run: `npm run test:contract -- tests/contract/business-context/onboarding-review.test.ts tests/contract/business-context/onboarding-session.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/businesses/[id]/onboarding/review/route.ts tests/contract/business-context/onboarding-review.test.ts
git commit -m "feat: expose onboarding context review"
```

---

### Task 13: Add Typed Onboarding Review API Client

**Files:**
- Create: `src/lib/onboarding/api.ts`
- Create: `src/lib/onboarding/api.test.ts`

**Interfaces:**
- Consumes: Task 12 response.
- Produces: `fetchOnboardingReview(businessId, signal?): Promise<OnboardingReview>`.

- [ ] **Step 1: Write failing client tests**

Mock `fetch`; assert URL, abort signal, snake-case mapping, and error body handling.

```typescript
const review = await fetchOnboardingReview('business-1', controller.signal)
expect(fetch).toHaveBeenCalledWith(
  '/api/businesses/business-1/onboarding/review',
  expect.objectContaining({ signal: controller.signal }),
)
expect(review.unresolvedFields).toEqual(['offers'])
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/lib/onboarding/api.test.ts`

Expected: FAIL because client does not exist.

- [ ] **Step 3: Implement client**

Export transport types privately and map them to `OnboardingReview`. Throw `Error(message)` for non-2xx responses. Do not import server-only repository or config modules.

- [ ] **Step 4: Run test**

Run: `npm run test:unit -- src/lib/onboarding/api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/api.ts src/lib/onboarding/api.test.ts
git commit -m "feat: add onboarding review client"
```

---

### Task 14: Map Canonical Profile For Presentation

**Files:**
- Create: `src/lib/onboarding/profile-view.ts`
- Create: `src/lib/onboarding/profile-view.test.ts`

**Interfaces:**
- Consumes: section-keyed `Record<string, JsonValue>`.
- Produces: `toProfileSections(profile): ProfileViewSection[]`.

- [ ] **Step 1: Write failing deterministic mapper tests**

```typescript
expect(toProfileSections({
  business: { name: 'Nova', summary: 'Paid social studio' },
  offers: { primary: ['Audit', 'Management'] },
})).toEqual([
  {
    key: 'business',
    label: 'Business',
    fields: [
      { key: 'name', label: 'Name', value: 'Nova' },
      { key: 'summary', label: 'Summary', value: 'Paid social studio' },
    ],
  },
  expect.objectContaining({ key: 'offers', label: 'Offers' }),
])
```

Test nested objects, arrays, booleans, numbers, null omission, `_provenance` omission, and `REQUIRED_PROFILE_SECTIONS` ordering.

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/lib/onboarding/profile-view.test.ts`

Expected: FAIL because mapper does not exist.

- [ ] **Step 3: Implement pure mapper**

```typescript
export interface ProfileViewField {
  key: string
  label: string
  value: string | string[]
}

export interface ProfileViewSection {
  key: string
  label: string
  fields: ProfileViewField[]
}
```

Use humanized dotted keys. Preserve arrays as arrays. Serialize nested scalar leaves with dotted paths. Never mutate input.

- [ ] **Step 4: Run mapper test**

Run: `npm run test:unit -- src/lib/onboarding/profile-view.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onboarding/profile-view.ts src/lib/onboarding/profile-view.test.ts
git commit -m "feat: map canonical profile for onboarding"
```

---

### Task 15: Render Canonical Review Data

**Files:**
- Modify: `src/components/onboarding/BusinessContextReview.tsx`
- Create: `src/components/onboarding/BusinessContextReview.test.tsx`

**Interfaces:**
- Consumes: `OnboardingReview`, `toProfileSections`.
- Produces: existing visual card style with all canonical sections, warnings, unresolved fields, source status, and questions.

- [ ] **Step 1: Write failing server-render test**

Use `renderToStaticMarkup` from `react-dom/server`. Pass canonical business and offers sections plus website/upload sources. Assert both profile values, both source labels, open question, and warning render.

```tsx
const html = renderToStaticMarkup(
  <BusinessContextReview review={review} canApprove={true} />,
)
expect(html).toContain('Paid social studio')
expect(html).toContain('Brand guide.pdf')
expect(html).toContain('Business website')
```

- [ ] **Step 2: Run test and verify RED**

Run: `npm run test:unit -- src/components/onboarding/BusinessContextReview.test.tsx`

Expected: FAIL because component still expects `MockCompiledProfile` and `MockQuestion`.

- [ ] **Step 3: Replace mock props**

```typescript
type BusinessContextReviewProps = {
  review: OnboardingReview
  canApprove: boolean
}
```

Render each `ProfileViewSection`; render arrays as lists and scalar values as text. Keep admin approval warning. Add visible empty state when no profile sections exist. Add source labels so user can see website/upload contribution.

- [ ] **Step 4: Run component test, lint, and TypeScript validation**

Run: `npm run test:unit -- src/components/onboarding/BusinessContextReview.test.tsx && npx eslint src/components/onboarding/BusinessContextReview.tsx src/components/onboarding/BusinessContextReview.test.tsx && npx tsc --noEmit`

Expected: component lint clean; no new TypeScript errors outside pre-existing `.next/dev` generated types.

- [ ] **Step 5: Commit**

```bash
git add src/components/onboarding/BusinessContextReview.tsx src/components/onboarding/BusinessContextReview.test.tsx
git commit -m "feat: render canonical onboarding context"
```

---

### Task 16: Load Live Review In Onboarding Page

**Files:**
- Modify: `src/app/onboarding/[businessId]/page.tsx`

**Interfaces:**
- Consumes: `fetchOnboardingReview`, canonical `BusinessContextReview` props.
- Produces: live review loading, success, retry, and failure behavior.

- [ ] **Step 1: Fetch review when processing becomes ready**

Read `businessId` with `useParams<{ businessId: string }>()`. Use `useEffect`, `AbortController`, and explicit loading/error/retry state. Replace only review-step profile/questions with live response. Do not rewrite unrelated mock onboarding steps in this task. Disable approval while loading, failed, unresolved blockers exist, or processing is incomplete.

- [ ] **Step 2: Run flow, component, lint, and build checks**

Run: `npm run test:unit -- src/lib/onboarding/flow.test.ts src/lib/onboarding/api.test.ts src/components/onboarding/BusinessContextReview.test.tsx && npx eslint src/app/onboarding/[businessId]/page.tsx && npm run build`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/[businessId]/page.tsx
git commit -m "feat: show live business context in onboarding"
```

---

### Task 17: Final Cohesive Flow Verification

**Files:**
- Modify only if test defects are found: files changed in Tasks 1-16.

**Interfaces:**
- Consumes: complete cohesive pipeline.
- Produces: release evidence; no new feature behavior.

- [ ] **Step 1: Run focused unit and contract suites**

Run: `npm run test:unit -- src/core/business-context src/infrastructure/business-context src/lib/onboarding && npm run test:contract -- tests/contract/business-context`

Expected: PASS. Record pre-existing unrelated failures separately; do not weaken assertions.

- [ ] **Step 2: Run integration and E2E acceptance**

Run: `npm run test:integration -- tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts tests/integration/business-context/source-processing-wiring.integration.test.ts && npm run test:e2e -- tests/e2e/business-context/upload-process-retrieve.test.ts`

Expected: PASS with Supabase and Docling available. Environment skips must state missing variable/tool explicitly.

- [ ] **Step 3: Run static checks**

Run: `npm run lint && npx tsc --noEmit && npm run build`

Expected: no new errors. Compare any known `.next/dev` or pre-existing container failures against baseline.

- [ ] **Step 4: Verify structural invariants**

Confirm with targeted searches:

- Website processing no longer writes `parserName: 'passthrough'`.
- Upload processing invokes `SourceFactPipeline`.
- Website processing invokes `CanonicalDocumentIndexer`.
- Live onboarding review path does not read `mockOnboardingState.compiledProfile`.
- No code labels Markdown as `text/html`.

Start app with `npm run dev`, then use agent-browser against `/onboarding/{seededBusinessId}`. Navigate to review step and verify one website-derived field, one upload-derived field, both source labels, and no hardcoded mock profile summary.

- [ ] **Step 5: Commit verification fixes only if needed**

Run `git diff --name-only`, stage only files changed to fix failed verification, then commit with `git commit -m "fix: close cohesive context verification gaps"`. Skip commit when no files changed.

## Dependency Order And Safe Delegation

Execute sequentially unless listed parallel:

1. Task 1.
2. Task 2.
3. Task 3.
4. Tasks 4 and 6 may run in parallel; files do not overlap.
5. Tasks 5 and 7 may run in parallel; files do not overlap.
6. Task 8 after Tasks 4, 6, and 7.
7. Task 9 after Tasks 2, 3, 5, and 8.
8. Task 10 after Task 9.
9. Task 11 after Task 10.
10. Tasks 12 and 14 may run in parallel after Task 11.
11. Task 13 after Task 12.
12. Task 15 after Task 14.
13. Task 16 after Tasks 13 and 15.
14. Task 17 last.

Every cavecrew builder receives exactly one task, listed files, and requirement to return RED command/failure, GREEN command/pass, files changed, and blocker status. Task 17 uses reviewer subagent after all gates pass.
