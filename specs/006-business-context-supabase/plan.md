# Implementation Plan: Business Context Supabase Backend

**Branch**: `006-business-context-supabase` | **Date**: 2026-07-14 | **Spec**: `specs/006-business-context-supabase/spec.md`

**Input**: Feature specification from `/specs/006-business-context-supabase/spec.md`

## Summary

Build the backend-only Business Context system for NOVA: Supabase persistence and RLS, onboarding session APIs, normalized multi-source ingestion, asynchronous context jobs, fact extraction and reconciliation, profile versioning/approval, audit history, and task-specific context compilation. The implementation keeps domain logic in `src/core/business-context`, integrates Supabase, Firecrawl, document parsing, Meta, LLM extraction, and job execution through infrastructure adapters, and leaves final frontend screens deferred.

## Technical Context

**Language/Version**: TypeScript 5 with strict mode for the Next.js app; Python 3.11+ for the separate PaddleOCR worker boundary.

**Primary Dependencies**: Next.js 16.1.1 App Router, React 19.2.3, Zod 4.3.5, Supabase JS/server client, Firecrawl HTTP API, Groq-compatible LLM adapter through existing AI infrastructure, native document parsing libraries selected during implementation, PaddleOCR Python packages pinned in worker requirements.

**Storage**: Local Supabase CLI Postgres and private local Supabase Storage buckets are the MVP development source of truth. Hosted Supabase uses the same migrations later. Existing SQLite/Drizzle campaign persistence is not reused for Business Context.

**Testing**: Add Vitest for TypeScript unit/integration tests, Supertest or Next route-handler test utilities for API contracts, Supabase local CLI or test project migrations for RLS/database tests, and pytest for PaddleOCR worker contract tests.

**Target Platform**: Next.js server runtime on Node.js for API routes and jobs; separate Python worker or internal service for PaddleOCR; local Supabase CLI for MVP development; hosted Supabase managed Postgres and Storage after link/push readiness.

**Project Type**: Full-stack web application with backend/domain focus for this feature.

**Performance Goals**: Queue long-running website/document/LLM work instead of blocking API requests; V1 website scans limited to 30 pages and 5 MB normalized text per business; uploaded files limited to 50 MB; context compiler returns purpose-scoped JSON without embedding complete profiles; processing visibility records duration and counters for every stage.

**Constraints**: No Business Context endpoint may use SQLite, libSQL, mock, or in-memory persistence; service-role keys stay server-side; external content is untrusted; website crawl SSRF protection is mandatory; approval must be transactional and never leave two current profile versions; stuck jobs must be recovered by heartbeat; retry backoff, quality gates, and circuit breaker transitions must be persisted.

**Scale/Scope**: Backend V1 covers workspaces, memberships, businesses, onboarding, sources, source documents, facts, conflicts, questions, profile versions, jobs, audit logs, API contracts, and worker contracts. Frontend screens, Shopify/CRM/revenue integrations, competitor discovery, creative generation, automatic Meta mutations, and DuckDB analytical jobs are deferred.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Ports-and-adapters boundary**: PASS. Core Business Context services live under `src/core/business-context` and do not import Supabase, Next.js, Firecrawl, PaddleOCR, Meta SDKs, or model SDKs.
- **Persistent source of truth**: PASS. Local Supabase CLI Postgres and Storage are the MVP source of truth; hosted Supabase later uses the same migrations. No SQLite, mock, or in-memory implementation is planned for Business Context endpoints.
- **Tenant isolation**: PASS. Every tenant-owned table includes `workspace_id`, RLS is enabled, and API authorization checks mirror RLS role semantics.
- **Evidence and auditability**: PASS. Facts preserve source/excerpt/evidence locator, versions are immutable, compiled context records profile version, and user-verified facts/approvals/restores are audited.
- **Security**: PASS. Crawl SSRF guards, private storage, service-role isolation, upload validation, malware-scan hook, secret redaction, and external-content sanitization are implementation requirements.
- **Observability and error handling**: PASS. Processing stage events, retry classes, heartbeat recovery, circuit breakers, sanitized errors, and quality gates are planned as first-class persisted records.
- **Testability**: PASS. Tasks include unit, repository, API contract, RLS, job retry, stuck-job recovery, circuit breaker, quality gate, and worker contract tests before implementation tasks.

## Project Structure

### Documentation (this feature)

```text
specs/006-business-context-supabase/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/api/
│   ├── businesses/
│   │   ├── route.ts
│   │   └── [id]/
│   │       ├── onboarding/
│   │       │   ├── route.ts
│   │       │   ├── scan/route.ts
│   │       │   ├── questions/route.ts
│   │       │   ├── answers/route.ts
│   │       │   ├── compile/route.ts
│   │       │   └── approve/route.ts
│   │       └── context/
│   │           ├── route.ts
│   │           ├── facts/route.ts
│   │           ├── conflicts/route.ts
│   │           ├── conflicts/[conflictId]/resolve/route.ts
│   │           ├── draft/route.ts
│   │           ├── diff/route.ts
│   │           ├── approve/route.ts
│   │           ├── versions/route.ts
│   │           ├── versions/[versionId]/restore/route.ts
│   │           ├── compile/route.ts
│   │           ├── sources/route.ts
│   │           ├── sources/[sourceId]/route.ts
│   │           ├── sources/[sourceId]/process/route.ts
│   │           ├── sources/[sourceId]/archive/route.ts
│   │           ├── processing-runs/route.ts
│   │           ├── processing-runs/[runId]/route.ts
│   │           └── reconcile/route.ts
│   └── context-jobs/
│       └── [id]/
│           ├── route.ts
│           └── retry/route.ts
├── core/business-context/
│   ├── types.ts
│   ├── schemas.ts
│   ├── repository.port.ts
│   ├── source-adapter.port.ts
│   ├── document-parser.port.ts
│   ├── extraction.port.ts
│   ├── job-policy.ts
│   ├── quality-gates.ts
│   ├── service.ts
│   ├── resolver.ts
│   ├── compiler.ts
│   └── versioning.ts
├── infrastructure/business-context/
│   ├── supabase.repository.ts
│   ├── supabase-client.ts
│   ├── authz.ts
│   ├── firecrawl-website.adapter.ts
│   ├── native-document-parser.adapter.ts
│   ├── paddleocr-document-parser.adapter.ts
│   ├── document-parser-router.ts
│   ├── meta-source.adapter.ts
│   ├── manual-source.adapter.ts
│   ├── llm-extraction.adapter.ts
│   ├── processing-visibility.ts
│   ├── circuit-breaker.ts
│   ├── source-sanitizer.ts
│   ├── ssrf-guard.ts
│   ├── upload-validator.ts
│   └── job-runner.ts
└── di/container.ts

supabase/
├── config.toml
├── migrations/
│   └── 202607140001_business_context.sql
├── seed.sql
└── .gitignore

tests/
├── unit/business-context/
├── integration/business-context/
├── contract/business-context/
└── rls/business-context/

workers/
└── paddleocr/
    ├── README.md
    ├── requirements.txt
    ├── worker.py
    └── tests/test_contract.py
```

**Structure Decision**: Use the PRD's ports-and-adapters structure directly. Business Context domain logic is isolated in `src/core/business-context`; all external systems and persistence live in `src/infrastructure/business-context`; Next route handlers are thin adapters that validate requests, authorize workspace access, call the core service through `Container`, and serialize responses.

## Supabase Readiness Gate

Business Context implementation cannot begin until local Supabase is ready. This gate exists because the feature depends on Postgres functions, RLS policies, Storage policies, service-role isolation, and migration behavior that SQLite cannot represent faithfully.

Required readiness outcomes:

- `supabase/config.toml`, `supabase/migrations/`, `supabase/seed.sql`, and `supabase/.gitignore` exist.
- `supabase start` runs locally through Docker and provides local URL, anon key, and service-role key.
- `supabase db reset` applies all migrations and seed data from a clean local database.
- Business Context tables, indexes, SQL functions, RLS policies, and private Storage buckets exist locally.
- RLS smoke tests prove same-workspace access works and cross-workspace access fails.
- The Next.js server can connect to local Supabase with anon/session and service-role clients separated.
- A dry-run cloud migration path is documented with `supabase login`, `supabase link`, `supabase db push --dry-run`, and `supabase db push`.

SQLite/libSQL boundary:

- Existing SQLite/libSQL campaign persistence remains untouched.
- Business Context route handlers never use SQLite/libSQL, Drizzle SQLite, in-memory repositories, or mock stores.
- Unit tests may use object fakes behind ports only when testing pure core behavior. API, repository, RLS, migration, and approval tests use local Supabase.

## Recommended Operational Boundary

The processing pipeline is a backend concern with a narrow visibility API. Route handlers may expose source/job/run status and persisted quality summaries to authorized workspace members, but only workers and server-side infrastructure adapters may mutate job locks, heartbeats, retry state, stage events, provider circuit breakers, or quality gate results. This keeps operational controls out of the browser while still giving onboarding and future Business Context screens enough progress detail to explain what happened.

Core boundary:

- `src/core/business-context/job-policy.ts` owns retry classification, exponential backoff schedule, terminal state rules, and stuck-job transition rules as pure functions.
- `src/core/business-context/quality-gates.ts` owns document and fact quality gate definitions, thresholds, and pass/warn/fail evaluation as pure functions.
- `src/core/business-context/service.ts` orchestrates source, onboarding, and profile workflows through ports; it does not own provider dispatch details.
- `src/infrastructure/business-context/job-runner.ts` owns worker leases, heartbeats, recovery sweeps, retry scheduling, and dead-letter transitions.
- `src/infrastructure/business-context/processing-visibility.ts` writes processing runs and stage events.
- `src/infrastructure/business-context/circuit-breaker.ts` reads/writes provider breaker state before dispatching provider calls.

Processing stages and terminal outcomes:

- Stage order: `registered -> queued -> acquiring -> stored -> parsing -> normalizing -> extracting -> reconciling -> quality_checking -> completed`.
- Terminal source outcomes: `processed`, `processed_with_warnings`, `blocked_needs_user_action`, `failed_permanent`, `archived`.
- Skipped stages must still emit a `skipped` event with a reason so progress timelines remain explainable.

Retry and recovery rules:

- Retryable classes: provider timeout, provider 5xx, transient network, rate limit, and worker out-of-memory.
- Permanent classes: validation, authorization, SSRF, malware, unsupported file, budget exceeded, schema contract failure, and quota exhaustion.
- Default backoff: 30 seconds, 2 minutes, 10 minutes, 30 minutes, +/- 20% jitter, maximum 4 attempts.
- Running workers heartbeat at least every 30 seconds. A recovery sweep marks jobs stale after 2 times their stage timeout, then either schedules a retry or dead-letters them.

Quality gates:

- Document quality gates run before extraction and evaluate MIME/extension, malware scan, checksum/hash, parser output, page or slide coverage, OCR confidence, truncation, parser warnings, and evidence locator availability.
- Fact quality gates run before profile compilation and evaluate schema validity, source link, source excerpt, evidence locator when available, confidence thresholds, source authority, recency/effective date, contradiction state, and user-verification requirement.
- Blocking quality failures prevent approval. Non-blocking quality warnings may publish only as `processed_with_warnings` and must remain visible.

Processing visibility:

- Every stage records start/end time, duration, attempt, worker ID, provider, provider request ID, pages/slides/bytes processed, documents created, facts extracted, warnings, credits or cost units, failure class, and sanitized errors.
- Source/job detail APIs return aggregate visibility: time per stage, attempts, final outcome, failure types, provider cost/credits, facts extracted, warnings, and quality gate results.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Separate Python PaddleOCR worker | OCR and document intelligence require Python packages, local temp files, and optional GPU runtimes outside the Next.js request process. | Running OCR inside API routes would violate the PRD deployment boundary, risk request timeouts, and make GPU/CPU worker sizing impossible. |
| Supabase RLS plus server-side authorization checks | Defense in depth is required for tenant isolation and role-based mutation controls. | API-only authorization would not protect direct Supabase access or future service entry points. |
| Transactional approval database function | Approval must validate, supersede, publish, and audit atomically. | Multiple application-level queries could leave two current versions or no current version after a mid-flight failure. |
| Persisted processing telemetry | Users and operators need to explain slow, failed, expensive, or low-quality processing runs. | Logs-only visibility would not support RLS-scoped UI inspection, retries, or audit-quality debugging. |
| Provider circuit breaker state | Firecrawl, Meta, LLM, native parsing, and PaddleOCR can fail or exhaust quota independently. | Blind retries would amplify outages, burn credits, and create noisy failures. |

## Phase 0: Research Output

Research decisions are captured in `research.md` and resolve the main implementation choices: Supabase-first persistence, no in-memory Business Context repository for endpoints, route-handler API contracts, database-backed async jobs for V1, Firecrawl as website acquisition, native parser first with PaddleOCR fallback, and a feature-flagged PaddleOCR-VL evaluation path.

## Phase 1: Design Output

Design artifacts are captured in:

- `data-model.md`: Supabase tables, enums, indexes, storage buckets, RLS policies, and domain relationships.
- `contracts/openapi.yaml`: Backend API contract for onboarding, context management, sources, and jobs.
- `quickstart.md`: Environment setup, migration, test, and manual verification workflow.

## Phase 2: Task Planning Output

Implementation tasks are captured in `tasks.md`. Tasks are grouped by independently testable user stories and include tests before implementation where behavior is observable.

## Implementation Notes

- Add Supabase dependencies and test tooling before feature code.
- Complete the Supabase Readiness Gate before creating Business Context endpoints or repository code.
- Keep Zod schemas close to domain types in `src/core/business-context/schemas.ts`; API route schemas may import these and compose request envelopes.
- Do not expose the Supabase service-role key through any `NEXT_PUBLIC_*` variable.
- Prefer database functions for approval and restore transitions that must be atomic.
- Store raw provider payloads and originals only when retention is required; store structured metadata and checksums in Postgres either way.
- Treat generated Markdown as a projection of `business_profile_versions.profile`, never as source of truth.
- Persist operational visibility in Postgres tables instead of relying on process logs; logs may mirror event IDs but must not contain source-document text or secrets.
- Keep circuit breaker mutation server-side. Browser/API consumers may read summarized processing state but cannot force provider half-open probes.
