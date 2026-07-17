# Business Context Requirement Coverage Matrix

**Generated**: 2026-07-17 (corrected)
**Spec**: `specs/006.2-business-context-remediation/spec.md`
**Source**: 56 FRs + 15 SCs = 71 total requirements

## Baseline Commands (honest release review state)

| Command | Result |
|---------|--------|
| `npm run build` | ✅ passes |
| `npm run test:business-context:e2e` | ✅ dedicated E2E 8/8 pass |
| `npm run lint` | ❌ fails (broad pre-existing errors outside BC) |
| `npm test` | ❌ full suite fails (B44 + stale handler expectation) |
| Provider tests | ❌ path missing (no credentialed provider key) |

## Coverage Summary

| Status | FR | SC | Total |
|--------|----|----|-------|
| covered | 51 | 11 | 62 |
| partial | 4 | 4 | 8 |
| missing | 1 | 0 | 1 |
| **Total** | **56** | **15** | **71** |

## Evidence Matrix

### Functional Requirements

| Req | Behavior | Strongest test | Boundary | Status |
|-----|----------|---------------|----------|--------|
| FR-001 | Durable idempotency scoped by workspace/operation/key/fingerprint; OAuth signed-state replay rejection | `tests/contract/business-context/idempotency-durable.test.ts` | contract | covered |
| FR-002 | Separately runnable Node worker; multiple instances | `tests/e2e/business-context/b14a-two-worker-race.e2e.test.ts` | e2e | covered |
| FR-003 | Real `source_processing` handler with full pipeline coordination | `tests/e2e/business-context/b14-t020-source-process-worker.e2e.test.ts` | e2e | covered |
| FR-004 | Persisted leases/heartbeats; retries do not duplicate documents/facts | `tests/integration/business-context/source-processing-worker.claim-lease.test.ts` | integration | covered |
| FR-005 | Every applicable stage emits persisted events; non-applicable stages emit skipped | `tests/integration/business-context/processing-visibility.test.ts` | integration | covered |
| FR-006 | Terminal outcomes: processed, processed_with_warnings, blocked_needs_user_action, failed_permanent, archived | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-007 | Worker start command, unique identity, graceful stop, recoverable lease | `tests/e2e/business-context/b14c-worker-restart.e2e.test.ts` | e2e | covered |
| FR-008 | Short-lived private upload intents up to 50 MB | `tests/unit/business-context/upload-classification-proposal.test.ts` | unit | covered |
| FR-009 | Intent binding: workspace, business, source type, class, provenance, filename, MIME, size, path, creator, expiry | `tests/unit/business-context/upload-classification-proposal.test.ts` | unit | covered |
| FR-010 | Finalization: ownership, expiry, existence, size, metadata, content signature, malware scan; unavailable scanning fails closed | `tests/integration/business-context/remediation-upload-idempotency.test.ts` | integration | covered |
| FR-011 | Direct table mutation must NOT finalize upload intents | `tests/unit/business-context/upload-validator.test.ts` | unit | covered |
| FR-012 | Magic bytes/container validation, reject unsafe, SHA-256 hash, deduplicate within business | `tests/unit/business-context/upload-validator.test.ts` | unit | covered |
| FR-013 | Archiving preserves evidence/history | `tests/contract/business-context/sources-archive.test.ts` | contract | covered |
| FR-014 | Source registration uses discriminated source-specific metadata | `tests/contract/business-context/sources.test.ts` | contract | covered |
| FR-015 | Website ingestion: server-side Firecrawl, SSRF rejection, domain confinement, robots/budgets, 30 pages/5 MB, dedup, untrusted content | `tests/unit/business-context/ssrf-guard.test.ts` | unit | covered |
| FR-016 | Meta ingestion: encrypted workspace connection, refresh credentials, validate account ownership | `tests/rls/business-context/remediation-isolation-meta.test.ts` | rls | covered |
| FR-017 | Manual sources preserve user/system provenance | `tests/unit/business-context/source-adapter-registry.test.ts` | unit | covered |
| FR-018 | Native parsing precedes OCR decisions for supported modern formats | `tests/unit/business-context/document-parser-router.test.ts` | unit | covered |
| FR-019 | Insufficient text retains original, returns OCR_REQUIRED, recommends PROVIDE_MANUAL_TEXT | `tests/e2e/business-context/b14-wave11-resilience.e2e.test.ts` | e2e | covered |
| FR-020 | Legacy DOC/PPT/XLS retain original, return LEGACY_FORMAT_UNSUPPORTED | `tests/unit/business-context/document-parser-router.test.ts` | unit | covered |
| FR-021 | Extraction selects versioned prompt/taxonomy by class | `tests/unit/business-context/prompt-catalog.test.ts` | unit | covered |
| FR-022 | Output passes strict schema, allowed key, value, confidence, evidence checks | `tests/unit/business-context/schemas.test.ts` | unit | covered |
| FR-023 | Null-like and non-positive-confidence facts rejected | `tests/unit/business-context/quality-gates.test.ts` | unit | covered |
| FR-024 | Material facts persist source/document/excerpt/confidence/verification/locator | `tests/integration/business-context/extraction-jobs.test.ts` | integration | covered |
| FR-025 | Invalid output: at most one repair, no partial publication after failed repair | `tests/unit/business-context/schemas.test.ts` | unit | covered |
| FR-026 | Versioned fixtures define expected keys and evidence | `tests/integration/business-context/extraction-corpus.test.ts` | integration | covered |
| FR-027 | Reconciliation: normalize keys, precedence, preserve competing facts, one open conflict per key | `tests/integration/business-context/reconciliation-atomicity.test.ts` | integration | covered |
| FR-028 | Required gaps/conflicts create/refresh targeted questions; obsolete dismissed without deleting history | `tests/integration/business-context/onboarding-question-persistence.test.ts` | integration | covered |
| FR-029 | Questions expose stable ID, fact key, prompt, control type, options, allows_unknown, reason, priority, status, answer state | `tests/integration/business-context/onboarding-question-persistence.test.ts` | integration | covered |
| FR-030 | Answers/corrections create linked user-verified facts through session-scoped manual source | `tests/integration/business-context/onboarding-question-persistence.test.ts` | integration | covered |
| FR-031 | Sessions persist initial/update mode, step, status, base/draft version, start/completion, sanitized error | `tests/contract/business-context/onboarding-session.test.ts` | contract | covered |
| FR-032 | One business has at most one active session; repeated starts resume | `tests/contract/business-context/onboarding-session.test.ts` | contract | covered |
| FR-033 | Session status and PRD 007 route stage derived from persisted state | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| FR-034 | Readiness returns session, route stage, sources, jobs, questions, blockers, section readiness, approval readiness, versions | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| FR-035 | Initial drafts compile active extracted/verified facts through shared precedence and nested keys | `tests/unit/business-context/compiler.test.ts` | unit | covered |
| FR-036 | Readiness applies deterministic matrix, blocking conflicts/quality, required processing completion | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| FR-037 | Initial approval atomically publishes sole current v1, audit, approves session | `tests/integration/business-context/profile-approval-transaction.test.ts` | integration | covered |
| FR-038 | Update session preserves current profile while draft exists | `tests/unit/business-context/versioning.test.ts` | unit | covered |
| FR-039 | Draft stores base version and exposes attributed field diff | `tests/contract/business-context/context-management.test.ts` | contract | covered |
| FR-040 | Approval requires expected base; stale base returns 409, preserves draft/current | `tests/contract/business-context/context-management.test.ts` | contract | partial |
| FR-041 | Successful update publishes exactly one next current version, preserves history | `tests/unit/business-context/versioning.test.ts` | unit | covered |
| FR-042 | All mutating HTTP endpoints require idempotency key, identity, role, validated input; Meta OAuth callback exception with signed state | `tests/contract/business-context/idempotency-durable.test.ts` | contract | covered |
| FR-043 | HTTP routes use getServerSession() through NextAuth; X-User-Id only behind local-test flag | `tests/unit/business-context/server-secret-boundary.test.ts` | unit | partial |
| FR-044 | RLS isolates every tenant-owned table and Storage path | `tests/rls/business-context/workspace-isolation.test.ts` | rls | covered |
| FR-045 | Service role may seed/inspect tests but must NOT prove RLS | `tests/rls/business-context/remediation-isolation-policy-checks.test.ts` | rls | covered |
| FR-046 | Retry rejects permanent validation, blocked OCR, blocked legacy-format failures | `tests/unit/business-context/job-policy.test.ts` | unit | covered |
| FR-047 | Visibility exposes safe timings, attempts, counts, warnings, provider request IDs/cost, quality, failure code, retryability, outcome | `tests/integration/business-context/processing-visibility.test.ts` | integration | covered |
| FR-048 | Errors/logs use stable codes and redact contents, tokens, keys, personal data, provider bodies | `tests/integration/business-context/context-jobs.test.ts` | integration | covered |
| FR-049 | API E2E starts its own app and worker; uses real Supabase/Auth/Storage | `tests/e2e/business-context/b14-t020-source-process-worker.e2e.test.ts` | e2e | covered |
| FR-050 | Provider-gated tests require credentialed CI/release task; cannot silently pass when skipped | — | — | missing |
| FR-051 | Business creation persists PRD 007 fields as provenance-backed context; optional website without mandatory source array | `tests/unit/business-context/service.test.ts` | unit | covered |
| FR-052 | Permanent fact edits create verified correction facts, preserve evidence, create draft, require approval | `tests/contract/business-context/context-management.test.ts` | contract | covered |
| FR-053 | API contract enumerates all backend operations required by PRD 007 | `tests/contract/business-context/context-management.test.ts` | contract | partial |
| FR-054 | Version API exposes typed list, detail, comparison, expected-current restore with approver/time/summary | `tests/contract/business-context/context-management.test.ts` | contract | partial |
| FR-055 | Upload malware scanning runs through port, persists safe result/code, never logs content, rejects infected/suspicious/unavailable/timeout | `tests/unit/infrastructure/clamav-malware.scanner.test.ts` | unit | covered |
| FR-056 | Stateless expiring signed document-class proposal; upload accepts user-selected or signed class, validates binding/expiry, persists provenance | `tests/unit/business-context/upload-classification-proposal.test.ts` | unit | covered |

### Success Criteria

| Req | Behavior | Strongest test | Boundary | Status |
|-----|----------|---------------|----------|--------|
| SC-001 | Self-starting HTTP E2E completes business creation through approved v1 using real app/worker/NextAuth/Supabase/Storage | `tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts` | e2e | partial |
| SC-002 | Worker claims local queued source within 10 seconds; no direct lifecycle-table updates in tests | `tests/e2e/business-context/b14-t020-source-process-worker.e2e.test.ts` | e2e | covered |
| SC-003 | Same-key concurrency produces one execution in 100 races; key/payload mismatch returns 409 | `tests/e2e/business-context/b14a-two-worker-race.e2e.test.ts` | e2e | covered |
| SC-004 | Two workers produce no duplicate successful outputs in 100 claim races | `tests/e2e/business-context/b14a-two-worker-race.e2e.test.ts` | e2e | covered |
| SC-005 | Digital PDF/DOCX/PPTX/XLSX/HTML/text fixtures process; infected/malformed/mismatched create zero facts; DOC/PPT/XLS retain and block | `tests/integration/business-context/source-processing-b12-acceptance.test.ts` | integration | partial |
| SC-006 | Scanned files retain originals, return OCR_REQUIRED, never auto-retry, supplementable by linked manual text | `tests/e2e/business-context/b14-wave11-resilience.e2e.test.ts` | e2e | covered |
| SC-007 | Corpus ≥80% required-key recall per class; 100% null-like rejection; 100% accepted facts have excerpts | `tests/integration/business-context/extraction-corpus.test.ts` | integration | covered |
| SC-008 | Conflicts create exactly one open conflict/question per normalized key; block approval | `tests/integration/business-context/reconciliation-atomicity.test.ts` | integration | covered |
| SC-009 | Readiness always reports one valid PRD 007 route stage | `tests/unit/business-context/onboarding-readiness.test.ts` | unit | covered |
| SC-010 | Business initial fields and optional website persist correctly; no initial source array mandatory | `tests/unit/business-context/service.test.ts` | unit | covered |
| SC-011 | Initial/update approvals leave exactly one current version; stale update returns 409 with intact draft | `tests/integration/business-context/approve-onboarding-atomic.test.ts` | integration | partial |
| SC-012 | NextAuth HTTP role matrix and real Supabase user-JWT RLS deny unauthorized/cross-workspace access | `tests/rls/business-context/workspace-isolation.test.ts` | rls | covered |
| SC-013 | Worker restart recovers/dead-letters without duplicate outputs | `tests/e2e/business-context/b14c-worker-restart.e2e.test.ts` | e2e | covered |
| SC-014 | Success/failure log scan finds zero fixture secrets, tokens, keys, source-body, personal markers | `tests/unit/business-context/server-secret-boundary.test.ts` | unit | covered |
| SC-015 | Contract inventory covers every backend operation required by PRD 007 | `tests/contract/business-context/context-management.test.ts` | contract | partial |

## Coverage by Boundary

| Boundary | FR cov | FR part | FR miss | SC cov | SC part | SC miss |
|----------|--------|---------|---------|--------|---------|---------|
| unit | 22 | 1 | 0 | 3 | 0 | 0 |
| integration | 13 | 0 | 0 | 2 | 2 | 0 |
| contract | 8 | 3 | 0 | 0 | 1 | 0 |
| e2e | 5 | 0 | 0 | 5 | 1 | 0 |
| rls | 3 | 0 | 0 | 1 | 0 | 0 |
| missing | 0 | 0 | 1 | 0 | 0 | 0 |
| **Total** | **51** | **4** | **1** | **11** | **4** | **0** |

## Totals (verified from table rows)

| Category | covered | partial | missing | Total |
|----------|---------|---------|---------|-------|
| FR (56) | 51 | 4 | 1 | 56 |
| SC (15) | 11 | 4 | 0 | 15 |
| **All (71)** | **62** | **8** | **1** | **71** |

## Notes

- **FR-050** (provider-gated CI task): No test file exists; `npm run benchmark:groq` produces explicit skip report. Provider test path missing.
- **FR-040** (stale base 409): Contract test exists for version list/restore; stale-base 409 behavior not directly asserted.
- **FR-043** (getServerSession / X-User-Id flag): Server-secret-boundary test covers key redaction; session-to-membership mapping not directly tested.
- **FR-053** (contract inventory): context-management contract covers many routes; complete PRD 007 operation enumeration not audited.
- **FR-054** (version API typed operations): context-management contract covers list/restore; arbitrary comparison and change summary fields not fully asserted.
- **SC-001** (create-to-v1 E2E): b44 test file exists with happy-path; full v1 approval flow not verified end-to-end (harness lock contention in full suite).
- **SC-005** (fixture processing): B12 acceptance covers processing pipeline; full fixture matrix (infected/malformed/legacy blocking) not all asserted.
- **SC-011** (sole current version + stale 409): approve-onboarding-atomic covers sole-current; stale-base409 preserved-draft not in same gate.
- **SC-015** (contract inventory): context-management covers many operations; complete PRD 007 enumeration not formally audited.
