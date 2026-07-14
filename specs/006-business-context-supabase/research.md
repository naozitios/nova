# Research: Business Context Supabase Backend

## Decision: Supabase is the Business Context system of record

**Decision**: Add Supabase Postgres migrations, RLS policies, private Storage buckets, and a Supabase-backed Business Context repository. MVP development uses the local Supabase CLI stack first. Do not use existing SQLite/Drizzle/libSQL or in-memory repositories for Business Context endpoints.

**Rationale**: PRD 006 explicitly requires Supabase as V1 source of truth and requires RLS, Storage policies, and service-role boundaries. Existing campaign persistence is SQLite-oriented and includes an in-memory default in `Container`, which violates the Business Context acceptance criterion that no endpoint uses mock or in-memory persistence. Local Supabase CLI gives the team real Postgres/RLS/Storage behavior without hosted Supabase costs during MVP development.

**Alternatives considered**:

- Extend Drizzle SQLite persistence: rejected because it cannot satisfy Supabase RLS/storage requirements.
- Start with in-memory domain tests only: rejected for endpoints; allowed only as local test doubles inside unit tests.
- Build MVP on SQLite and migrate later: rejected because approval functions, RLS, Storage policies, JSON/array behavior, service-role separation, and migration semantics would be reimplemented later and tests would provide false confidence.

## Decision: Add a blocking local Supabase readiness gate

**Decision**: Before implementing Business Context endpoints, initialize local Supabase CLI artifacts, prove `supabase start` and `supabase db reset`, apply migrations and seeds, verify RLS, and document the later hosted-project migration path.

**Rationale**: The repository currently has no Supabase directory, dependency, env config, migrations, or Storage buckets. Making readiness a gate prevents implementation from quietly falling back to SQLite or mocks.

**Alternatives considered**:

- Start coding domain endpoints first and wire Supabase later: rejected because route contracts and repository methods would be shaped around unverified persistence assumptions.
- Link to hosted Supabase immediately: rejected for MVP because local development can validate migrations/RLS without cloud usage; hosted linking is needed later for deployment, not first implementation.

## Hosted Supabase migration path

When the local MVP schema is ready, cloud migration uses the same migration files:

```bash
npx supabase login
npx supabase link
npx supabase db push --dry-run
npx supabase db push
```

This handles schema migration. Auth users, production secrets, Storage files, and existing data need a separate production migration runbook before launch.

## Decision: Keep core domain pure and infrastructure-specific logic outside `src/core`

**Decision**: Implement `src/core/business-context` ports, schemas, resolver, compiler, versioning, and service without importing Supabase, Next.js, Firecrawl, PaddleOCR, Meta SDKs, or model SDKs.

**Rationale**: Existing repo patterns already use ports such as `CampaignRepositoryPort` and `LlmClientPort`. The PRD requires the same boundary so extraction, resolution, and versioning remain testable without provider dependencies.

**Alternatives considered**:

- Put Supabase queries directly in route handlers: rejected because it duplicates business rules and makes approval/reconciliation hard to test.
- Put provider SDK calls in the service: rejected because future adapters must plug in without changing the domain model.

## Decision: Use database-backed `context_jobs` for V1 async orchestration

**Decision**: Represent crawl, parse, extraction, reconciliation, compilation, and retry work in `context_jobs` with idempotency keys, attempt counts, structured input/output/error fields, and a server-side job runner.

**Rationale**: The PRD requires retryable asynchronous jobs but does not require a queue provider. A database-backed queue is sufficient for V1, keeps observability in Supabase, and can later be replaced by a managed queue behind the same job runner contract.

**Alternatives considered**:

- Run long work inside API route requests: rejected due to timeout and retry behavior.
- Add Redis/BullMQ now: rejected as extra infrastructure not required by the PRD.

## Decision: Persist processing runs, stage events, quality gates, and circuit breakers

**Decision**: Add first-class Postgres records for processing runs, stage events, quality gate results, and provider circuit breakers instead of relying on process logs or opaque job JSON.

**Rationale**: PRD 006 needs users to inspect sources, processing state, confidence, warnings, and evidence. Operators also need to recover stuck jobs, explain retries, measure provider cost, and stop dispatch during provider incidents. Persisted RLS-scoped records support both user-facing progress and backend operations without exposing service-role controls to the browser.

**Alternatives considered**:

- Store everything in `context_jobs.output`: rejected because it makes querying stage timelines, quality gates, stuck recovery, and UI summaries brittle.
- Use application logs only: rejected because logs are not tenant-scoped, are not suitable for future UI inspection, and must not contain source-document text.
- Add an external observability stack in V1: rejected because Supabase tables are sufficient for product visibility and retry control; external telemetry can mirror event IDs later.

## Decision: Define retry/backoff and circuit breaker policies in domain-pure modules

**Decision**: Put retry classification, exponential backoff, stale heartbeat detection, terminal job transitions, and quality gate thresholds in pure core modules. Infrastructure workers execute those decisions and persist state.

**Rationale**: Retry and quality behavior is product logic, not provider-specific plumbing. Keeping these rules pure makes them testable and prevents each adapter from inventing different terminal states or quality thresholds.

**Alternatives considered**:

- Implement retry rules inside each adapter: rejected because behavior would diverge and be hard to analyze.
- Use provider SDK defaults: rejected because provider retries do not know NOVA's idempotency keys, evidence history, cost ceilings, or approval blockers.

## Decision: Firecrawl adapter only acquires and cleans website content

**Decision**: Use Firecrawl `/crawl` for bounded website scans and `/scrape` for specific public pages/documents. Store Firecrawl provider metadata and clean Markdown, then run NOVA's own extraction layer.

**Rationale**: PRD 006 states Firecrawl is acquisition/cleaning only. Centralizing extraction preserves one schema and one resolution process across websites, documents, Meta, and manual answers.

**Alternatives considered**:

- Use provider-generated extraction output: rejected because it creates parallel truth and weakens evidence provenance.

## Decision: Native document parsing first, PaddleOCR fallback for image/layout-heavy content

**Decision**: Route text-based PDF, DOCX, XLSX, PPTX, and HTML through native parsers first. Route scanned, image-only, malformed, layout-heavy pages, screenshots, and creative images through PaddleOCR. Merge results into one `ParsedDocument` without duplicating text.

**Rationale**: Native parsing is faster and preserves text, links, notes, and structure. OCR is necessary for scans/images and coordinate-level evidence. The PRD requires one `SourceDocument` regardless of parser path.

**Alternatives considered**:

- OCR every document: rejected due to cost, runtime, and loss of exact native text.
- Skip OCR in V1: rejected because scanned PDFs, image uploads, and creative screenshots are acceptance criteria.

## Decision: PaddleOCR runs as a separate worker boundary

**Decision**: Add a `workers/paddleocr` contract and minimal worker scaffold that consumes jobs, downloads private originals, writes parsed output, and deletes temp files. Production deployment can choose CPU or GPU workers.

**Rationale**: The PRD explicitly prohibits running PaddleOCR inside the Next.js request process and requires pinned versions plus benchmarked model upgrades.

**Alternatives considered**:

- Shell out from Next.js route handlers: rejected due to request lifecycle, local file handling, and scaling constraints.

## Decision: Approval and restore use Postgres transactions/functions

**Decision**: Implement approval and restore transitions with database transactions or SQL functions that validate required fields/conflicts, insert immutable versions, update current/superseded statuses, and write audit atomically.

**Rationale**: The system must never leave two current profile versions and must keep the current profile unchanged on failed compilation or approval.

**Alternatives considered**:

- Application-level multi-query sequence: rejected because mid-flight failures can violate invariants.

## Decision: Add Vitest and database/API contract tests

**Decision**: Add Vitest for TypeScript tests and include RLS/API contract tests in the implementation plan.

**Rationale**: The repo currently has lint/build scripts but no test framework. PRD acceptance criteria require behavior that cannot be safely delivered without automated tests for RLS, approval transactions, idempotent jobs, and endpoint contracts.

**Alternatives considered**:

- Rely on manual API testing: rejected because RLS and approval atomicity regressions are high risk.

## Decision: Defer frontend screens and DuckDB

**Decision**: Do not implement onboarding UI, Business Context tab UI, or DuckDB analytical jobs in this feature.

**Rationale**: PRD 006 explicitly defers UI and DuckDB. This plan exposes APIs and data needed by future screens.

**Alternatives considered**:

- Build minimal UI during backend work: rejected because it expands scope and blocks backend acceptance on design choices outside the PRD.
