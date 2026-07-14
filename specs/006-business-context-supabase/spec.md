# Feature Specification: Business Context Supabase Backend

**Feature Branch**: `006-business-context-supabase`

**Created**: 2026-07-14

**Status**: Draft

**Input**: PRD 006: Business Context Onboarding and Management (`PRD/006_business_context_supabase_prd.md`)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create an Approved Business Context v1 (Priority: P1)

An authenticated workspace editor creates a business, starts onboarding, supplies the required initial inputs and at least one evidence source, answers required follow-up questions, and approves Business Context v1 before NOVA produces recommendations.

**Why this priority**: This is the core outcome of the PRD. Without an approved, versioned profile, later recommendations cannot cite the business facts they used.

**Independent Test**: Use API calls against a Supabase test project to create a workspace member, create a business, create onboarding, submit manual evidence and answers, compile a draft, approve it, and verify exactly one current profile version exists.

**Acceptance Scenarios**:

1. **Given** an authenticated editor in a workspace, **When** they create a business with required onboarding inputs and submit verified answers for all required fields, **Then** the system publishes immutable Business Context v1 with status `current`.
2. **Given** required fields are missing or explicitly unresolved, **When** approval is requested, **Then** approval fails and the current profile remains unchanged.
3. **Given** a viewer in the same workspace, **When** they attempt a mutating onboarding action, **Then** the API rejects the request with an authorization error.

---

### User Story 2 - Ingest and Normalize Evidence Sources (Priority: P1)

An authenticated editor registers website, uploaded document, Meta, or manual-answer sources. The backend stores raw metadata, queues idempotent processing jobs, normalizes each source into `SourceDocument` records, and preserves source evidence for extracted facts.

**Why this priority**: Business Context must not depend on a website alone. A common source contract is required before extraction, conflict detection, and approval can work reliably.

**Independent Test**: Register one source of each V1 class through API endpoints, process each through stubbed infrastructure adapters in tests, and verify source documents include source type, content hash, parser metadata, evidence locators, and retryable job state.

**Acceptance Scenarios**:

1. **Given** a website source, **When** processing is queued, **Then** the backend enforces SSRF protections, crawl budgets, content-hash caching, and stores bounded normalized page documents.
2. **Given** an uploaded PDF, Office file, image, or presentation, **When** processing is queued, **Then** the backend validates extension and MIME type, stores the original in a private bucket, deduplicates by checksum, and records native-parser or PaddleOCR parser metadata.
3. **Given** a Meta source, **When** processing is queued, **Then** the backend stores campaigns, ad sets, ads, and creative metadata as scoped operational evidence without treating performance or creative copy as approved brand truth.

---

### User Story 3 - Extract Facts, Detect Gaps, and Resolve Conflicts (Priority: P2)

The system runs schema-constrained extraction jobs over normalized source documents, persists atomic facts with source excerpts, detects materially conflicting active facts, and generates targeted questions only for required gaps, uncertainty, or conflicts.

**Why this priority**: NOVA needs verified, evidence-backed facts. Extraction without reconciliation would create unreliable context and require users to manually review too much noise.

**Independent Test**: Feed fixture source documents into extraction and resolution services, then verify facts are Zod-validated before persistence, conflicts preserve all competing facts, and generated questions map to required missing fields or conflicts.

**Acceptance Scenarios**:

1. **Given** valid extraction output with facts and evidence, **When** the extraction job completes, **Then** each persisted fact stores key, JSON value, source, source document, excerpt, confidence, verification status, and validity period.
2. **Given** invalid LLM output, **When** schema validation fails, **Then** one repair attempt runs and the job fails without publishing partial profile state if repair also fails.
3. **Given** conflicting offer values from website and Meta evidence, **When** reconciliation runs, **Then** both facts remain stored, the field is unresolved, one targeted question is created, and no approved profile is mutated.

---

### User Story 4 - Manage Profile Versions After Onboarding (Priority: P2)

Authorized users inspect sources and facts, submit corrections, resolve conflicts, compile a draft next profile version, review field-level diffs, approve the draft, and restore earlier versions by creating a new version snapshot.

**Why this priority**: Business Context remains editable after onboarding and must preserve history for reproducibility and auditability.

**Independent Test**: Start with current v1, submit a correction, compile v2 draft, approve it, verify v1 is superseded, v2 is current, audit events exist, and restoring v1 creates v3 without deleting v2.

**Acceptance Scenarios**:

1. **Given** an approved current profile, **When** an editor adds a correction, **Then** the correction creates a new user-verified fact and a draft diff without mutating the current profile.
2. **Given** unresolved critical conflicts, **When** approval is requested, **Then** approval fails before any current-version status changes.
3. **Given** a previous profile version, **When** an admin restores it, **Then** the system creates a new current version from that snapshot and preserves all intervening versions.

---

### User Story 5 - Compile Task-Specific Context for NOVA Runtime (Priority: P3)

NOVA services request business context for a specific purpose and receive only the sections required for that task, plus unresolved fields and the exact business profile version used.

**Why this priority**: Future recommendations, hypotheses, briefs, and AI runs must be reproducible without sending the full business profile into every LLM request.

**Independent Test**: For each supported purpose, call the compiler with a current profile version and verify the response contains only allowed sections, unresolved fields, compiled timestamp, and `business_context_version` metadata.

**Acceptance Scenarios**:

1. **Given** a current profile, **When** `creative_brief` context is compiled, **Then** the response includes offers, customers, brand, creative capacity, and conversion journey only.
2. **Given** no current profile exists, **When** context compilation is requested, **Then** the API returns a clear not-ready error.
3. **Given** future AI-run persistence is added, **When** an AI run uses compiled context, **Then** it can store `business_context_version_id` for reproducibility.

### Edge Cases

- Website crawl target is localhost, private network, non-HTTP(S), over page budget, over text budget, or blocked by robots directives.
- Two sources have the same canonical URL but different content hashes, or different URLs with identical content hashes.
- Upload extension and detected MIME type disagree.
- Uploaded file is encrypted, password-protected, executable, malformed, over 50 MB, duplicate within the business, or infected according to malware scanning.
- Native document parsing succeeds for text but OCR also emits overlapping text from image-heavy pages.
- PaddleOCR worker times out or runs out of memory and must retry on a larger worker within configured limits.
- LLM output is valid JSON but violates the extraction schema.
- A processing job stops heartbeating while in a non-terminal stage and must be recovered or dead-lettered without duplicating facts.
- A provider repeatedly fails or exceeds configured error-rate thresholds and must trip a circuit breaker before more jobs are dispatched.
- A source processes successfully but fails document-quality or fact-quality gates and must remain reviewable without being eligible for approval.
- A user needs to inspect processing progress and see time spent per stage, attempts, failure classes, pages or slides processed, provider credits consumed, facts extracted, warnings generated, and quality scores.
- User marks a required fact as unknown instead of verified.
- Approval fails after draft insert but before current-version swap; transaction must prevent two current versions.
- RLS policy denies cross-workspace reads and writes even when a row ID is guessed.
- Service-role credentials are accidentally referenced by client-side code or logs.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST use Supabase Postgres as the V1 source of truth for Business Context data, including workspaces, memberships, businesses, onboarding sessions, sources, source documents, facts, conflicts, questions, profile versions, jobs, and audit logs.
- **FR-002**: The system MUST use private Supabase Storage buckets for original uploads, raw website snapshots when retained, large imports, creative assets, and archived provider payloads, with Postgres storing references, checksums, metadata, and ownership.
- **FR-047**: MVP/V1 development MUST use the local Supabase CLI stack for Postgres, Auth, Storage, migrations, RLS, seed data, and local API keys before linking to a hosted Supabase project.
- **FR-048**: SQLite, libSQL, Drizzle SQLite, mock repositories, and in-memory repositories MUST NOT back Business Context API endpoints, even during MVP. They may be used only as isolated unit-test doubles behind ports.
- **FR-003**: Every tenant-owned table MUST include `workspace_id`, enable RLS, and restrict reads and writes to authorized workspace members.
- **FR-004**: Workspace roles MUST support `owner`, `admin`, `editor`, and `viewer`; viewers are read-only, editors can create facts, answer questions, and create drafts, and owners/admins can approve and restore versions.
- **FR-005**: The backend MUST provide APIs for business creation, onboarding lifecycle, source registration, source processing, question answering, draft compilation, approval, profile retrieval, corrections, conflict resolution, diffing, version listing, restore, task-specific compilation, job polling, and eligible retry.
- **FR-006**: All mutating endpoints MUST require authentication, workspace authorization, input validation, and an idempotency key.
- **FR-007**: Onboarding sessions MUST support statuses `created`, `scanning`, `extracting`, `awaiting_review`, `awaiting_answers`, `ready_for_approval`, `approved`, and `failed`.
- **FR-008**: A session MUST NOT become `approved` until all required fields are user-verified or explicitly marked unknown.
- **FR-009**: Required initial onboarding inputs MUST include business name, at least one evidence source, primary country or market, primary advertising objective, primary business outcome, and approximate monthly Meta budget.
- **FR-010**: The source adapter contract MUST normalize website, uploaded document, Meta, and manual-input sources into the same `SourceDocument` domain contract before extraction.
- **FR-011**: V1 source types MUST include `website`, `brand_deck`, `brand_playbook`, `product_document`, `campaign_brief`, `research_document`, `user_answer`, `meta`, and `system_inference`, with future values reserved but not implemented.
- **FR-012**: Website ingestion MUST use Firecrawl server-side only, request clean Markdown, track provider request ID, credits consumed, page counts, parser mode, truncation, and enforce configurable page, text, file-size, and credit budgets before dispatch.
- **FR-013**: Website crawling MUST reject localhost, private-network, and non-HTTP(S) targets, remain on the approved domain, respect robots directives and timeouts, prefer sitemap URLs, prioritize commercially relevant pages, and treat crawled content as untrusted.
- **FR-014**: Upload ingestion MUST validate extension and detected MIME type allowlists, reject encrypted/password-protected/executable/malformed files, checksum before parsing, deduplicate identical uploads within a business, and archive rather than hard-delete sources from evidence history.
- **FR-015**: Native document parsing MUST be attempted first for text-based PDF, DOCX, XLSX, PPTX, and HTML when supported.
- **FR-016**: PaddleOCR MUST run outside the Next.js request process as a separate Python worker or internal service that consumes jobs, reads originals from private Supabase Storage, writes normalized results, and deletes temporary local files.
- **FR-017**: Document parser outputs MUST include Markdown, structured elements, parser name/version/model, warnings, page or slide locators, and bounding boxes when available.
- **FR-018**: Extraction jobs MUST run schema-constrained tasks for business/offers, customers/decision makers, conversion journey, brand/proof/claims, gaps/contradictions, and profile synthesis.
- **FR-019**: LLM extraction output MUST be validated with Zod before persistence, receive one schema-repair attempt, and fail without publishing partial profile state if still invalid.
- **FR-020**: Each material fact MUST preserve value, source, source excerpt, confidence, verification status, validity period, creation timestamp, and update/supersession history.
- **FR-021**: Fact resolution MUST propose current values using precedence: user-verified answer, authoritative business-owned source with explicit scope/effective date, connected first-party operational system, current official website, Meta evidence, LLM inference.
- **FR-022**: Material conflicts MUST preserve all competing facts, mark the field unresolved, generate one targeted question, record selected value and resolution note, and preserve resolved conflict history.
- **FR-023**: Questions MUST be generated only for required gaps, material uncertainty, or conflicts, using single choice, multiple choice, number/currency, short text, long text, or confirmation types.
- **FR-024**: User answers and manual corrections MUST create verified facts without deleting earlier evidence.
- **FR-025**: Draft profiles MUST compile from active facts using precedence, verification status, required-field validation, conflict state, and confidence thresholds.
- **FR-026**: Approval MUST run in one Postgres transaction or database function that validates required sections, rejects unresolved critical conflicts, inserts an immutable profile version, supersedes the previous current version, marks the approved version current, and writes audit.
- **FR-027**: Only one profile version per business MAY have status `current`, enforced by a partial unique index.
- **FR-028**: Later edits MUST create new facts, compile a draft next version, produce a field-level diff, require approval, and publish the next current version; current approved profiles MUST NOT be mutated directly.
- **FR-029**: Restoring an earlier profile MUST create a new version from the previous snapshot and MUST NOT delete intervening versions.
- **FR-030**: The context compiler MUST support `campaign_setup`, `performance_analysis`, `optimization`, `hypothesis_generation`, `creative_brief`, and `tracking_audit` purposes and return only required sections plus exact profile version metadata.
- **FR-031**: Future recommendations, hypotheses, briefs, and AI runs MUST be able to store `business_context_version_id` when those contracts are implemented.
- **FR-032**: Crawling, parsing, extraction, reconciliation, compilation, and approval-adjacent processing jobs MUST be asynchronous where long-running, idempotent, retryable only for classified retryable errors, and store structured errors without secrets.
- **FR-033**: The system MUST audit every user-verified fact, approval, restore, conflict resolution, source archival, and correction.
- **FR-034**: The backend MUST redact secrets and personal data from logs and job errors, keep service-role credentials server-side, and ensure no browser bundle contains service-role keys.
- **FR-035**: The implementation MUST preserve the repository ports-and-adapters boundary: core services do not import Supabase, Next.js, Firecrawl, PaddleOCR, Meta SDKs, or model SDKs.
- **FR-036**: Business Context endpoints MUST NOT use mock or in-memory persistence.
- **FR-037**: Source processing MUST expose explicit stages with terminal states. V1 stages are `registered`, `queued`, `acquiring`, `stored`, `parsing`, `normalizing`, `extracting`, `reconciling`, `quality_checking`, and `completed`; terminal source outcomes are `processed`, `processed_with_warnings`, `blocked_needs_user_action`, `failed_permanent`, and `archived`.
- **FR-038**: Job status MUST distinguish active, waiting, and terminal states: `queued`, `scheduled`, `running`, `retry_waiting`, `succeeded`, `failed_retryable`, `failed_permanent`, `stalled`, `dead_lettered`, and `cancelled`.
- **FR-039**: Retryable jobs MUST use exponential backoff with jitter, persisted `next_run_at`, `max_attempts`, `attempt_count`, and retry classification. V1 default delays are 30 seconds, 2 minutes, 10 minutes, and 30 minutes, capped at 4 attempts unless a job type sets a stricter limit.
- **FR-040**: Non-retryable validation, authorization, unsupported-file, malware, SSRF, budget-exceeded, and schema-contract failures MUST fail permanently without automatic retry.
- **FR-041**: Stuck running jobs MUST be recovered by persisted worker heartbeat. A job with no heartbeat for 2 times its stage timeout MUST become `stalled`; retryable stalled jobs return to `retry_waiting`, while exhausted stalled jobs move to `dead_lettered`.
- **FR-042**: Provider circuit breakers MUST prevent dispatch to Firecrawl, Meta, LLM extraction, native parsing, or PaddleOCR when rolling failure rate, timeout rate, or quota/budget exhaustion crosses configured thresholds. Circuit breaker states are `closed`, `open`, and `half_open`.
- **FR-043**: Every processing stage MUST emit visibility events with stage name, status, attempt number, worker identifier, start/end timestamps, duration, counts processed, provider request ID where applicable, credits or cost units consumed, warning count, failure class, and sanitized error details.
- **FR-044**: Document quality gates MUST run before fact extraction and record pass/warn/fail results for MIME validation, malware scan status, checksum/content hash, text extraction coverage, page or slide coverage, OCR confidence when applicable, truncation, parser warnings, and evidence locator availability.
- **FR-045**: Fact quality gates MUST run before facts are proposed for profile compilation and record pass/warn/fail results for schema validity, source link, source excerpt, evidence locator when available, confidence threshold, contradiction state, source authority, recency/effective date, and whether user verification is required.
- **FR-046**: Processing visibility MUST be queryable by authorized workspace members for each source and job, including total time per stage, attempts, failure types, pages/slides processed, credits consumed, facts extracted, warnings generated, and quality gate results.

### Key Entities *(include if feature involves data)*

- **Workspace**: Tenant boundary for businesses and users; owns memberships and all Business Context records through `workspace_id`.
- **WorkspaceMember**: User-role membership in a workspace with role-based authorization.
- **Business**: Client business being onboarded and managed.
- **OnboardingSession**: Lifecycle record that tracks onboarding status, current step, start/completion, and structured error state.
- **ContextSource**: Logical evidence source such as website, brand deck, Meta, or user answer.
- **SourceDocument**: Normalized source payload produced by adapters and parsers before extraction.
- **ContextFact**: Atomic material fact with evidence, confidence, verification status, and validity/supersession metadata.
- **ContextConflict**: Record of materially different active fact values for the same key and its resolution history.
- **OnboardingQuestion**: Targeted question generated for required gaps, uncertainty, or conflicts, with answer state.
- **BusinessProfileVersion**: Immutable compiled profile snapshot with version number, status, markdown projection, approval metadata, and change summary.
- **ContextJob**: Idempotent asynchronous job for crawling, parsing, extraction, reconciliation, compilation, retry, and worker execution.
- **ProcessingRun**: Per-source pipeline execution that records current stage, terminal outcome, aggregate counters, warnings, cost, and quality summary.
- **ProcessingStageEvent**: Append-only stage visibility event for progress, timing, attempts, failures, warnings, and cost attribution.
- **QualityGateResult**: Document-quality or fact-quality gate result with measured values, pass/warn/fail status, and blocker reason.
- **ProviderCircuitBreaker**: Provider health state that gates dispatch when failures, timeouts, or quotas cross configured thresholds.
- **ContextAuditLog**: Structured audit event for user and system actions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A business can progress from any one supported initial evidence source to approved Business Context v1 through backend APIs only.
- **SC-022**: `supabase start` and `supabase db reset` succeed locally, apply all Business Context migrations, create private buckets, seed test memberships, and support local RLS tests before any Business Context endpoint is considered ready.
- **SC-002**: Website scans are bounded, asynchronous, idempotent, and safely retryable without duplicating unchanged source documents.
- **SC-003**: Supported uploaded documents are parsed asynchronously, deduplicated by checksum, and safely retryable.
- **SC-004**: PPT/PPTX ingestion preserves slide-level evidence through native extraction and OCR fallback where needed.
- **SC-005**: Scanned PDFs and image uploads produce searchable Markdown plus page-level and bounding-box evidence.
- **SC-006**: One representative-document benchmark covers digital PDF, scanned PDF, PPTX, table-heavy document, and Meta creative image before production enablement.
- **SC-007**: Parser and model versions are recorded for every parsed document so a document can be reprocessed and compared after upgrade.
- **SC-008**: Every extracted fact links to a source and excerpt.
- **SC-009**: Material contradictions generate targeted questions and prevent approval until resolved or explicitly marked unknown when allowed.
- **SC-010**: User answers create verified facts without deleting earlier evidence.
- **SC-011**: Approval creates exactly one immutable current profile version per business.
- **SC-012**: Later edits create a draft and field-level diff before publishing a new current version.
- **SC-013**: Previous versions remain available and restorable by creating a new version.
- **SC-014**: Context compilation succeeds for every supported task purpose and identifies the profile version used.
- **SC-015**: RLS prevents cross-workspace access in automated tests.
- **SC-016**: No service-role credential is exposed to client code or persisted Business Context JSON.
- **SC-017**: Every processed source exposes a stage timeline with durations, attempts, processed counts, warning counts, provider cost/credit units, and final terminal outcome.
- **SC-018**: Retryable failures follow persisted exponential backoff and exhausted jobs move to `dead_lettered` without duplicating source documents or facts.
- **SC-019**: Stuck jobs with expired heartbeats are recovered automatically and recorded as stalled before retry or dead-letter transition.
- **SC-020**: Circuit breakers stop provider dispatch when configured thresholds are crossed and allow a half-open probe before returning to normal dispatch.
- **SC-021**: Document and fact quality gates produce persisted pass/warn/fail results, and failed blocking gates prevent approval until corrected or explicitly accepted where allowed.

## Constitution Compliance

- **I. Hexagonal Architecture**: Domain logic is planned under `src/core/business-context`; Supabase, Firecrawl, Meta, LLM, parser, and worker details stay in infrastructure adapters and are wired through `Container`.
- **II. Declarative Single-Source-of-Truth Configuration**: Approved Business Context lives in immutable `business_profile_versions.profile`; Markdown is a projection only.
- **III. Ports & Adapters Discipline**: New external dependencies use repository, source-adapter, document-parser, and extraction ports.
- **IV. TypeScript Strict, Domain-First**: New TypeScript code must use strict domain types, string-literal unions, path aliases, and no new `any`.
- **V. API Conventions**: New route handlers use Next.js App Router conventions, `NextResponse.json`, canonical error envelopes, JSDoc, and `Container` services.
- **VI-VIII. Frontend Rules**: Frontend implementation is deferred, so this spec does not introduce UI, new client state, or design-token changes.
- **IX. Testing**: This feature adopts Vitest and pytest tests for ports, services, APIs, RLS, jobs, worker contracts, and quality gates.
- **X. Observability & Error Handling**: Processing stage events, sanitized structured errors, retry classifications, and provider circuit breaker states are required.
- **XI. Tech Stack**: Planned dependencies are limited to Supabase client/test tooling and worker/parser dependencies required by the PRD.
- **XII. Tracked Migrations & Tech Debt**: Business Context endpoints must not repeat existing adapter-instantiation or mock-persistence violations.

## Assumptions

- Frontend onboarding and Business Context tab UI are deferred; this feature delivers backend behavior, persistence, APIs, worker contracts, and test fixtures.
- Existing NextAuth authentication remains the session mechanism for API users; Supabase service-role access is used only in server-side infrastructure adapters and jobs.
- Supabase project configuration and CLI artifacts are added to this repository. MVP development runs against local Supabase CLI first; production project IDs, service-role keys, and storage credentials are supplied through environment variables only when linking to hosted Supabase later.
- Hosted Supabase migration later uses the same migration files through `supabase link`, `supabase db push --dry-run`, and `supabase db push`; data, auth users, storage files, and secrets require a separate migration runbook.
- Firecrawl is the V1 website acquisition service and is called only from server-side code.
- PaddleOCR worker code may live in this repository under `workers/paddleocr`, but it is deployed separately from the Next.js process.
- Meta integration initially stores configuration and creative metadata as evidence; automatic Meta mutations and performance-driven truth updates remain out of scope.
- Shopify, CRM, revenue integrations, competitor discovery, creative generation, hypothesis/experiment management, automatic Meta mutations, and DuckDB analytical jobs remain deferred.
