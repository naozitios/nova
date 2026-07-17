# Implementation Plan: Business Context Pipeline Remediation

**Feature**: `006.2-business-context-remediation` | **Date**: 2026-07-15 | **Spec**: `specs/006.2-business-context-remediation/spec.md`

## Summary

Repair PRD 006 as one executable backend vertical slice before PRD 007. Add durable upload/idempotency/Meta connection and OAuth replay boundaries, one source orchestrator, separate Node worker, class-specific extraction, persisted reconciliation/questions, derived onboarding readiness, provenance-preserving edits, repeat setup concurrency protection, and self-starting real-boundary E2E.

## Technical Context

**Language**: TypeScript 5 strict; SQL migrations
**Dependencies**: Next.js 16.1.1, NextAuth, Zod 4.3.5, Supabase JS 2.110.4, existing Groq/Firecrawl/Meta/parser stack, constitution-pinned `clamav/clamav:1.4.3` runtime reached through a core port
**Storage**: Local/hosted Supabase Postgres and private Storage
**Testing**: Vitest, local Supabase CLI, spawned Next.js/worker, real Auth JWT/RLS; credentialed provider verification
**Platform**: Linux Node.js web and independently scalable worker processes
**Goals**: API queue response under 2s; local worker claim under 10s; 50 MB file limit; existing website budgets
**Constraints**: no Business Context SQLite/mock/in-memory endpoints; no browser credentials; upload scanning fails closed; OCR and legacy conversion deferred truthfully; current profile remains active during update; real HTTP/NextAuth/Supabase/worker E2E required for 006.2; browser/frontend onboarding and context-editor E2E deferred to PRD 007

## Constitution Check

- Hexagonal architecture: PASS. Core policy uses ports; infrastructure owns providers/Supabase/process.
- Immutable source of truth: PASS. Approved profile version remains canonical.
- Ports/adapters and `Container`: PASS. Routes do not construct adapters.
- Strict TypeScript/no `any`: PASS.
- API conventions/auth/idempotency/errors/JSDoc: PASS under constitution v1.3.0. Required `202`, validated OAuth `303`, `403`, and `409`, stable typed domain error extensions, co-located unit tests, centralized real-boundary suites, and hybrid staged verification are explicitly governed.
- Authentication: PASS. HTTP uses NextAuth server sessions; Supabase Auth JWTs prove RLS separately.
- Frontend rules: PASS; no frontend in feature.
- Testing: PASS; real DB/Storage/Auth/RLS/HTTP/worker/transaction boundaries.
- Observability/redaction: PASS.
- Frozen application stack: PASS. Node crypto is standard library. ClamAV is a required security runtime from PRD 006, isolated behind `MalwareScannerPort`; no npm dependency enters core.

## Documentation

```text
specs/006.2-business-context-remediation/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/openapi.yaml
└── tasks.md
```

## Source Structure

```text
src/
├── app/api/businesses/route.ts
├── app/api/businesses/_shared.ts
├── app/api/businesses/[id]/onboarding/**
├── app/api/businesses/[id]/context/
│   ├── uploads/**
│   ├── sources/**
│   ├── facts/route.ts
│   ├── conflicts/**
│   ├── processing-runs/**
│   ├── draft/route.ts
│   ├── diff/route.ts
│   ├── approve/route.ts
│   └── versions/**
├── app/api/meta/connections/**
├── core/business-context/
│   ├── upload.port.ts
│   ├── malware-scanner.port.ts
│   ├── idempotency.port.ts
│   ├── meta-connection.port.ts
│   ├── extraction-catalog.ts
│   ├── onboarding-readiness.ts
│   └── service/{upload,source-processing,question,onboarding}.service.ts
├── infrastructure/business-context/
│   ├── storage-upload.adapter.ts
│   ├── clamav-malware-scanner.adapter.ts
│   ├── meta-connection.adapter.ts
│   ├── source-adapter-registry.ts
│   ├── extraction/{prompt-catalog,output-validator}.ts
│   ├── job-runner/handlers/source-processing.handler.ts
│   └── repository/{upload,idempotency,meta-connection}.repository.ts
├── workers/business-context.ts
└── di/container.ts

supabase/migrations/202607150001_business_context_remediation.sql
tests/{integration,contract,rls,e2e}/business-context/**
tests/fixtures/business-context/extraction/**
.github/workflows/business-context-provider-verification.yml
```

Pure unit tests are co-located beside modules under `src/core/business-context/`, `src/infrastructure/business-context/`, and `src/di/container.test.ts`.

## Architecture

1. Authenticated API validates role/input/idempotency and creates source/upload/job state.
2. Client uploads directly to signed private Storage target; server verifies completion and requires a clean malware scan before parsing or queueing extraction.
3. Separate worker claims jobs through persisted lease/heartbeat.
4. `SourceProcessingService` selects website, Meta, manual, or stored-document adapter.
5. Pipeline persists stages, normalized documents, extraction, facts, conflicts, questions, quality, and terminal state.
6. Readiness policy projects PRD 007 state and updates session lifecycle.
7. Initial/update approval uses transactional expected-base check and immutable versions.

## Implementation Sequence

1. Waves 0–4 — governance and foundation: migration, entities, repositories, RLS, durable idempotency, Meta credential store, DI providers, and E2E harness. Gate each assembled subsystem with focused unit/typecheck plus relevant migration, integration, contract, and RLS checks.
2. Wave 5 — US1 background processing: source orchestrator, adapter registry, production handler, worker entrypoint, retry/recovery, and source-processing E2E. Run the US1 E2E gate after B09–B14 assemble.
3. Wave 6 — US2 upload/source management and US3 extraction/reconciliation: execute at most two disjoint slices concurrently. Run separate subsystem gates, then one E2E gate for each completed user story.
4. Wave 7 — US4 initial onboarding: readiness, fact-backed business creation, session lifecycle, answers, nested draft, atomic approval, and onboarding E2E.
5. Wave 8 — US5 repeat setup: update sessions, corrections, attributed diff, stale-version protection, restore, and repeat-setup E2E.
6. Wave 9 — US6 security and operations: role/RLS matrix, Meta OAuth, retry/circuit/recovery, redaction, visibility DTOs, and security/operations E2E.
7. Wave 10 — release gate: contract completeness, all subsystem suites, all six E2E suites, credentialed provider benchmark, lint, build, quickstart validation, and PRD 007 compatibility audit. All required gates must pass before merge.
8. Wave 11 — deferred Wave 5 resilience completion: extend B14 worker E2E coverage for concurrent workers, retry/restart recovery, OCR blocking, and website budget enforcement. This runs only after Wave 10 identifies no release-blocking regression. B14 suite now verified: covers happy path, race, retry, restart, OCR block, and budget exhaustion through real app, worker, Supabase, and persisted lifecycle state.

## Verification Strategy

Tests run before or alongside code in each bounded wave; subsystem gate follows immediately after the related slices assemble.

- **Focused During-Wave**: unit tests co-located beside core/infrastructure modules run after each slice within the wave. Repository/migration/Storage tests use local Supabase.
- **Subsystem Gate**: integration and contract tests run against local Supabase after all slices in a wave are complete. HTTP tests own route harness or server process and authenticate through real NextAuth server sessions. Worker tests start real `JobRunner` and production registration.
- **User-Story E2E Gate**: one E2E pass per completed user story (US1–US6) after the relevant subsystems assemble. E2E harness owns Supabase reset, users/JWTs, app lifecycle, worker lifecycle, polling, logs, cleanup. User-JWT anon clients prove RLS; service role seeds/inspects only.
- **Release Gate**: full suite, lint, build, quickstart, and PRD 007 readiness audit run once after all waves are complete.
- **Credentialed provider checks**: external provider/LLM responses may be port-faked for deterministic suites. Credentialed CI runs the real benchmark (`BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1 npm run test:business-context:providers`). Until release credentials exist, these tests report an explicit `skipped` state rather than failing, so CI remains green while signaling that real-provider coverage is not yet active.
- No agent-browser tasks because feature has no frontend; PRD 007 must add them. Browser/frontend onboarding and context-editor E2E deferred to PRD 007.
- Failed gate reopens affected blocks only.

## Deployment

Next.js handles commands/read models. `src/workers/business-context.ts` runs separately from same build, has unique worker ID, handles signals, and leaves expired leases recoverable. Horizontal safety relies on Postgres claim/idempotency semantics. ClamAV 1.4.3 runs as a private health-checked service pinned by immutable image digest in local and CI Compose; configuration verification rejects tag-only or changed digest references, and upload finalization fails closed when unavailable. No OCR or legacy converter deploys.

## Complexity

Separate worker, ClamAV runtime, and four durable support tables are required to make already-designed behavior reachable and tenant-safe. Constitution v1.3.0 governs required API statuses/domain codes, OAuth redirect exception, pinned scanner runtime, test layout, and hybrid staged verification; no exception remains.
