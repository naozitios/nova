# Business Context Requirement Coverage Matrix

**Generated**: 2026-07-17
**Spec**: `specs/006-business-context-supabase/spec.md`
**Source**: 48 FRs + 22 SCs = 70 total requirements

## Baseline Commands

| Command | Result |
|---------|--------|
| `npm run build` | ✅ passes |
| `npm run test:business-context:e2e` | ❌ lock contention (harness, not test failure); 51 pass, 11 skip, 6 fail |
| `npm run lint` | ❌ timeout (broad pre-existing errors outside Business Context) |
| `npm test` | ❌ timeout (broad suite) |

## Coverage Summary

| Status | Count |
|--------|-------|
| covered | 60 |
| partial | 8 |
| missing | 2 |
| **Total** | **70** |

## Evidence Matrix

### Functional Requirements

| Requirement | Behavior | Strongest test | Boundary | Status |
|---|---|---|---|---|
| FR-001 | Supabase Postgres as source of truth | `tests/integration/business-context/source-processing-wiring.integration.test.ts` | integration | covered |
| FR-002 | Private Supabase Storage buckets | `tests/rls/business-context/remediation-isolation-storage.test.ts` | rls | covered |
| FR-003 | workspace_id + RLS on tenant tables | `tests/rls/business-context/workspace-isolation.test.ts` | rls | covered |
| FR-004 | Workspace roles (owner/admin/editor/viewer) | `tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts` | e2e | covered |
| FR-005 | APIs for all operations | `tests/contract/business-context/context-management.test.ts` | contract | covered |
| FR-006 | Authentication + idempotency key | `tests/contract/business-context/idempotency-durable.test.ts` | contract | covered |
| FR-007 | Onboarding session statuses | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| FR-008 | Required fields before approval | `tests/integration/business-context/approve-onboarding-atomic.test.ts` | integration | covered |
| FR-009 | Required initial onboarding inputs | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| FR-010 | Source adapter contract normalization | `tests/unit/business-context/source-adapter-registry.test.ts` | unit | covered |
| FR-011 | V1 source types | `tests/unit/business-context/schemas.test.ts` | unit | covered |
| FR-012 | Website ingestion (Firecrawl) | `tests/integration/business-context/firecrawl.integration.test.ts` | integration | covered |
| FR-013 | Website crawling security (SSRF, robots) | `tests/unit/business-context/ssrf-guard.test.ts` | unit | covered |
| FR-014 | Upload ingestion validation | `tests/unit/business-context/upload-validator.test.ts` | unit | covered |
| FR-015 | Native document parsing | `tests/unit/business-context/native-document.parser.adapter.test.ts` | unit | covered |
| FR-016 | PaddleOCR as separate worker | `tests/integration/business-context/full-pipeline.integration.test.ts` | integration | partial |
| FR-017 | Document parser output format | `tests/integration/business-context/native-parser.integration.test.ts` | integration | covered |
| FR-018 | Extraction schema-constrained tasks | `tests/integration/business-context/extraction-jobs.test.ts` | integration | covered |
| FR-019 | LLM output Zod validation + repair | `tests/unit/business-context/schemas.test.ts` | unit | covered |
| FR-020 | Fact preservation (value, source, excerpt) | `tests/integration/business-context/extraction-jobs.test.ts` | integration | covered |
| FR-021 | Fact resolution precedence | `tests/unit/business-context/resolver.b12.test.ts` | unit | covered |
| FR-022 | Conflict preservation + resolution | `tests/integration/business-context/reconciliation-atomicity.test.ts` | integration | covered |
| FR-023 | Question generation for gaps/conflicts | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | partial |
| FR-024 | User answers create verified facts | `tests/integration/business-context/onboarding-question-persistence.test.ts` | integration | covered |
| FR-025 | Draft profile compilation | `tests/unit/business-context/compiler.test.ts` | unit | covered |
| FR-026 | Approval in single Postgres transaction | `tests/integration/business-context/profile-approval-transaction.test.ts` | integration | covered |
| FR-027 | One current version per business | `tests/integration/business-context/approve-onboarding-atomic.test.ts` | integration | covered |
| FR-028 | Later edits create new version | `tests/unit/business-context/versioning.test.ts` | unit | covered |
| FR-029 | Restoring earlier version | `tests/contract/business-context/context-management.test.ts` | contract | partial |
| FR-030 | Context compiler purposes | `tests/unit/business-context/context-purpose-compiler.test.ts` | unit | covered |
| FR-031 | Future business_context_version_id | — | — | missing |
| FR-032 | Async jobs | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-033 | Audit logging | `tests/integration/business-context/audit-log.test.ts` | integration | covered |
| FR-034 | Secret redaction | `tests/unit/business-context/server-secret-boundary.test.ts` | unit | covered |
| FR-035 | Ports-and-adapters boundary | `tests/unit/business-context/no-sqlite-persistence.test.ts` | unit | covered |
| FR-036 | No mock/in-memory persistence | `tests/unit/business-context/no-sqlite-persistence.test.ts` | unit | covered |
| FR-037 | Source processing stages | `tests/integration/business-context/processing.test.ts` | integration | covered |
| FR-038 | Job status states | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-039 | Retry exponential backoff | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-040 | Non-retryable failures | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-041 | Stuck job recovery | `tests/integration/business-context/source-processing-worker.shutdown-recovery.test.ts` | integration | covered |
| FR-042 | Provider circuit breakers | `tests/unit/business-context/circuit-breaker.test.ts` | unit | covered |
| FR-043 | Processing stage visibility events | `tests/integration/business-context/processing-visibility.test.ts` | integration | covered |
| FR-044 | Document quality gates | `tests/integration/business-context/source-processing-wiring.integration.test.ts` | integration | covered |
| FR-045 | Fact quality gates | `tests/unit/business-context/quality-gates.test.ts` | unit | covered |
| FR-046 | Processing visibility queryable | `tests/integration/business-context/processing-visibility.test.ts` | integration | covered |
| FR-047 | Local Supabase CLI for MVP | `tests/integration/business-context/migration.test.ts` | integration | covered |
| FR-048 | No SQLite/mock persistence on endpoints | `tests/unit/business-context/no-sqlite-persistence.test.ts` | unit | covered |

### Success Criteria

| Requirement | Behavior | Strongest test | Boundary | Status |
|---|---|---|---|---|
| SC-001 | Create-to-v1 flow via backend APIs | `tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts` | e2e | covered |
| SC-002 | Website scan bounded/idempotent | `tests/e2e/business-context/b14-t020-source-process-worker.e2e.test.ts` | e2e | covered |
| SC-003 | Upload parsed/deduplicated | `tests/unit/business-context/upload-validator.test.ts` | unit | partial |
| SC-004 | PPTX slide-level evidence | `tests/unit/business-context/document-parser-router.test.ts` | unit | partial |
| SC-005 | Scanned PDF/image OCR | `tests/integration/business-context/full-pipeline.integration.test.ts` | integration | partial |
| SC-006 | Representative document benchmark | — | — | missing |
| SC-007 | Parser/model versions recorded | `tests/integration/business-context/native-parser.integration.test.ts` | integration | covered |
| SC-008 | Every fact links to source+excerpt | `tests/integration/business-context/extraction-jobs.test.ts` | integration | covered |
| SC-009 | Contradictions generate questions | `tests/integration/business-context/reconciliation-atomicity.test.ts` | integration | partial |
| SC-010 | User answers create verified facts | `tests/integration/business-context/onboarding-question-persistence.test.ts` | integration | covered |
| SC-011 | One immutable current version | `tests/integration/business-context/approve-onboarding-atomic.test.ts` | integration | covered |
| SC-012 | Later edits create draft+diff | `tests/contract/business-context/context-management.test.ts` | contract | covered |
| SC-013 | Previous versions restorable | `tests/contract/business-context/context-management.test.ts` | contract | partial |
| SC-014 | Context compilation for all purposes | `tests/unit/business-context/context-purpose-compiler.test.ts` | unit | covered |
| SC-015 | RLS prevents cross-workspace | `tests/rls/business-context/workspace-isolation.test.ts` | rls | covered |
| SC-016 | No service-role in client code | `tests/unit/business-context/server-secret-boundary.test.ts` | unit | covered |
| SC-017 | Stage timeline exposed | `tests/integration/business-context/processing-visibility.test.ts` | integration | covered |
| SC-018 | Retryable failures backoff | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| SC-019 | Stuck jobs recovered | `tests/integration/business-context/source-processing-worker.shutdown-recovery.test.ts` | integration | covered |
| SC-020 | Circuit breakers stop dispatch | `tests/unit/business-context/circuit-breaker.test.ts` | unit | covered |
| SC-021 | Quality gates pass/warn/fail | `tests/integration/business-context/quality-gates.test.ts` | integration | covered |
| SC-022 | supabase start/reset succeed locally | `tests/integration/business-context/migration.test.ts` | integration | covered |

## Coverage by Boundary

| Boundary | FR covered | FR partial | FR missing | SC covered | SC partial | SC missing |
|---|---|---|---|---|---|---|
| unit | 14 | 1 | 0 | 2 | 1 | 0 |
| integration | 19 | 1 | 0 | 8 | 3 | 0 |
| contract | 4 | 1 | 0 | 1 | 1 | 0 |
| e2e | 2 | 0 | 0 | 2 | 0 | 0 |
| rls | 3 | 0 | 0 | 1 | 0 | 0 |
| missing | 0 | 0 | 1 | 0 | 0 | 1 |
| **Total** | **42** | **3** | **1** | **14** | **5** | **1** |

## Notes

- **FR-031** (future `business_context_version_id`): Deferred per spec assumptions. No contract or integration test exists.
- **SC-006** (representative document benchmark): No benchmark test file exists. `npm run benchmark:groq` produces explicit skip report.
- **FR-016** (PaddleOCR worker): Only referenced in full-pipeline integration; no dedicated PaddleOCR worker test.
- **FR-023** (question generation): Onboarding readiness test checks blocker codes but does not directly test question generation logic.
- **FR-029** / **SC-013** (restore version): Route contract exists but no integration/E2E proves restore creates new version from snapshot.
- **SC-003** (upload dedup): Upload validator covers validation; deduplication behavior is in wiring integration but not directly tested end-to-end.
- **SC-004** (PPTX slides): Document parser router tests MIME routing; no slide-level evidence extraction test.
- **SC-005** (OCR): Full-pipeline integration notes PaddleOCR requirement; no dedicated OCR output test.
- **SC-009** (contradiction questions): Reconciliation atomicity proves conflict persistence; question generation from conflicts is indirect.
- Task brief references FR-001..FR-056 / SC-001..SC-015 (71 rows). Spec contains FR-001..FR-048 / SC-001..SC-022 (70 rows). Matrix uses actual spec IDs.
