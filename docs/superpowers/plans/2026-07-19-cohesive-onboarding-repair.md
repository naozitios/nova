# Cohesive Onboarding Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair all correctness, contract, coverage, and orchestration gaps found during post-implementation review.

**Architecture:** Preserve existing shared-service design. Restore canonical contracts at service boundaries first, then repair upload and website orchestration, then gate onboarding UI against live review state. Every production change starts with a focused failing regression test.

**Tech Stack:** TypeScript, Vitest, Next.js route handlers, React server rendering, Supabase repositories, Firecrawl v2, Docling.

## Global Constraints

- Supabase remains system of record.
- Firecrawl performs discovery and rendered HTML collection only.
- Docling normalizes every collected website page; missing HTML or parser failure is fatal.
- `source_processing` owns full source lifecycle.
- User-verified facts remain authoritative.
- No `document_chunks` migration.
- Never label Markdown as `text/html`.
- URL survives in source metadata and every website chunk locator.
- Each implementation delegation touches at most two files.
- Do not modify unrelated existing work.

---

### Task 1: Restore Canonical Indexer Contract

**Files:**
- Modify: `src/core/business-context/service/canonical-document-indexer.test.ts`
- Modify: `src/core/business-context/service/canonical-document-indexer.ts`

**Interfaces:**
- Consumes `processedStoragePath`, parser metadata, page count, and optional `baseLocator`.
- Produces `{ chunkCount, processedStoragePath }`, enriched locators, and indexed document state.

- [ ] Add failing tests for exact artifact path, locator merge, indexed fields, and every failure status.
- [ ] Run `npm run test:unit -- src/core/business-context/service/canonical-document-indexer.test.ts`; confirm expected failures.
- [ ] Implement full input contract and minimal document update needed by tests.
- [ ] Re-run focused test; require zero failures.
- [ ] Request cavecrew review for only these two files and resolve findings.

### Task 2: Preserve Fact Provenance And Failures

**Files:**
- Modify: `src/core/business-context/service/source-fact-pipeline.test.ts`
- Modify: `src/core/business-context/service/source-fact-pipeline.ts`

**Interfaces:**
- Documents use `{ sourceDocumentId, contentText, parserName }`.
- `runId` and `sessionId` are nullable top-level fields.
- Extraction failure returns failure; each persisted fact retains originating document ID.

- [ ] Add failing tests for two-document provenance, parser forwarding, nullable gates, and extraction failure.
- [ ] Run focused tests and confirm failures.
- [ ] Keep facts paired with document IDs through reconciliation; only run gates with a real run ID.
- [ ] Re-run pipeline plus resolver tests.
- [ ] Request cavecrew review for only these two files and resolve findings.

### Task 3: Repair Upload Orchestration

**Files:**
- Modify: `src/core/business-context/service/uploaded-document.processor.test.ts`
- Modify: `src/core/business-context/service/uploaded-document.processor.ts`

**Interfaces:**
- Pass parser metadata into indexer and fact pipeline.
- Require caller-provided processing `runId`; use nullable session ID.
- Return source terminal status `processed` or `processed_with_warnings` while document status becomes `completed`.

- [ ] Add failing tests for valid status mapping, run forwarding, and extraction hard failure.
- [ ] Run focused tests and confirm failures.
- [ ] Implement minimal processor changes.
- [ ] Re-run focused tests.
- [ ] Request cavecrew review for only these two files and resolve findings.

### Task 4: Repair Upload Wiring And Run Forwarding

**Files:**
- Modify: `src/di/providers/business-context.ts`
- Modify: `src/core/business-context/service/source-processing.service.ts`

**Interfaces:**
- DI constructs upload processor with shared fact pipeline.
- Source processor forwards actual `runId` and session ID and writes only valid terminal outcomes.

- [ ] Extend existing wiring/processing tests first; confirm they fail.
- [ ] Pass `getSourceFactPipeline()` in DI and forward processing identifiers.
- [ ] Run source-processing and DI tests.
- [ ] Request cavecrew review for only these two production files and resolve findings.

### Task 5: Repair Firecrawl V2 Collection

**Files:**
- Create: `src/infrastructure/business-context/website-source.adapter.test.ts`
- Modify: `src/infrastructure/business-context/website-source.adapter.ts`

**Interfaces:**
- Start with `POST /v2/crawl`; poll job URL until terminal status.
- Use `next` only for result pagination after completion.
- Enforce configured shared deadline, non-2xx handling, rendered HTML presence, and credits propagation.

- [ ] Add failing tests for scraping-to-completed polling, pagination, failed/cancelled, non-2xx, timeout, and missing HTML.
- [ ] Run new test and confirm failures.
- [ ] Implement minimal polling state machine and `FIRECRAWL_HTML_MISSING` failure.
- [ ] Migrate existing website test mocks from v1 response shape to v2.
- [ ] Run every `website-source*.test.ts` suite; require zero failures.
- [ ] Request cavecrew review for adapter plus new test only and resolve findings.

### Task 6: Complete Website Docling Orchestration

**Files:**
- Modify: `src/core/business-context/service/source-processing.processing.test.ts`
- Modify: `src/core/business-context/service/source-processing.service.ts`

**Interfaces:**
- Every website page requires raw HTML, passes filename to Docling, persists canonical Markdown, and calls indexer with deterministic path, parser metadata, and URL locator.

- [ ] Add failing assertions for required HTML, `fileName`, deterministic path, `baseLocator`, parser metadata, and canonical fact input.
- [ ] Run focused test and confirm failures.
- [ ] Implement strict Docling path and remove website passthrough fallback.
- [ ] Run all source-processing tests.
- [ ] Request cavecrew review for these two files and resolve findings.

### Task 7: Gate And Render Live Review

**Files:**
- Modify: `src/components/onboarding/BusinessContextReview.test.tsx`
- Modify: `src/components/onboarding/BusinessContextReview.tsx`
- Modify in separate delegation: `src/app/onboarding/[businessId]/page.tsx`
- Modify in separate delegation: `src/lib/onboarding/flow.ts`

**Interfaces:**
- Review renders unresolved fields.
- Continue is disabled during loading/error/missing review/unresolved blockers/incomplete sources.
- Retry uses AbortController and ignores stale completion.

- [ ] Replace fixture-only assertions with failing `renderToStaticMarkup` assertions.
- [ ] Render unresolved fields and source states; run component tests.
- [ ] Add failing flow/page gating tests before page changes.
- [ ] Implement review-aware continuation and cancellable retry.
- [ ] Run onboarding unit tests and lint changed files.
- [ ] Request separate cavecrew reviews for component pair and page/flow pair.

### Task 8: Test Real Route Contract

**Files:**
- Modify: `tests/contract/business-context/onboarding-review.test.ts`
- Modify: `src/app/api/businesses/[id]/onboarding/review/route.ts`

**Interfaces:**
- Route returns 401, 403, 404, and snake-case 200 responses without unauthenticated existence disclosure.

- [ ] Rewrite tests to call `GET` route with mocked auth/repository boundaries; confirm 401/403 tests fail first.
- [ ] Reorder route authentication/business resolution minimally.
- [ ] Run onboarding review and session contract tests.
- [ ] Request cavecrew review for these two files and resolve findings.

### Task 9: Prove Real Convergence And Verify

**Files:**
- Modify: `tests/integration/business-context/cohesive-brand-knowledge.integration.test.ts`
- Modify only defects exposed in files from Tasks 1-8.

**Interfaces:**
- Test invokes real website and upload processors with mocked external APIs, then checks parser, chunks, facts, profile, and user-verified conflict behavior.

- [ ] Replace direct inserts of derived chunks/facts with real service calls; confirm old implementation fails.
- [ ] Run convergence and wiring integration tests.
- [ ] Run complete business-context unit, contract, integration, lint, typecheck, and build gates.
- [ ] Dispatch final cavecrew reviewer across complete diff; fix all critical/high findings.
- [ ] Re-run all gates after final fixes.
