## Task 7: Upload Finalization Service — Report

**Status:** COMPLETE

### Files modified
- `src/core/business-context/service/upload.service.ts` — added `UploadCompletionRepository`, `UploadContentValidator`, `completeUploadIntent()`
- `src/core/business-context/service/upload.service.test.ts` — 17 new test cases

### What was added

**Types:**
- `UploadCompletionRepository` — `Pick<RepositoryPort, 'getSourceDocumentByHash' | 'getContextSource' | 'createContextSource' | 'createSourceDocument' | 'createContextJob'>`
- `UploadContentValidator` — callback `(buffer, declaredMimeType, fileName) → ServiceResult<{contentHash, detectedMimeType}>`
- `CompleteUploadIntentParams`, `CompleteUploadConfig`, `UploadCompletionResult`

**Function:** `completeUploadIntent(uploadRepo, bcRepo, storage, scanner, validator, params, config)`

**Flow (in required order):**
1. Load intent scoped to workspace
2. Verify business binding, PENDING status, not expired
3. Download private object from storage
4. Exact size check (buffer.length === expectedSizeBytes)
5. Validator verifies signature/MIME → contentHash + detectedMimeType
6. Scanner scan — fail-closed on error (treated as infected)
7. Infected/error → zero source/doc/job created, safe numeric scan code persisted (1=infected, 2=error), intent marked FAILED
8. Duplicate hash → returns existing source/document, creates no job
9. Success → ContextSource (type mapped from documentClass), immutable SourceDocument (retaining storagePath + contentHash), queued `source_processing` ContextJob (stageTimeoutSeconds=30), intent marked COMPLETED/CLEAN
10. No raw scanner details (engine, details string) persisted anywhere

**DocumentClass → SourceType mapping:** brand_deck, product_document, research_document, campaign_brief → direct; website_content → website; other → system_inference.

### Tests (17 new, 9 existing = 26 total)

| # | Test | Status |
|---|------|--------|
| 1 | Creates source, document, and job for valid upload | GREEN |
| 2 | Maps documentClass to correct sourceType | GREEN |
| 3 | Returns INTENT_NOT_FOUND when intent missing | GREEN |
| 4 | Returns INTENT_CROSS_BUSINESS when businessId mismatches | GREEN |
| 5 | Returns INTENT_EXPIRED and marks intent expired | GREEN |
| 6 | Returns INTENT_NOT_PENDING when intent already completed | GREEN |
| 7 | Returns SIZE_MISMATCH when buffer size differs | GREEN |
| 8 | Propagates validator error and marks intent failed/skipped | GREEN |
| 9 | Treats scanner error as infected (fail-closed) | GREEN |
| 10 | Marks intent failed/infected when scanner finds malware | GREEN |
| 11 | Returns existing source/doc and creates no job for duplicate hash | GREEN |
| 12 | Preserves storage path and contentHash in created document | GREEN |
| 13 | Uses custom stageTimeoutSeconds from config | GREEN |
| 14 | Does not persist raw scanner details | GREEN |
| 15 | Archives newly created source when createSourceDocument fails, leaves intent pending (partial-finalization regression) | GREEN |
| 16 | Retries duplicate hash: finds existing job or creates one, completes intent without second source/doc (partial-finalization regression) | GREEN |
| 17 | Source status after creation is queued with currentStage QUEUED | GREEN |

### Test counts
- Passed: **26** (9 existing `createSignedUploadIntent` + 17 new `completeUploadIntent`)
- Failed: **0**
- Command result: `vitest run src/core/business-context/service/upload.service.test.ts` — 26/26 passed

### Concerns
- `DocumentClass.OTHER` maps to `SYSTEM_INFERENCE`; `WEBSITE_CONTENT` maps to `WEBSITE`. Both mappings unvalidated against product intent — **must validate when route/parser E2E lands**. Do not treat as resolved.
- If `bcRepo.createContextSource` or `bcRepo.createSourceDocument` fails mid-success-path, source is archived and intent left pending. Deterministic retry via idempotency key. Compensation for non-duplicate failures deferred.
- `SourceProcessingStage.QUEUED` is set on the ContextSource at creation time — confirms a job has been queued.
- Duplicate-hash path now creates a deterministic job (`getContextJobByIdempotencyKey` → create if missing). Retry after partial failure reuses existing job.
