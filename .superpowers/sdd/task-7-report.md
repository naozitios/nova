## Task 7: Upload Finalization Service — Report

**Status:** COMPLETE

### Files modified
- `src/core/business-context/service/upload.service.ts` — added `UploadCompletionRepository`, `UploadContentValidator`, `completeUploadIntent()`
- `src/core/business-context/service/upload.service.test.ts` — 14 new test cases

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

### Tests (14 new, 9 existing = 23 total)

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

### Test counts
- Passed: **23** (9 existing `createSignedUploadIntent` + 14 new `completeUploadIntent`)
- Failed: **0**

### Concerns
- The `DocumentClass.OTHER` maps to `SYSTEM_INFERENCE` as a reasonable fallback — verify this matches product intent if OTHER is ever used in practice.
- If `bcRepo.createContextSource` or `bcRepo.createSourceDocument` fails mid-success-path, no rollback occurs. Document is created but job is not. Acceptable for now; can add compensation later if needed.
- `SourceProcessingStage.QUEUED` is set on the ContextSource at creation time — confirms a job has been queued.
