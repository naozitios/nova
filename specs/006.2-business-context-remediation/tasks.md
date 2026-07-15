# Tasks: Business Context Pipeline Remediation

**Method**: Hybrid spec-driven delivery by bounded dependency wave.
**Rules**:
1. During wave: implementation plus focused typecheck/unit checks; tests may be before or alongside implementation.
2. Subsystem integration/contract/RLS gate after related slices assemble.
3. E2E once per completed user story.
4. Full suite only at release gate.
5. `[x]` means implementation exists AND focused verification passes.
6. 1–3 production/test files per slice, every file ≤300 lines.
7. `[P]` = parallel-safe: disjoint files only. DB migrations/resets/RLS writes serialize — never parallel with other schema writes.
8. Hot files serialize: DI/container, shared route helpers, worker entrypoint, shared schemas/catalogs.
9. Max 2 concurrent small agents, disjoint files only.
10. Test design is execution-owned — no prescribed paths, file names, or test commands.
11. Real boundaries only. Fake only: external providers, LLM responses, clocks, IDs.
12. E2E harness owns app+worker lifecycle; never manual localhost or mutated lifecycle tables.

**Status Vocabulary**:
- `VERIFIED` — fresh passing gate evidence covers entire acceptance block.
- `IMPLEMENTED_UNVERIFIED` — implementation exists; no fresh passing gate evidence.
- `PARTIAL` — some acceptance criteria met or evidence incomplete.
- `NOT_IMPLEMENTED` — no implementation or tests for this block.
- `BLOCKED` — depends on unresolved prerequisite.

Statuses describe current worktree state and must be refreshed after each gate.

---

## Wave 0 — Governance

- [x] T000 | B01 | Constitution amendment: 202/OAuth 303/403/409 responses, stable error codes, ClamAV digest pin, real-boundary suites. Retain NextAuth identity, role enforcement, JSON envelopes, JSDoc, Container rules.
  <!-- STATUS: VERIFIED — constitution file exists, error codes defined, ClamAV digest pinned, real-boundary suite structure present -->

## Wave 1 — DB Migration (serial)

- [ ] T001–T002 | B02 | Clean-reset migration: upload intents, idempotency records, Meta connections, one-time OAuth states, provider-code hashes, session/draft fields, active-session/conflict/question uniqueness, worker indexes. Safe backfill.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — migration file exists; no fresh gate evidence -->

## Wave 2 — Core Entities + Repos

- [ ] T004–T005 | B03 | Entities, unions, Zod schemas, repository ports, mappers for all remediation tables.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — entity/port files exist; no fresh typecheck/test gate evidence -->
- [ ] T006 | B04 | Upload, idempotency, meta-connection repositories. Encrypt Meta tokens with Node crypto + server-only key.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — repository files exist; no fresh typecheck/test gate evidence -->
- [P] T003 | B05 | Real-user-JWT RLS matrix for all Business Context tables and Storage paths. Service role seeds/inspects only.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — RLS test files exist; no fresh passing gate evidence -->

## Wave 3 — Idempotency + DI

- [ ] T007–T008 | B06 | Durable idempotency: workspace/operation/fingerprint across all mutating routes. Return `IDEMPOTENCY_KEY_REUSED` on key/payload mismatch.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — idempotency port/repo exist; no fresh gate evidence -->
- [ ] T009–T010 | B07 | Composition root: register repositories, upload storage, malware scanner, idempotency, Meta resolver, source registry, parser, extraction, orchestration, worker in Container.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — container.ts exists; no fresh typecheck/test gate evidence -->

## Wave 4 — E2E Harness

- [ ] T011–T012 | B08 | E2E utilities: Supabase reset, real NextAuth sessions, separate Auth users/JWTs/memberships, isolated ports, process control, authenticated fetch, deadline polling, cleanup. Scripts: worker, scanner, E2E, providers. ClamAV digest pin + health-checked lifecycle. Strict runtime config. Harness owns scanner start/wait/cleanup.
  <!-- STATUS: PARTIAL — harness scaffolding exists; full lifecycle including ClamAV health-check and scanner ownership not verified -->

## Wave 5 — US1: Background Source Processing (P1)

**Independent**: Authenticated source request claimed by separate worker reaches persisted terminal state without direct test updates.

- [ ] T013 | B09 | Orchestration unit tests + website adapter security: adapter selection, ordered/skipped stages, idempotent persistence, pre/post-redirect private-network rejection, domain confinement, robots/budgets, dedupe, injection isolation.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — substantial implementation and tests exist; no fresh whole-block gate -->
- [ ] T014 | B10 | Handler registration: prove real `source_processing` registration with real JobRunner.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — substantial implementation and tests exist; no fresh whole-block gate -->
- [ ] T015 | B11 | Worker real-Supabase: claim race, lease, heartbeat, retry wait, shutdown, stale recovery, duplicate prevention.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — substantial implementation and tests exist; no fresh whole-block gate -->
- [ ] T016–T017 | B12 | Source processing service + adapter registry: orchestrate source/run/collection/parse/documents/extraction/reconciliation/quality/events/terminal state. Website, stored document, Meta, manual, inference adapters with hardening.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — substantial implementation and tests exist; no fresh whole-block gate -->
- [ ] T018–T019 | B13 | Job handler + worker: centralized register-handlers, entrypoint, signals, unique identity. Lease-loss, graceful stop, heartbeat, retry, dead-letter, stage visibility. Deterministic caller keys.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — substantial implementation and tests exist; no fresh whole-block gate -->
- [ ] T020 | B14 | E2E: queue <2s, claim <10s, ordered stages, 100 same-key → 1 execution, fingerprint 409, two-worker 100-race, retryable failure, kill/restart, OCR block, website budgets.
  <!-- STATUS: PARTIAL — E2E test file exists; current E2E remains RED/incomplete -->

## Wave 6 — US2 + US3 (max 2 concurrent agents)

### US2: Upload and Source Management (P1)

**Independent**: Signed private upload through HTTP finalizes, processes, inspects, retries, archives with retained evidence.

- [P] T021 | B15 | Upload service unit: classification, signed proposal create/accept, forged/expired/cross-workspace rejection, server provenance, path/expiry/ownership, completion replay, conflicts.
  <!-- STATUS: PARTIAL — upload service exists; full unit test coverage not verified -->
- [P] T022 | B16 | Storage + scanner integration: signed upload, direct-finalization denial, verification, magic/container detection, clean/infected/suspicious/unavailable/timeout, zero-facts-before-clean, checksum dedupe, retention.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — storage/scanner exists; integration gate unrun -->
- [P] T023 | B17 | HTTP contracts: classification proposal, upload creation, lifecycle, typed metadata, source detail, retry, archive.
  <!-- STATUS: PARTIAL — route files exist; full contract test coverage not verified -->
- [ ] T024 | B18 | `UploadStoragePort` + `MalwareScannerPort`. Signed private upload/object verification. Streaming ClamAV scan.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — port files exist; no fresh gate evidence -->
- [ ] T025 | B19 | Signed stateless classification proposals + intent finalization. Signature/binding/expiry validation, provenance derivation, stable errors, idempotent source/job.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — classification/intent logic exists; no fresh gate evidence -->
- [ ] T026 | B20 | Authenticated upload routes: editor role, Zod, durable idempotency, Container.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — upload routes exist; no fresh gate evidence -->
- [ ] T027–T028 | B21 | Discriminated metadata schemas (website/upload/Meta/manual) + content signature detection. Modern parser routing, `OCR_REQUIRED`, manual-text recovery, `LEGACY_FORMAT_UNSUPPORTED`.
  <!-- STATUS: PARTIAL — schema/parser files exist; full content signature detection not verified -->
- [ ] T029 | B22 | Source detail/process/retry/archive routes: evidence, stages, timing, quality, failure, action, retryability, archival.
  <!-- STATUS: PARTIAL — route files exist; full DTO/evidence coverage not verified -->
- [ ] T030 | B23 | E2E: PDF/DOCX/PPTX/XLSX/HTML/text success; DOC/PPT/XLS retention/blocking; class persistence; false MIME; malformed/encrypted/executable; EICAR infected; scanner unavailable; duplicate; oversize/expired/foreign; direct mutation denial; scanned recovery; retry; archive race; history.
  <!-- STATUS: PARTIAL — upload validation/scanner test fragments exist; required upload E2E matrix is missing -->

### US3: Extraction, Reconciliation, Questions (P1)

**Independent**: Versioned corpus meets recall/evidence/filter thresholds; conflicting source creates one conflict/question.

- [P] T031–T032 | B24 | Extraction fixtures (marketing, business-plan, financial) + prompt/taxonomy/output tests + output validator tests.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — fixture/test files exist; no fresh gate evidence -->
- [P] T033 | B25 | Corpus integration: recall/evidence/filter thresholds, only LLM response fixture-backed.
  <!-- STATUS: PARTIAL — corpus logic exists; full threshold verification not confirmed -->
- [P] T034 | B26 | Real-Supabase fact/conflict/question/rollback tests.
  <!-- STATUS: PARTIAL — test files exist; full real-Supabase coverage not verified -->
- [ ] T035 | B27 | Extraction prompt catalog with versioned class taxonomies.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — prompt-catalog.ts exists; no fresh gate evidence -->
- [ ] T036 | B28 | Strict schema/key/value/confidence/evidence validation + one repair in output validator.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — output-validator.ts exists; no fresh gate evidence -->
- [ ] T037 | B29 | Reconciliation: normalized supersession, one open conflict, atomic no-partial through extraction service/resolver/repositories.
  <!-- STATUS: PARTIAL — reconciliation logic exists; full atomicity not verified -->
- [ ] T038 | B30 | Deterministic question lifecycle: generated prompts, answered history, obsolete dismissal.
  <!-- STATUS: PARTIAL — question service exists; full lifecycle not verified -->
- [ ] T039 | B31 | Wire extraction + fact quality + reconciliation + questions + counters + warnings into source orchestrator.
  <!-- STATUS: PARTIAL — components exist separately; unified orchestrator wiring and integration proof are missing -->
- [ ] T040 | B32 | Credential-gated Groq benchmark with explicit executed/skipped report.
  <!-- STATUS: NOT_IMPLEMENTED — no benchmark script or CI workflow found -->
- [ ] T041 | B33 | E2E: corpus threshold, excerpts/locators, null rejection, conflicting source, exactly one open conflict/question, obsolete dismissal, approval blocker through HTTP.
  <!-- STATUS: PARTIAL — corpus and conflict test fragments exist; required HTTP E2E scenario is missing -->

## Wave 7 — US4: Initial Onboarding (P1, needs US1 + US3)

**Independent**: NextAuth-session create-to-v1 flow uses real worker/Supabase, one current version.

- [P] T042 | B34 | Onboarding readiness + draft unit: required-key, explicit-unknown, qualifying evidence, manual-only rejection, section-readiness, route-stage, blockers, partial-source, required-processing, nested-draft.
  <!-- STATUS: PARTIAL — draft fragments exist; readiness derivation and full unit coverage are missing -->
- [P] T043 | B35 | Real-NextAuth contracts: PRD 007 creation, optional website, start/resume, typed question prompts/controls/explicit unknown answers, compile, blockers.
  <!-- STATUS: PARTIAL — onboarding contract files exist; no fresh gate evidence -->
- [P] T044 | B36 | Real-Supabase answer provenance + v1 approval/session transaction.
  <!-- STATUS: PARTIAL — approval fragments exist; answer provenance and session-level transaction are missing -->
- [ ] T045 | B37 | Pure readiness derivation: lifecycle, blockers, readiness, route stage from persisted state.
  <!-- STATUS: NOT_IMPLEMENTED — no pure readiness derivation module found -->
- [ ] T046 | B38 | Business creation: PRD 007 fields as facts, optional website queue, remove source-array/budget mismatch.
  <!-- STATUS: PARTIAL — creation logic exists; full PRD 007 field mapping not verified -->
- [ ] T047 | B39 | Session start/resume: initial session, status/step refresh after pipeline/answers, readiness return.
  <!-- STATUS: PARTIAL — session logic exists; full refresh cycle not verified -->
- [ ] T048 | B40 | Answer validation + fact link: stable question validation, session user-answer source, verified fact/result link, audit, readiness refresh.
  <!-- STATUS: PARTIAL — answer/fact logic exists; full validation chain not verified -->
- [ ] T049 | B41 | Nested draft compilation: active-fact nested through shared precedence.
  <!-- STATUS: PARTIAL — draft compilation exists; full nested precedence not verified -->
- [ ] T050 | B42 | Onboarding routes: DTOs, durable idempotency, roles, canonical 409 blockers, Container.
  <!-- STATUS: PARTIAL — route files exist; full DTO/idempotency coverage not verified -->
- [ ] T051 | B43 | Approval SQL: validate readiness, publish sole current v1, audit, approve session atomically.
  <!-- STATUS: PARTIAL — approval SQL exists; sequential app-level approval is not atomic SQL -->
- [ ] T052 | B44 | E2E: creation fields/facts, optional website, no source-array, route-stage polling, typed questions, explicit unknown, manual-only rejection, qualifying approval, one provenance, nested draft, viewer denial, blocker rejection, idempotent approval, sole v1.
  <!-- STATUS: NOT_IMPLEMENTED — no E2E test file found for onboarding -->

## Wave 8 — US5: Repeat Setup + Corrections (P2, needs US4)

**Independent**: v1 active during update; correction/diff works; stale approval preserves draft; refreshed approval publishes v2.

- [P] T053 | B45 | Update service unit: resume, base capture, current availability, correction provenance, diff attribution, stale decision.
  <!-- STATUS: PARTIAL — update service exists; no fresh gate evidence -->
- [P] T054 | B46 | Real-Supabase concurrent start/approval, stale rejection, draft preservation, sole-current.
  <!-- STATUS: PARTIAL — concurrency logic exists; no fresh gate evidence -->
- [P] T055 | B47 | Route contracts: update mode, correction PATCH, base/draft IDs, attributed diff, version list/detail/compare, expected-current restore, authorization, stale 409.
  <!-- STATUS: PARTIAL — route files exist; no fresh gate evidence -->
- [ ] T056 | B48 | Update start/resume + base capture + unique active-session replay + current preservation.
  <!-- STATUS: NOT_IMPLEMENTED — no update start/resume module found -->
- [ ] T057 | B49 | Fact PATCH → superseding verified correction through session/manual provenance. Base-linked draft, source/reason-attributed diff.
  <!-- STATUS: PARTIAL — correction logic exists; full attribution chain not verified -->
- [ ] T058–T059 | B50 | Expected-base check on approval; stale → `STALE_PROFILE_VERSION`. Typed version list/detail/compare + expected-current restore, immutable history, role checks.
  <!-- STATUS: PARTIAL — version/approval logic exists; full stale/restore flow not verified -->
- [ ] T060 | B51 | E2E: resume replay, current availability, correction evidence, source processing, attributed diff, stale 409/intact draft, refreshed v2, immutable v1, sole v2, version compare, unauthorized/stale restore denial, successful restore-as-new-version.
  <!-- STATUS: NOT_IMPLEMENTED — no E2E test file found for repeat setup -->

## Wave 9 — US6: Security + Operations (starts after US1, closes after all)

**Independent**: Real HTTP/RLS roles + worker failure/circuit/redaction pass without fake lifecycle updates.

- [P] T061 | B52 | Real-NextAuth HTTP role/guessed-ID matrix. Reject bearer spoofing, `AuthContext` payloads, `X-User-Id` in production/E2E.
  <!-- STATUS: PARTIAL — role matrix logic exists; full spoofing rejection not verified -->
- [P] T062 | B53 | Full-table/Storage real-JWT RLS: same-workspace roles, cross-workspace writes (extends B05).
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — RLS tests exist; no fresh gate evidence -->
- [P] T063 | B54 | Pipeline operations: circuit, retry eligibility, OCR/legacy non-retry, archive race, heartbeat, dead letter, skipped events, aggregates.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — pipeline ops logic exists; no fresh gate evidence -->
- [P] T064 | B55 | Redaction: persisted-error/log with fixture secrets/body/personal markers.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — redaction logic exists; no fresh gate evidence -->
- [P] T065 | B56 | Meta OAuth/credential: start response, signed state, atomic state consumption, provider-code hash replay rejection, callback redirect/errors, encrypted persistence, refresh, account selection/ownership, sanitized status, worker resolution.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — Meta OAuth logic exists; no fresh gate evidence -->
- [ ] T066 | B57 | Verified NextAuth server session + workspace-member mapping. `X-User-Id` restricted to local-test flag. Bearer spoofing rejected. Role preservation.
  <!-- STATUS: PARTIAL — session mapping exists; full spoofing rejection not verified -->
- [ ] T067 | B58 | Meta connection/OAuth-state ports, adapters, repos, typed start/callback/status/select-account routes. Atomic state + provider-code hash. Encrypted workspace persistence.
  <!-- STATUS: PARTIAL — Meta connection ports/repos exist; full route coverage not verified -->
- [ ] T068 | B59 | Retry/circuit/archive/recovery + persisted explanatory events across job-runner/circuit/source.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — retry/circuit logic exists; no fresh gate evidence -->
- [ ] T069 | B60 | Stable safe errors/redaction in job errors, source sanitizer, API helpers. Retain actionable codes.
  <!-- STATUS: PARTIAL — error/redaction logic exists; full stable error surface not verified -->
- [ ] T070 | B61 | Source/job/run DTOs: stages, timings, attempts, counts, evidence, quality, warning, provider request/cost, failure, action, retryability, outcome.
  <!-- STATUS: PARTIAL — DTO types exist; full field coverage not verified -->
- [ ] T071 | B62 | E2E: NextAuth denial, JWT RLS denial, viewer read-only, Meta worker, ClamAV unavailable/infected fail-closed, two-worker safety, kill/restart, retry/dead-letter, circuit probe, archive race, full visibility, zero sensitive markers.
  <!-- STATUS: PARTIAL — only B14 happy-path E2E exists; no dedicated security E2E -->

## Wave 10 — Release Gate

- [ ] T072–T073 | B63 | PRD 007 contract-completeness: typed request/success/error for every operation, closed `ErrorCode` registry. CI provider-verification workflow with benchmark report.
  <!-- STATUS: PARTIAL — error code registry exists; full contract completeness and CI workflow not verified -->
- [ ] T074–T075 | B64 | Unit suites + Supabase reset + integration/RLS/contract suites.
  <!-- STATUS: IMPLEMENTED_UNVERIFIED — test suites exist; no fresh full-run gate evidence -->
- [ ] T076–T077 | B65 | All six E2E suites. Credentialed provider benchmark.
  <!-- STATUS: PARTIAL — E2E test files exist; full suite pass + benchmark not verified -->
- [ ] T078–T079 | B66 | Lint + build (fix introduced only). Validate `quickstart.md` from clean reset, audit PRD 007 compatibility.
  <!-- STATUS: PARTIAL — lint/build scripts exist; full clean-reset validation not verified -->

---

## Dependency Waves

| Wave | Slices | Parallel | Blocks |
|------|--------|----------|--------|
| 0 | B01 | — | 1 |
| 1 | B02 | — | 2 |
| 2 | B03, B04, B05 | B05 ‖ B03/B04 | 3 |
| 3 | B06, B07 | — | 4 |
| 4 | B08 | — | 5, 6 |
| 5 | B09–B14 | max 2 | 6, 7 |
| 6 | B15–B33 | max 2 (US2 + US3 interleaved) | 7, 8, 9 |
| 7 | B34–B44 | max 2 | 8, 9 |
| 8 | B45–B51 | max 2 | 9 |
| 9 | B52–B62 | max 2 (B52–B56 + B57–B62 interleaved) | 10 |
| 10 | B63–B66 | max 2 | — |

**66 slices · 11 waves · max intra-wave parallelism: 2 concurrent agents (disjoint files only)**

---

## Reconciliation

**Date**: 2026-07-15
**Worktree**: current as of session start.

| Status | Count |
|--------|-------|
| VERIFIED | 1 (B01) |
| IMPLEMENTED_UNVERIFIED | 24 (B02–B07, B09–B13, B16, B18–B20, B24, B27–B28, B53–B56, B59, B64) |
| PARTIAL | 36 (B08, B14–B15, B17, B21–B23, B25–B26, B29–B31, B33–B36, B38–B43, B45–B47, B49–B50, B52, B57–B58, B60–B63, B65–B66) |
| NOT_IMPLEMENTED | 5 (B32, B37, B44, B48, B51) |
| BLOCKED | 0 |

**Total: 66 B-blocks** (1 + 24 + 36 + 5 = 66). Each B01–B66 appears exactly once.

Statuses must be refreshed after each wave gate passes. Do not carry stale statuses forward.

---

No browser tasks: backend-only. PRD 007 frontend tasks use `agent-browser`.
