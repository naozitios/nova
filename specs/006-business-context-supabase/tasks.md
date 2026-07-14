# Tasks: Business Context Supabase Backend

**Input**: Design documents from `/specs/006-business-context-supabase/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`

**Tests**: Tests are required for this feature because PRD 006 includes RLS, approval atomicity, job retry, parsing, extraction, and versioning acceptance criteria.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently after the foundation is complete.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on another task in the same phase.
- **[Story]**: Which user story the task supports.
- Every task includes exact file paths.

## Phase 1: Supabase Readiness Gate (Blocking)

**Purpose**: Prove local Supabase CLI is available and usable before any Business Context endpoint or repository work begins. SQLite/libSQL and in-memory stores are not acceptable for Business Context API persistence.

- [ ] T001 Add Supabase local development dependency and scripts in `package.json`: `supabase:start`, `supabase:stop`, `supabase:reset`, and `supabase:status` using `npx supabase`.
- [ ] T002 Run `npx supabase init` and commit generated `supabase/config.toml` plus `supabase/.gitignore`.
- [ ] T003 Create `supabase/seed.sql` with initial local workspace/member fixtures for owner, admin, editor, viewer, and cross-workspace RLS tests.
- [ ] T004 Create `supabase/migrations/202607140000_supabase_readiness.sql` with a minimal readiness check function and comments documenting that Business Context migrations start in the next migration.
- [ ] T005 Add local Supabase environment documentation to `specs/006-business-context-supabase/quickstart.md`, including Docker requirement, local URL, anon key, service-role key, and the rule that service-role keys never use `NEXT_PUBLIC_`.
- [ ] T006 Run `npx supabase start` and record the expected local services in `specs/006-business-context-supabase/quickstart.md`.
- [ ] T007 Run `npx supabase db reset` and verify the readiness migration and seed file apply from a clean local database.
- [ ] T008 Add cloud migration notes to `specs/006-business-context-supabase/quickstart.md` using `npx supabase login`, `npx supabase link`, `npx supabase db push --dry-run`, and `npx supabase db push`.
- [ ] T009 Add a dependency guard test in `tests/unit/business-context/no-sqlite-persistence.test.ts` that fails if Business Context route handlers or infrastructure imports `@libsql/client`, `drizzle-orm/sqlite-core`, or an in-memory Business Context repository.

**Checkpoint**: Local Supabase CLI starts, resets, applies seed data, and is documented. No Business Context endpoint work starts before this passes.

---

## Phase 2: Setup (Shared Infrastructure)

**Purpose**: Add test tooling, Supabase scaffolding, and feature directories without implementing domain behavior.

- [ ] T010 Add `test`, `test:watch`, and `test:coverage` scripts plus Vitest dependencies in `package.json`.
- [ ] T011 Create Vitest configuration in `vitest.config.ts` with path alias support for `@/*` and Node test environment.
- [ ] T012 [P] Create test setup file `tests/setup.ts` for shared test environment defaults.
- [ ] T013 [P] Create Business Context domain directory `src/core/business-context/` with `.gitkeep` or initial empty index-free files removed by later tasks.
- [ ] T014 [P] Create Business Context infrastructure directory `src/infrastructure/business-context/` with `.gitkeep` or initial empty index-free files removed by later tasks.
- [ ] T015 [P] Create API route directory skeleton under `src/app/api/businesses/` and `src/app/api/context-jobs/` matching `contracts/openapi.yaml`.
- [ ] T016 [P] Create PaddleOCR worker directories `workers/paddleocr/` and `workers/paddleocr/tests/`.
- [ ] T017 Update `src/infrastructure/config.ts` with server-only Business Context configuration keys for local Supabase URL, anon key, service-role key, Firecrawl, crawl budgets, upload size, storage buckets, and PaddleOCR flags.

---

## Phase 3: Foundational (Blocking Prerequisites)

**Purpose**: Establish database, security, domain contracts, repository, DI, and shared API utilities. No user story can be implemented until this phase is complete.

**Critical**: Business Context endpoints must use local Supabase-backed persistence only during MVP; do not add SQLite/libSQL, Drizzle SQLite, mock, or in-memory Business Context repositories for route handlers.

### Tests First

- [ ] T018 [P] Write schema migration smoke test in `tests/integration/business-context/migration.test.ts` that asserts all PRD tables and the `one_current_business_profile` partial unique index exist in local Supabase.
- [ ] T019 [P] Write RLS membership tests in `tests/rls/business-context/workspace-isolation.test.ts` for same-workspace read, cross-workspace deny, viewer mutation deny, editor draft allow, and admin approval allow against local Supabase.
- [ ] T020 [P] Write domain schema tests in `tests/unit/business-context/schemas.test.ts` for onboarding status, source type, source processing stage, terminal source outcome, job status, fact confidence bounds, extraction output validation, quality gate result, circuit breaker state, and compile purpose validation.
- [ ] T021 [P] Write repository contract test scaffold in `tests/integration/business-context/supabase.repository.test.ts` covering source, fact, conflict, profile version, job, processing run, stage event, quality gate, circuit breaker, and audit persistence operations against local Supabase.
- [ ] T022 [P] Write job policy tests in `tests/unit/business-context/job-policy.test.ts` for retryable/permanent error classification, default exponential backoff with jitter bounds, max-attempt exhaustion, stuck heartbeat transition, and dead-letter transition.
- [ ] T023 [P] Write quality gate tests in `tests/unit/business-context/quality-gates.test.ts` for document gate pass/warn/fail results, fact gate confidence thresholds, blocking approval failures, and non-blocking warning summaries.
- [ ] T024 [P] Write processing visibility tests in `tests/integration/business-context/processing-visibility.test.ts` verifying stage events persist duration, attempts, worker ID, provider request ID, pages/slides processed, credits consumed, facts extracted, warning counts, and sanitized errors.
- [ ] T025 [P] Write circuit breaker tests in `tests/unit/business-context/circuit-breaker.test.ts` for closed-to-open thresholds, quota exhaustion, half-open probe success, and half-open probe failure.

### Implementation

- [ ] T026 Create migration `supabase/migrations/202607140001_business_context.sql` with workspaces, workspace_members, businesses, onboarding_sessions, context_sources, source_documents, context_facts, context_conflicts, onboarding_questions, business_profile_versions, context_jobs, context_processing_runs, context_processing_stage_events, context_quality_gate_results, context_provider_circuit_breakers, and context_audit_log tables.
- [ ] T027 Add constraints and indexes to `supabase/migrations/202607140001_business_context.sql`, including confidence bounds, `unique (business_id, version)`, active fact indexes, job idempotency uniqueness, job scheduling/heartbeat indexes, processing visibility indexes, circuit breaker uniqueness, and `one_current_business_profile` partial unique index.
- [ ] T028 Add RLS enablement and membership/role policies to `supabase/migrations/202607140001_business_context.sql` for every tenant-owned table.
- [ ] T029 Add private Storage bucket setup and storage ownership policies to `supabase/migrations/202607140001_business_context.sql` for `business-context-sources` and `business-context-archives`.
- [ ] T030 Add SQL functions in `supabase/migrations/202607140001_business_context.sql` for atomic profile approval and restore transitions.
- [ ] T031 Extend seed fixtures in `supabase/seed.sql` for two workspaces, owner/admin/editor/viewer users, and cross-workspace RLS tests.
- [ ] T032 Create domain types in `src/core/business-context/types.ts` for all entities, enums, source contracts, parser contracts, extraction outputs, profile sections, compile purposes, diffs, job policies, processing runs, stage events, quality gates, circuit breakers, and service result objects.
- [ ] T033 Create Zod schemas in `src/core/business-context/schemas.ts` for request validation, fact values, extraction outputs, profile sections, questions, job inputs, processing stages, quality gate results, circuit breaker state, and compiler purposes.
- [ ] T034 Create repository port in `src/core/business-context/repository.port.ts` with methods for businesses, onboarding sessions, sources, source documents, facts, conflicts, questions, profile versions, jobs, processing runs, stage events, quality gate results, circuit breaker state, audit logs, approval, and restore.
- [ ] T035 Create source adapter port in `src/core/business-context/source-adapter.port.ts` with `SourceAdapterPort.supports()` and `SourceAdapterPort.collect()` returning normalized source documents.
- [ ] T036 Create document parser port in `src/core/business-context/document-parser.port.ts` matching the PRD `DocumentParserPort` and `ParsedDocument` contract.
- [ ] T037 Create extraction port in `src/core/business-context/extraction.port.ts` for schema-constrained extraction tasks and one repair attempt.
- [ ] T038 [P] Create job policy module in `src/core/business-context/job-policy.ts` with pure functions for error classification, exponential backoff calculation, retry eligibility, stale heartbeat detection, and terminal job transition selection.
- [ ] T039 [P] Create quality gates module in `src/core/business-context/quality-gates.ts` with pure functions for document quality gates and fact quality gates.
- [ ] T040 Create Supabase server client in `src/infrastructure/business-context/supabase-client.ts` that separates anon/session clients from service-role clients and rejects service-role use in browser code.
- [ ] T041 Create authorization helper in `src/infrastructure/business-context/authz.ts` that resolves the current user, workspace membership, and role checks for viewer/editor/admin/owner.
- [ ] T042 Implement Supabase repository in `src/infrastructure/business-context/supabase.repository.ts` using `BusinessContextRepositoryPort`, processing visibility tables, quality gate tables, circuit breaker tables, and the SQL approval/restore functions.
- [ ] T043 [P] Implement processing visibility writer in `src/infrastructure/business-context/processing-visibility.ts` for creating runs, appending stage events, aggregating counters, and redacting errors.
- [ ] T044 [P] Implement provider circuit breaker adapter in `src/infrastructure/business-context/circuit-breaker.ts` for reading breaker state before dispatch and recording provider successes/failures after dispatch.
- [ ] T045 Register Business Context repository and service factories in `src/di/container.ts` without changing existing campaign service behavior.
- [ ] T046 Create shared API helpers in `src/app/api/businesses/_shared.ts` for JSON parsing, Zod validation, idempotency key enforcement, authz errors, and response serialization.
- [ ] T047 Run `npm run test -- tests/unit/business-context/no-sqlite-persistence.test.ts tests/integration/business-context/migration.test.ts tests/rls/business-context/workspace-isolation.test.ts tests/unit/business-context/schemas.test.ts tests/integration/business-context/supabase.repository.test.ts tests/unit/business-context/job-policy.test.ts tests/unit/business-context/quality-gates.test.ts tests/integration/business-context/processing-visibility.test.ts tests/unit/business-context/circuit-breaker.test.ts` and fix failures in foundational files.

**Checkpoint**: Foundation ready. User story implementation may begin.

---

## Phase 4: User Story 1 - Create an Approved Business Context v1 (Priority: P1)

**Goal**: Authenticated editors can create a business, complete onboarding with required facts or explicit unknowns, compile a draft, and owners/admins can approve current v1.

**Independent Test**: API contract tests create a business and onboarding session, answer required questions with manual evidence, compile a draft, approve v1, and verify exactly one current profile version.

### Tests for User Story 1

- [ ] T048 [P] [US1] Write contract test for `POST /api/businesses` in `tests/contract/business-context/businesses.test.ts` covering required initial inputs, evidence source requirement, idempotency key, and editor authorization.
- [ ] T049 [P] [US1] Write contract test for onboarding session create/get in `tests/contract/business-context/onboarding-session.test.ts` covering `created` status and workspace authorization.
- [ ] T050 [P] [US1] Write integration test for required-field approval gating in `tests/integration/business-context/onboarding-approval.test.ts` covering missing fields, explicit unknowns, and unresolved conflict rejection.
- [ ] T051 [P] [US1] Write integration test for atomic v1 approval in `tests/integration/business-context/profile-approval-transaction.test.ts` verifying no duplicate current versions after simulated failure.

### Implementation for User Story 1

- [ ] T052 [US1] Implement onboarding lifecycle methods in `src/core/business-context/service.ts` for create business, create session, get session, submit answers, compile onboarding draft, and approve v1.
- [ ] T053 [US1] Implement profile validation and required-field checks in `src/core/business-context/compiler.ts` for the eight required Business Context sections.
- [ ] T054 [US1] Implement approval orchestration in `src/core/business-context/versioning.ts` that calls repository transaction methods and emits audit intent.
- [ ] T055 [US1] Implement `POST /api/businesses` in `src/app/api/businesses/route.ts`.
- [ ] T056 [US1] Implement `POST` and `GET /api/businesses/[id]/onboarding` in `src/app/api/businesses/[id]/onboarding/route.ts`.
- [ ] T057 [US1] Implement `GET /api/businesses/[id]/onboarding/questions` in `src/app/api/businesses/[id]/onboarding/questions/route.ts`.
- [ ] T058 [US1] Implement `POST /api/businesses/[id]/onboarding/answers` in `src/app/api/businesses/[id]/onboarding/answers/route.ts` to create user-verified facts from answers.
- [ ] T059 [US1] Implement `POST /api/businesses/[id]/onboarding/compile` in `src/app/api/businesses/[id]/onboarding/compile/route.ts`.
- [ ] T060 [US1] Implement `POST /api/businesses/[id]/onboarding/approve` in `src/app/api/businesses/[id]/onboarding/approve/route.ts` with admin/owner authorization.
- [ ] T061 [US1] Run `npm run test -- tests/contract/business-context/businesses.test.ts tests/contract/business-context/onboarding-session.test.ts tests/integration/business-context/onboarding-approval.test.ts tests/integration/business-context/profile-approval-transaction.test.ts` and fix US1 failures.

**Checkpoint**: A backend-only happy path can publish Business Context v1 from manual/user-provided evidence.

---

## Phase 5: User Story 2 - Ingest and Normalize Evidence Sources (Priority: P1)

**Goal**: Editors can register website, uploaded document, Meta, and manual sources; processing jobs normalize all source classes into source documents with evidence metadata.

**Independent Test**: Adapter and API tests register/process each source class through stubbed providers and verify source documents, content hashes, parser/provider metadata, budgets, and retryable job state.

### Tests for User Story 2

- [ ] T062 [P] [US2] Write unit tests for SSRF and crawl budget guard in `tests/unit/business-context/ssrf-guard.test.ts` covering localhost, private IPs, non-HTTP(S), approved-domain enforcement, and page/text limits.
- [ ] T063 [P] [US2] Write unit tests for upload validation in `tests/unit/business-context/upload-validator.test.ts` covering extension/MIME mismatch, encrypted file rejection, executable rejection, size limit, checksum, and duplicate detection.
- [ ] T064 [P] [US2] Write unit tests for document parser routing in `tests/unit/business-context/document-parser-router.test.ts` covering native-first routing, OCR fallback routing, image default OCR, and merge-without-duplicate-text behavior.
- [ ] T065 [P] [US2] Write contract tests for source APIs in `tests/contract/business-context/sources.test.ts` covering register, list, inspect, process, archive, and idempotency behavior.
- [ ] T066 [P] [US2] Write integration tests for context job lifecycle in `tests/integration/business-context/context-jobs.test.ts` covering queued, scheduled, running, retry waiting, succeeded, retryable failure, permanent failure, stalled, dead-lettered, cancelled, retry eligibility, exponential delays, heartbeat recovery, and structured error redaction.
- [ ] T067 [P] [US2] Write PaddleOCR worker contract test in `workers/paddleocr/tests/test_contract.py` covering job input, mocked private storage read, parsed output shape, parser metadata, and temp file cleanup behavior.

### Implementation for User Story 2

- [ ] T068 [US2] Implement SSRF and domain guard in `src/infrastructure/business-context/ssrf-guard.ts`.
- [ ] T069 [US2] Implement upload validation and checksum logic in `src/infrastructure/business-context/upload-validator.ts`.
- [ ] T070 [US2] Implement external content sanitization in `src/infrastructure/business-context/source-sanitizer.ts` for storage and LLM-safe text preparation.
- [ ] T071 [US2] Implement Firecrawl website adapter in `src/infrastructure/business-context/firecrawl-website.adapter.ts` with `/crawl`, `/scrape`, provider request ID, credit tracking, truncation metadata, and content-hash caching.
- [ ] T072 [US2] Implement native document parser adapter in `src/infrastructure/business-context/native-document-parser.adapter.ts` for text-based PDF, DOCX, XLSX, PPTX, and HTML outputs.
- [ ] T073 [US2] Implement PaddleOCR document parser adapter in `src/infrastructure/business-context/paddleocr-document-parser.adapter.ts` that queues/reads OCR results through the worker boundary rather than running OCR in-process.
- [ ] T074 [US2] Implement document parser router in `src/infrastructure/business-context/document-parser-router.ts` for native-first, OCR fallback, image default OCR, and merged `ParsedDocument` output.
- [ ] T075 [US2] Implement Meta source adapter in `src/infrastructure/business-context/meta-source.adapter.ts` that stores campaign, ad set, ad, and creative metadata as scoped operational evidence.
- [ ] T076 [US2] Implement manual source adapter in `src/infrastructure/business-context/manual-source.adapter.ts` for user answers and corrections.
- [ ] T077 [US2] Implement job runner in `src/infrastructure/business-context/job-runner.ts` for source processing jobs, worker leases, heartbeats, stage timeouts, attempt counts, retry classification, exponential backoff scheduling, stuck-job recovery, dead-lettering, circuit breaker checks, idempotency, stage visibility events, and sanitized errors.
- [ ] T078 [US2] Implement PaddleOCR worker scaffold in `workers/paddleocr/worker.py`, pinned dependencies in `workers/paddleocr/requirements.txt`, and operational notes in `workers/paddleocr/README.md`.
- [ ] T079 [US2] Implement `POST` and `GET /api/businesses/[id]/context/sources` in `src/app/api/businesses/[id]/context/sources/route.ts`.
- [ ] T080 [US2] Implement `GET /api/businesses/[id]/context/sources/[sourceId]` in `src/app/api/businesses/[id]/context/sources/[sourceId]/route.ts`.
- [ ] T081 [US2] Implement `POST /api/businesses/[id]/context/sources/[sourceId]/process` in `src/app/api/businesses/[id]/context/sources/[sourceId]/process/route.ts`.
- [ ] T082 [US2] Implement `POST /api/businesses/[id]/context/sources/[sourceId]/archive` in `src/app/api/businesses/[id]/context/sources/[sourceId]/archive/route.ts`.
- [ ] T083 [US2] Implement `POST /api/businesses/[id]/onboarding/scan` in `src/app/api/businesses/[id]/onboarding/scan/route.ts`.
- [ ] T084 [US2] Implement `GET /api/context-jobs/[id]` in `src/app/api/context-jobs/[id]/route.ts`.
- [ ] T085 [US2] Implement `POST /api/context-jobs/[id]/retry` in `src/app/api/context-jobs/[id]/retry/route.ts`.
- [ ] T086 [US2] Implement `GET /api/businesses/[id]/context/processing-runs` in `src/app/api/businesses/[id]/context/processing-runs/route.ts` for source/job processing timelines and aggregate visibility.
- [ ] T087 [US2] Implement `GET /api/businesses/[id]/context/processing-runs/[runId]` in `src/app/api/businesses/[id]/context/processing-runs/[runId]/route.ts` for per-stage event inspection.
- [ ] T088 [US2] Run `npm run test -- tests/unit/business-context/ssrf-guard.test.ts tests/unit/business-context/upload-validator.test.ts tests/unit/business-context/document-parser-router.test.ts tests/contract/business-context/sources.test.ts tests/integration/business-context/context-jobs.test.ts tests/integration/business-context/processing-visibility.test.ts tests/unit/business-context/circuit-breaker.test.ts` and `workers/paddleocr/.venv/bin/pytest workers/paddleocr/tests` and fix US2 failures.

**Checkpoint**: Source registration and processing can normalize every V1 source class without approving profile truth.

---

## Phase 6: User Story 3 - Extract Facts, Detect Gaps, and Resolve Conflicts (Priority: P2)

**Goal**: Normalized documents produce schema-validated facts; reconciliation detects gaps/conflicts and generates targeted questions.

**Independent Test**: Fixture source documents produce facts with evidence, invalid LLM output gets one repair attempt, conflicts preserve competing facts, and targeted questions are generated only for material gaps/conflicts.

### Tests for User Story 3

- [ ] T089 [P] [US3] Write extraction adapter tests in `tests/unit/business-context/llm-extraction.adapter.test.ts` for valid output, invalid output repair, and failed repair without partial persistence.
- [ ] T090 [P] [US3] Write resolver tests in `tests/unit/business-context/resolver.test.ts` for precedence order, recency/scope handling, conflict creation, missing required fields, and targeted question generation.
- [ ] T091 [P] [US3] Write integration tests in `tests/integration/business-context/extraction-jobs.test.ts` for concurrent extraction task outputs, persisted facts with source excerpts, fact quality gate results, facts extracted counters, warnings generated counters, and failure classes.
- [ ] T092 [P] [US3] Write contract tests in `tests/contract/business-context/conflicts.test.ts` for listing conflicts, resolving conflicts, and preserving resolved conflict history.

### Implementation for User Story 3

- [ ] T093 [US3] Implement LLM extraction adapter in `src/infrastructure/business-context/llm-extraction.adapter.ts` using schema-constrained tasks and one repair attempt.
- [ ] T094 [US3] Implement fact normalization and deduplication in `src/core/business-context/resolver.ts`.
- [ ] T095 [US3] Implement proposed-value precedence in `src/core/business-context/resolver.ts` using user-verified, authoritative source, operational system, website, Meta, and LLM inference order.
- [ ] T096 [US3] Implement conflict detection and question generation in `src/core/business-context/resolver.ts` for required gaps, uncertainty, and material contradictions.
- [ ] T097 [US3] Extend `src/infrastructure/business-context/job-runner.ts` to run extraction tasks for business/offers, customers, conversion journey, brand/proof/claims, gaps/contradictions, and profile synthesis with fact quality gates and extraction-stage visibility events.
- [ ] T098 [US3] Implement `GET /api/businesses/[id]/context/conflicts` in `src/app/api/businesses/[id]/context/conflicts/route.ts`.
- [ ] T099 [US3] Implement `POST /api/businesses/[id]/context/conflicts/[conflictId]/resolve` in `src/app/api/businesses/[id]/context/conflicts/[conflictId]/resolve/route.ts`.
- [ ] T100 [US3] Implement `POST /api/businesses/[id]/context/reconcile` in `src/app/api/businesses/[id]/context/reconcile/route.ts`.
- [ ] T101 [US3] Run `npm run test -- tests/unit/business-context/llm-extraction.adapter.test.ts tests/unit/business-context/resolver.test.ts tests/integration/business-context/extraction-jobs.test.ts tests/contract/business-context/conflicts.test.ts` and fix US3 failures.

**Checkpoint**: Evidence can become verified or unresolved facts without directly mutating approved profiles.

---

## Phase 7: User Story 4 - Manage Profile Versions After Onboarding (Priority: P2)

**Goal**: Authorized users can add corrections, compile next drafts, review diffs, approve new versions, and restore old versions while preserving history.

**Independent Test**: Starting from v1, create a correction, compile v2 draft, approve v2, restore v1 as v3, and verify current-version uniqueness and audit events.

### Tests for User Story 4

- [ ] T102 [P] [US4] Write compiler tests in `tests/unit/business-context/compiler.test.ts` for active fact selection, required section output, unresolved field output, blocking quality gate rejection, non-blocking quality warning propagation, and markdown projection.
- [ ] T103 [P] [US4] Write versioning tests in `tests/unit/business-context/versioning.test.ts` for draft version numbers, field-level diffs, approval status transitions, and restore-as-new-version semantics.
- [ ] T104 [P] [US4] Write contract tests in `tests/contract/business-context/context-management.test.ts` for get current context, patch facts, draft, diff, approve, list versions, and restore endpoints.
- [ ] T105 [P] [US4] Write audit integration tests in `tests/integration/business-context/audit-log.test.ts` for correction, conflict resolution, approval, source archive, and restore events.

### Implementation for User Story 4

- [ ] T106 [US4] Complete compiler implementation in `src/core/business-context/compiler.ts` for draft compilation, confidence thresholds, unresolved fields, and markdown projection.
- [ ] T107 [US4] Complete versioning implementation in `src/core/business-context/versioning.ts` for next version creation, field-level diffs, approval, and restore.
- [ ] T108 [US4] Extend `src/core/business-context/service.ts` with post-onboarding correction, draft, diff, approve, version list, and restore workflows.
- [ ] T109 [US4] Implement `GET /api/businesses/[id]/context` in `src/app/api/businesses/[id]/context/route.ts`.
- [ ] T110 [US4] Implement `PATCH /api/businesses/[id]/context/facts` in `src/app/api/businesses/[id]/context/facts/route.ts`.
- [ ] T111 [US4] Implement `POST /api/businesses/[id]/context/draft` in `src/app/api/businesses/[id]/context/draft/route.ts`.
- [ ] T112 [US4] Implement `GET /api/businesses/[id]/context/diff` in `src/app/api/businesses/[id]/context/diff/route.ts`.
- [ ] T113 [US4] Implement `POST /api/businesses/[id]/context/approve` in `src/app/api/businesses/[id]/context/approve/route.ts`.
- [ ] T114 [US4] Implement `GET /api/businesses/[id]/context/versions` in `src/app/api/businesses/[id]/context/versions/route.ts`.
- [ ] T115 [US4] Implement `POST /api/businesses/[id]/context/versions/[versionId]/restore` in `src/app/api/businesses/[id]/context/versions/[versionId]/restore/route.ts`.
- [ ] T116 [US4] Run `npm run test -- tests/unit/business-context/compiler.test.ts tests/unit/business-context/versioning.test.ts tests/contract/business-context/context-management.test.ts tests/integration/business-context/audit-log.test.ts` and fix US4 failures.

**Checkpoint**: Business Context is editable and versioned after onboarding without mutating current profiles directly.

---

## Phase 8: User Story 5 - Compile Task-Specific Context for NOVA Runtime (Priority: P3)

**Goal**: NOVA services can request purpose-scoped context and receive exact profile version metadata.

**Independent Test**: For each supported purpose, the compiler returns only allowed sections, unresolved fields, `business_context_version`, and compiled timestamp.

### Tests for User Story 5

- [ ] T117 [P] [US5] Write compiler-purpose tests in `tests/unit/business-context/context-purpose-compiler.test.ts` for `campaign_setup`, `performance_analysis`, `optimization`, `hypothesis_generation`, `creative_brief`, and `tracking_audit` section selection.
- [ ] T118 [P] [US5] Write contract test in `tests/contract/business-context/context-compile.test.ts` for `POST /api/businesses/:id/context/compile`, no-current-profile error, and profile version metadata.

### Implementation for User Story 5

- [ ] T119 [US5] Implement task-specific context selection in `src/core/business-context/compiler.ts`.
- [ ] T120 [US5] Add compile workflow to `src/core/business-context/service.ts` returning `purpose`, `business_context_version`, `context`, `unresolved_fields`, and `compiled_at`.
- [ ] T121 [US5] Implement `POST /api/businesses/[id]/context/compile` in `src/app/api/businesses/[id]/context/compile/route.ts`.
- [ ] T122 [US5] Add optional `business_context_version_id` fields to future AI run contract interfaces in `src/core/ai/types.ts` without changing AI runtime behavior.
- [ ] T123 [US5] Run `npm run test -- tests/unit/business-context/context-purpose-compiler.test.ts tests/contract/business-context/context-compile.test.ts` and fix US5 failures.

**Checkpoint**: Runtime systems can consume reproducible, purpose-scoped Business Context.

---

## Phase 9: Cross-Cutting Security, Benchmark, and Documentation

**Purpose**: Validate PRD acceptance criteria that span multiple stories.

- [ ] T124 [P] Add service-role leakage test in `tests/unit/business-context/server-secret-boundary.test.ts` that scans Business Context client-facing modules for `SUPABASE_SERVICE_ROLE_KEY` and rejects `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` usage.
- [ ] T125 [P] Add representative document benchmark harness in `workers/paddleocr/tests/test_representative_documents.py` for digital PDF, scanned PDF, PPTX, table-heavy document, and Meta creative image fixtures.
- [ ] T126 [P] Add third-party attribution notes for PaddleOCR Apache 2.0 usage in `workers/paddleocr/README.md` and repository third-party notices file if one exists.
- [ ] T127 Add quickstart validation notes to `specs/006-business-context-supabase/quickstart.md` after implementation command names are finalized.
- [ ] T128 Run full verification: `npm run lint`, `npm run test`, `npm run build`, and `workers/paddleocr/.venv/bin/pytest workers/paddleocr/tests`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Supabase Readiness Gate**: No dependencies; blocks all Business Context implementation.
- **Phase 2 Setup**: Depends on Phase 1 passing.
- **Phase 3 Foundational**: Depends on Phase 2 and blocks every user story.
- **Phase 4 US1**: Depends on Phase 3; creates MVP approved v1 path.
- **Phase 5 US2**: Depends on Phase 3; can run in parallel with US1 after shared repository/service interfaces stabilize.
- **Phase 6 US3**: Depends on Phase 5 source documents and Phase 3 repository contracts.
- **Phase 7 US4**: Depends on US1 approved profile and US3 fact/conflict workflows.
- **Phase 8 US5**: Depends on US4 profile versioning and compiler behavior.
- **Phase 9 Cross-Cutting**: Runs after desired story phases are complete.

### User Story Dependencies

- **US1 (P1)**: Can be delivered with manual/user-answer sources once Phase 3 is complete.
- **US2 (P1)**: Can be delivered after Phase 3 and adds all source ingestion classes.
- **US3 (P2)**: Requires normalized source documents from US2.
- **US4 (P2)**: Requires approved profiles from US1 and fact/conflict capabilities from US3.
- **US5 (P3)**: Requires current profile versions from US4.

### Parallel Opportunities

- T012-T016 can run in parallel after T010-T011 are understood.
- T018-T025 can run in parallel because they create separate test files.
- T032-T039 can run in parallel once migration table names are stable.
- T062-T067 can run in parallel because they cover separate adapters/worker contracts.
- T089-T092 can run in parallel because extraction, resolver, integration, and API conflict tests are separate files.
- T102-T105 can run in parallel because compiler, versioning, API, and audit tests are separate files.
- US1 and US2 implementation can proceed in parallel after Phase 3 if the service/repository interfaces are not changed incompatibly.

## Implementation Strategy

### MVP First

1. Complete Phase 1, Phase 2, and Phase 3.
2. Complete Phase 4 using manual/user-answer evidence.
3. Stop and validate that a business can reach approved Business Context v1 without website/document/Meta ingestion.

### Incremental Delivery

1. Add US2 source ingestion and job processing.
2. Add US3 extraction, reconciliation, conflicts, and questions.
3. Add US4 post-onboarding management/versioning.
4. Add US5 task-specific runtime compiler.
5. Complete cross-cutting security, benchmark, and docs validation.

### Review Gates

- Review migration/RLS before API implementation.
- Review domain ports before infrastructure adapters.
- Review approval SQL function before enabling approval endpoints.
- Review worker boundary before adding OCR-dependent routes.
- Review full acceptance criteria before claiming PRD 006 complete.
