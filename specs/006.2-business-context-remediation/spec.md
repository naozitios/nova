# Feature Specification: Business Context Pipeline Remediation

**Feature Directory**: `006.2-business-context-remediation`
**Created**: 2026-07-15
**Status**: Ready for Implementation
**Input**: Complete PRD 006 backend behavior required before `PRD/007_business_context_frontend_prd.md` can operate against real ingestion and onboarding.

## User Scenarios & Testing

### User Story 1 - Process Sources in Background (Priority: P1)

An authorized editor adds a website, modern document, connected Meta account, or manual source. NOVA accepts it quickly, processes it after the request ends, and reports truthful progress until success, actionable block, or permanent failure.

**Independent Test**: Start local Supabase, application, and separate worker; submit a source through authenticated HTTP; poll it; verify normalized documents, facts, ordered stages, and terminal states without direct test mutation of lifecycle tables.

**Acceptance Scenarios**:

1. Valid source requests return queued state within two seconds and are claimed within ten seconds.
2. Acquisition, storage, parsing, normalization, extraction, reconciliation, quality, and completion stages are persisted; non-applicable stages are explicitly skipped.
3. Same idempotency key plus same payload returns one resource and one execution; different payload returns `IDEMPOTENCY_KEY_REUSED`.
4. Retryable failures use persisted backoff and heartbeat recovery without duplicate documents or facts.
5. Scanned documents retain originals and become `blocked_needs_user_action` with `OCR_REQUIRED`.

### User Story 2 - Upload and Manage Evidence (Priority: P1)

An editor uploads business documents directly to private storage, selects or confirms document class, sees independent processing state, retries eligible failures, inspects evidence, and archives without erasing history.

**Independent Test**: Create upload intent through HTTP, upload to signed private target, finalize, wait for worker, inspect evidence, and archive using real local Supabase Storage.

**Acceptance Scenarios**:

1. PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, HTML, and text files up to 50 MB receive short-lived workspace/business-scoped upload targets.
2. Finalization verifies intent ownership, expiry, object existence, size, magic bytes/container signature, and metadata before queueing.
3. Duplicate checksums within one business do not duplicate extraction work.
4. Unsafe, empty, malformed, mismatched, or oversized files create zero facts and stable permanent failures.
5. Modern PDF, DOCX, PPTX, XLSX, HTML, and text formats use native parsing.
6. Legacy DOC, PPT, and XLS retain originals and become blocked with `LEGACY_FORMAT_UNSUPPORTED` under current frozen dependencies.
7. Archive preserves originals, documents, facts, runs, events, and audit history.

### User Story 3 - Extract Evidence-Backed Facts (Priority: P1)

NOVA extracts facts according to document class, filters empty claims, preserves evidence, reconciles sources, and generates targeted questions for required gaps or material conflicts.

**Independent Test**: Process versioned marketing, business-plan, and financial fixtures through production extraction modules; verify expected-key recall, excerpts, locators, null filtering, conflicts, and questions.

**Acceptance Scenarios**:

1. Marketing sources consider offers, audiences, channels, messaging, metrics, creative strategy, competitors, and brand voice when evidenced.
2. Business-plan and financial sources use their own allowed taxonomies.
3. Null, empty-string, empty-array, empty-object, and non-positive-confidence candidates are rejected.
4. Every material fact has source, source document, excerpt, confidence, verification status, and available locator.
5. Conflicting active facts preserve all evidence, create one open conflict and one targeted question, and block approval.
6. Invalid model output gets at most one repair attempt and never publishes partial facts after failed repair.

### User Story 4 - Complete Initial Onboarding (Priority: P1)

An editor creates a business, optionally supplies a website, starts or resumes onboarding, watches processing, answers generated questions, reviews a fact-backed profile, and an owner/admin approves v1.

**Independent Test**: Through authenticated HTTP using a real NextAuth server session, create business/session, queue optional website, process evidence, answer questions, compile nested draft, approve, and verify one current v1.

**Acceptance Scenarios**:

1. Business creation persists brand name, market, advertising objective, business outcome, optional website, and optional business type as provenance-backed initial context.
2. Optional website registers and queues immediately; no pre-existing initial source array is required.
3. One active initial session resumes and reports source counts, jobs, questions, blockers, readiness, and latest valid PRD 007 route stage.
4. Draft uses extracted and user-verified facts, not question rows alone, and nests dot-separated keys.
5. Answers reuse one session-scoped `user_answer` source, create linked verified facts or explicit unknown facts, and preserve earlier evidence.
6. Approval requires complete sections, no blocking conflict/quality failure, and no required source still processing.
7. Successful approval atomically creates sole current v1 and marks session approved; rejected approval changes nothing.

### User Story 5 - Update Existing Context Safely (Priority: P2)

An existing business resumes one update session while current approved context remains active, adds evidence or corrections, reviews diff, and publishes later version without overwriting concurrent approval.

**Independent Test**: Start from v1, create/resume update, edit fact, compile draft, force stale base, observe 409 with intact draft, refresh, approve v2, and verify immutable history.

**Acceptance Scenarios**:

1. Repeated update starts return same active session.
2. Current approved profile remains available until update approval.
3. Permanent fact edits create superseding user-verified correction facts and preserve old evidence.
4. Diff returns old/proposed values, evidence source, and reason by section.
5. Stale approval returns `STALE_PROFILE_VERSION` without changing current or draft state.
6. Valid approval transactionally creates sole next current version.

### User Story 6 - Operate Safely (Priority: P2)

Operators and workspace users can trust tenant isolation, roles, retry/recovery, provider circuits, visibility, and redacted failures.

**Independent Test**: Exercise HTTP roles, direct user-JWT RLS, two workers, restart recovery, circuit behavior, archive races, and redaction using real local boundaries.

**Acceptance Scenarios**:

1. Guessed cross-workspace IDs fail through API authorization and Supabase RLS.
2. Stale heartbeat becomes stalled then retry/dead-letter according to policy.
3. Open provider circuit pauses dispatch until allowed half-open probe.
4. Viewer may inspect sanitized state but cannot mutate, retry, answer, archive, or approve.
5. Logs/errors contain no source body, provider token, service-role key, or personal marker.
6. Background Meta collection resolves encrypted workspace credentials; missing/expired/disconnected/cross-workspace connections fail safely.

### Edge Cases

- Upload finalization before object completion, after expiry, twice, or against foreign path.
- Concurrent requests reuse one key with same or different payload.
- Two workers race one job; worker dies after provider call or during persistence.
- Website resolves/redirects to private network, leaves approved domain, or exceeds budgets.
- Meta token expires, account belongs elsewhere, or one subresource fails.
- Parser emits whitespace, partial pages, duplicate slides, warnings, or changed version.
- Generated question already exists, was answered/dismissed, or becomes obsolete.
- Archive occurs while job queued/running.
- Approval retries, races another approval, or uses stale base.

## Requirements

### Functional Requirements

- **FR-001**: Client-initiated mutations MUST use durable idempotency scoped by workspace, operation, key, and canonical request fingerprint. OAuth callbacks that cannot supply `Idempotency-Key` MUST instead consume signed state once and durably reject replay of the state or provider authorization code.
- **FR-002**: A separately runnable Node worker MUST execute Business Context jobs outside Next.js requests and support multiple instances.
- **FR-003**: Production MUST register a real `source_processing` handler coordinating acquisition, storage verification, parsing, normalization, extraction, reconciliation, quality, persistence, and terminal state.
- **FR-004**: Claims MUST use persisted leases/heartbeats; retries MUST not duplicate documents, facts, conflicts, questions, audits, or successful attempts.
- **FR-005**: Every applicable stage MUST emit persisted events; non-applicable stages MUST emit skipped events.
- **FR-006**: Terminal outcomes are `processed`, `processed_with_warnings`, `blocked_needs_user_action`, `failed_permanent`, and `archived`.
- **FR-007**: Worker MUST have documented start command, unique identity, graceful stop, and recoverable lease behavior.
- **FR-008**: Editors MUST create short-lived private upload intents for allowed files up to 50 MB.
- **FR-009**: Upload intent MUST bind workspace, business, source type, document class, server-derived classification provenance, filename, MIME, expected size, private path, creator, and expiry. Clients may choose a class directly or accept a server-signed classification proposal, but cannot assert `system_proposed` themselves.
- **FR-010**: Finalization MUST verify intent/object ownership, expiry, existence, size, metadata, content signature, and a production malware scan before queueing; unavailable scanning fails closed.
- **FR-011**: Direct authenticated table mutation MUST NOT finalize upload intents; server service owns transitions.
- **FR-012**: Processing MUST validate magic bytes/container signatures independently of declarations, reject unsafe content, hash SHA-256, and deduplicate within business.
- **FR-013**: Archiving MUST preserve evidence/history.
- **FR-014**: Source registration MUST use discriminated source-specific metadata and never discard it.
- **FR-015**: Website ingestion MUST use server-side Firecrawl, reject localhost/private/non-HTTP(S) targets before and after redirects, remain on the approved registrable domain, obey robots/timeouts, cap scans at 30 pages and 5 MB normalized text, deduplicate canonical URL/content hash, and treat content as untrusted data rather than instructions.
- **FR-016**: Meta ingestion MUST resolve encrypted workspace connection server-side, refresh eligible credentials, validate account ownership, and never accept/persist browser tokens.
- **FR-017**: Manual sources MUST preserve user/system provenance.
- **FR-018**: Native parsing MUST precede OCR decisions for supported modern formats.
- **FR-019**: Insufficient text MUST retain original, return `OCR_REQUIRED`, recommend `PROVIDE_MANUAL_TEXT`, and allow linked manual source reconciliation.
- **FR-020**: Legacy DOC/PPT/XLS MUST retain original and return `LEGACY_FORMAT_UNSUPPORTED` until a converter is separately approved.
- **FR-021**: Extraction MUST select versioned prompt/taxonomy by marketing, business-plan, financial, brand, product, research, website, Meta, or manual class.
- **FR-022**: Output MUST pass strict schema, allowed key, value, confidence, and evidence checks before persistence.
- **FR-023**: Null-like and non-positive-confidence facts MUST be rejected.
- **FR-024**: Material facts MUST persist source/document/excerpt/confidence/verification and available locator.
- **FR-025**: Invalid output gets at most one repair and no partial publication.
- **FR-026**: Versioned marketing/business-plan/financial fixtures MUST define expected keys and evidence.
- **FR-027**: Reconciliation MUST normalize keys, apply precedence, preserve competing facts, and permit one open conflict per business/key.
- **FR-028**: Required gaps, uncertainty, and conflicts MUST create/refresh targeted questions; obsolete opens become dismissed without deleting history.
- **FR-029**: Questions MUST expose stable ID, fact key, backend-authored prompt, control type, typed options, explicit `allows_unknown`, reason, priority, status, and typed answer/unknown state.
- **FR-030**: Answers/corrections MUST create linked user-verified facts through one session-scoped manual source and preserve prior facts.
- **FR-031**: Sessions MUST persist `initial|update` mode, step, status, base/draft version, start/completion, and sanitized error.
- **FR-032**: One business MUST have at most one active session; repeated starts resume it.
- **FR-033**: Backend MUST derive session status and PRD 007 route stage from persisted source/job/question/conflict/quality/version state.
- **FR-034**: Readiness MUST return session, route stage, source outcomes, active job summaries, questions, blockers, per-section readiness, approval readiness, current version, and draft/base version.
- **FR-035**: Initial drafts MUST compile active extracted and verified facts through shared precedence and nested keys.
- **FR-036**: Readiness MUST apply the deterministic matrix below, resolved blocking conflicts/quality, and required processing completion.
- **FR-037**: Initial approval MUST atomically publish sole current v1, audit, and approve session.
- **FR-038**: Update session MUST preserve current profile while draft exists.
- **FR-039**: Draft MUST store base version and expose attributed field diff.
- **FR-040**: Approval MUST require expected base; stale base returns 409 and preserves draft/current.
- **FR-041**: Successful update MUST publish exactly one next current version and preserve history.
- **FR-042**: All client-initiated mutating HTTP endpoints MUST require idempotency key, verified identity, role, and validated input. Meta OAuth callback is the sole header exception and MUST use signed one-time state plus durable provider-code replay protection.
- **FR-043**: Business Context HTTP routes MUST use `getServerSession()` through the NextAuth adapter and map its stable user ID to workspace membership. Direct Supabase user JWTs are limited to RLS verification and server-to-Supabase user-scoped access. `X-User-Id` is allowed only behind an explicit local-test flag that is disabled in production and E2E.
- **FR-044**: RLS MUST isolate every tenant-owned Business Context table and Storage path.
- **FR-045**: Service role MAY seed/inspect tests but MUST NOT prove RLS or user authorization.
- **FR-046**: Retry MUST reject permanent validation, blocked OCR, and blocked legacy-format failures.
- **FR-047**: Visibility MUST expose safe timings, attempts, counts, warnings, provider request IDs/cost, quality, failure code, retryability, and outcome.
- **FR-048**: Errors/logs MUST use stable codes and redact contents, tokens, keys, personal data, and provider bodies.
- **FR-049**: API E2E MUST start its own app and worker and use real Supabase/Auth/Storage/persistence.
- **FR-050**: Provider-gated tests MUST have required credentialed CI/release task and cannot silently pass when skipped.
- **FR-051**: Business creation MUST persist PRD 007 fields as provenance-backed context and queue optional website without mandatory initial source array.
- **FR-052**: Permanent fact edits MUST create verified correction facts, preserve prior evidence, create draft change, and require approval.
- **FR-053**: API contract MUST enumerate business creation, onboarding lifecycle, uploads, sources, jobs/runs, profile/facts, conflicts, draft/diff/approval, versions/restore, and Meta connection status.
- **FR-054**: Version API MUST expose typed list, detail, arbitrary comparison, and expected-current restore operations with approver, approval time, and change summary.
- **FR-055**: Upload malware scanning MUST run through a port before parsing, persist only a safe result/code, never log document content, and reject infected, suspicious, unavailable, or timed-out scans without creating facts.
- **FR-056**: Backend MUST provide a stateless, expiring, signed document-class proposal from filename/MIME/source hints. Upload creation MUST accept either a user-selected class or that signed proposal, validate its binding and expiry, and persist `user_selected` or `system_proposed` server-side.

### Deterministic Readiness Matrix

Initial approval requires one completed usable website, uploaded document, or connected Meta evidence source plus these fact keys: `business.name`, `market.primary`, `advertising.primary_objective`, `business.primary_outcome`, and `economics.monthly_meta_budget`. `user_answer` and `system_inference` sources may satisfy fact values but cannot satisfy the evidence-source requirement alone. Each required fact must be user-verified or carry an explicit user-authored unknown marker; `business.name` cannot be unknown. Evidence-source presence cannot be satisfied by an unknown marker.

Sections are projected as `ready | incomplete | blocked`. Missing required keys produce `incomplete`; open material conflicts, blocking quality failures, required sources still queued/running, malware-scan failures, and stale draft bases produce `blocked`. Optional Meta connection never blocks approval. Update mode evaluates only changed required facts plus all global blockers, preserves current approved profile, and requires an attributed diff against the captured base. These rules, required keys, and route-stage mapping are versioned backend policy and returned in readiness DTOs; frontend never recreates them.

### Key Entities

- **UploadIntent**: Expiring authorization for one declared private object.
- **MetaConnection**: Server-only encrypted workspace connection with sanitized account status.
- **IdempotencyRecord**: Durable operation/key/fingerprint result reservation.
- **ContextSource / SourceDocument**: Logical source and immutable normalized evidence.
- **ContextJob / ProcessingRun / StageEvent**: Queued work, one execution, and append-only visibility.
- **ContextFact / ContextConflict / OnboardingQuestion**: Evidence-backed statements, competing values, and targeted user resolution.
- **OnboardingSession / ProfileDraft / BusinessProfileVersion**: Resumable lifecycle, base-linked proposal, and immutable approved truth.

## Success Criteria

- **SC-001**: Self-starting HTTP E2E completes business creation through approved v1 using real app, worker, NextAuth server session, Supabase, Storage, and persistence.
- **SC-002**: Worker claims local queued source within 10 seconds without direct lifecycle-table updates in tests.
- **SC-003**: Same-key concurrency produces one execution in 100 repeated races; key/payload mismatch always returns 409.
- **SC-004**: Two workers produce no duplicate successful outputs in 100 claim races.
- **SC-005**: Digital PDF, DOCX, PPTX, XLSX, HTML, and text fixtures process; infected, suspicious, malformed, or mismatched fixtures create zero facts; DOC, PPT, and XLS fixtures each retain originals and block truthfully.
- **SC-006**: Scanned files retain originals, return `OCR_REQUIRED`, never auto-retry, and can be supplemented by linked manual text.
- **SC-007**: Corpus reaches at least 80% required-key recall per class, rejects 100% null-like candidates, and gives 100% accepted material facts excerpts.
- **SC-008**: Conflicts create exactly one open conflict/question per normalized key and block approval.
- **SC-009**: Readiness always reports one valid PRD 007 route stage.
- **SC-010**: Business initial fields and optional website persist correctly; no initial source array is mandatory.
- **SC-011**: Initial/update approvals leave exactly one current version; stale update returns 409 with intact draft.
- **SC-012**: NextAuth HTTP role matrix and separate real Supabase user-JWT RLS matrix deny unauthorized/cross-workspace access across the full tenant surface.
- **SC-013**: Worker restart recovers/dead-letters without duplicate outputs.
- **SC-014**: Success/failure log scan finds zero fixture secrets, tokens, keys, source-body, or personal markers.
- **SC-015**: Contract inventory covers every backend operation required by PRD 007 without frontend-derived business rules.

## Constitution Compliance

- Hexagonal core depends on ports; infrastructure owns Supabase/providers/processes.
- Immutable profile version remains source of approved truth.
- Routes resolve services through `Container`; no route-level adapter construction.
- Strict TypeScript, path aliases, string unions, no new `any`.
- Canonical API error envelopes, JSDoc, auth, role, validation, idempotency.
- No frontend code; DTOs support later typed PRD 007 client.
- Hybrid staged verification: implementation may precede or accompany focused tests within bounded dependency waves. Focused unit/typecheck and required subsystem gates must pass before completion. Regression coverage required for bug fixes. Real database/Storage/Auth/RLS/HTTP/worker/transaction boundaries.
- Existing stack only; no new queue, ORM, auth, UI, or LLM provider.

## Assumptions and Scope

- Existing PRD 006 schema/services/adapters are repaired, not replaced.
- PRD 007 frontend starts only after this readiness gate.
- Separate Node worker deploys beside Next.js.
- OCR and legacy conversion are explicitly deferred with retained originals/actionable states.
- Meta work is limited to secure connection/status needed for evidence ingestion, not broader Meta data foundation.
- Frontend pages/components, Shopify/CRM, creative generation, hypothesis work, and automatic Meta mutation are out of scope.
