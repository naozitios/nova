# Tasks: Business Context Pipeline Remediation

**Method**: Vertical TDD. Each slice = RED (failing tests) → GREEN (implementation passes) in one pass. No separate test-first phase.
**Rules**:
1. 1–3 production/test files per slice, every file ≤300 lines.
2. `[P]` = parallel-safe: disjoint files only. DB migrations/resets serialize — never parallel with other schema writes.
3. Test design is execution-owned — no prescribed paths, file names, or test commands.
4. Real boundaries only. Fake only: external providers, LLM responses, clocks, IDs.
5. E2E harness owns app+worker lifecycle; never manual localhost or mutated lifecycle tables.

---

## Wave 0 — Governance

- [x] T000 | B01 | Constitution amendment: 202/OAuth 303/403/409 responses, stable error codes, ClamAV digest pin, real-boundary suites. Retain NextAuth identity, role enforcement, JSON envelopes, JSDoc, Container rules.

## Wave 1 — DB Migration (serial)

- [ ] T001–T002 | B02 | Clean-reset migration: upload intents, idempotency records, Meta connections, one-time OAuth states, provider-code hashes, session/draft fields, active-session/conflict/question uniqueness, worker indexes. Safe backfill.

## Wave 2 — Core Entities + Repos

- [ ] T004–T005 | B03 | Entities, unions, Zod schemas, repository ports, mappers for all remediation tables.
- [ ] T006 | B04 | Upload, idempotency, meta-connection repositories. Encrypt Meta tokens with Node crypto + server-only key.
- [P] T003 | B05 | Real-user-JWT RLS matrix for all Business Context tables and Storage paths. Service role seeds/inspects only.

## Wave 3 — Idempotency + DI

- [ ] T007–T008 | B06 | Durable idempotency: workspace/operation/fingerprint across all mutating routes. Return `IDEMPOTENCY_KEY_REUSED` on key/payload mismatch.
- [ ] T009–T010 | B07 | Composition root: register repositories, upload storage, malware scanner, idempotency, Meta resolver, source registry, parser, extraction, orchestration, worker in Container.

## Wave 4 — E2E Harness

- [ ] T011–T012 | B08 | E2E utilities: Supabase reset, real NextAuth sessions, separate Auth users/JWTs/memberships, isolated ports, process control, authenticated fetch, deadline polling, cleanup. Scripts: worker, scanner, E2E, providers. ClamAV digest pin + health-checked lifecycle. Strict runtime config. Harness owns scanner start/wait/cleanup.

## Wave 5 — US1: Background Source Processing (P1)

**Independent**: Authenticated source request claimed by separate worker reaches persisted terminal state without direct test updates.

- [ ] T013 | B09 | Orchestration unit tests + website adapter security: adapter selection, ordered/skipped stages, idempotent persistence, pre/post-redirect private-network rejection, domain confinement, robots/budgets, dedupe, injection isolation.
- [ ] T014 | B10 | Handler registration: prove real `source_processing` registration with real JobRunner.
- [ ] T015 | B11 | Worker real-Supabase: claim race, lease, heartbeat, retry wait, shutdown, stale recovery, duplicate prevention.
- [ ] T016–T017 | B12 | Source processing service + adapter registry: orchestrate source/run/collection/parse/documents/extraction/reconciliation/quality/events/terminal state. Website, stored document, Meta, manual, inference adapters with hardening.
- [ ] T018–T019 | B13 | Job handler + worker: centralized register-handlers, entrypoint, signals, unique identity. Lease-loss, graceful stop, heartbeat, retry, dead-letter, stage visibility. Deterministic caller keys.
- [ ] T020 | B14 | E2E: queue <2s, claim <10s, ordered stages, 100 same-key → 1 execution, fingerprint 409, two-worker 100-race, retryable failure, kill/restart, OCR block, website budgets.

## Wave 6 — US2 + US3 (parallel)

### US2: Upload and Source Management (P1)

**Independent**: Signed private upload through HTTP finalizes, processes, inspects, retries, archives with retained evidence.

- [P] T021 | B15 | Upload service unit: classification, signed proposal create/accept, forged/expired/cross-workspace rejection, server provenance, path/expiry/ownership, completion replay, conflicts.
- [P] T022 | B16 | Storage + scanner integration: signed upload, direct-finalization denial, verification, magic/container detection, clean/infected/suspicious/unavailable/timeout, zero-facts-before-clean, checksum dedupe, retention.
- [P] T023 | B17 | HTTP contracts: classification proposal, upload creation, lifecycle, typed metadata, source detail, retry, archive.
- [ ] T024 | B18 | `UploadStoragePort` + `MalwareScannerPort`. Signed private upload/object verification. Streaming ClamAV scan.
- [ ] T025 | B19 | Signed stateless classification proposals + intent finalization. Signature/binding/expiry validation, provenance derivation, stable errors, idempotent source/job.
- [ ] T026 | B20 | Authenticated upload routes: editor role, Zod, durable idempotency, Container.
- [ ] T027–T028 | B21 | Discriminated metadata schemas (website/upload/Meta/manual) + content signature detection. Modern parser routing, `OCR_REQUIRED`, manual-text recovery, `LEGACY_FORMAT_UNSUPPORTED`.
- [ ] T029 | B22 | Source detail/process/retry/archive routes: evidence, stages, timing, quality, failure, action, retryability, archival.
- [ ] T030 | B23 | E2E: PDF/DOCX/PPTX/XLSX/HTML/text success; DOC/PPT/XLS retention/blocking; class persistence; false MIME; malformed/encrypted/executable; EICAR infected; scanner unavailable; duplicate; oversize/expired/foreign; direct mutation denial; scanned recovery; retry; archive race; history.

### US3: Extraction, Reconciliation, Questions (P1)

**Independent**: Versioned corpus meets recall/evidence/filter thresholds; conflicting source creates one conflict/question.

- [P] T031–T032 | B24 | Extraction fixtures (marketing, business-plan, financial) + prompt/taxonomy/output tests + output validator tests.
- [P] T033 | B25 | Corpus integration: recall/evidence/filter thresholds, only LLM response fixture-backed.
- [P] T034 | B26 | Real-Supabase fact/conflict/question/rollback tests.
- [ ] T035 | B27 | Extraction prompt catalog with versioned class taxonomies.
- [ ] T036 | B28 | Strict schema/key/value/confidence/evidence validation + one repair in output validator.
- [ ] T037 | B29 | Reconciliation: normalized supersession, one open conflict, atomic no-partial through extraction service/resolver/repositories.
- [ ] T038 | B30 | Deterministic question lifecycle: generated prompts, answered history, obsolete dismissal.
- [ ] T039 | B31 | Wire extraction + fact quality + reconciliation + questions + counters + warnings into source orchestrator.
- [ ] T040 | B32 | Credential-gated Groq benchmark with explicit executed/skipped report.
- [ ] T041 | B33 | E2E: corpus threshold, excerpts/locators, null rejection, conflicting source, exactly one open conflict/question, obsolete dismissal, approval blocker through HTTP.

## Wave 7 — US4: Initial Onboarding (P1, needs US1 + US3)

**Independent**: NextAuth-session create-to-v1 flow uses real worker/Supabase, one current version.

- [P] T042 | B34 | Onboarding readiness + draft unit: required-key, explicit-unknown, qualifying evidence, manual-only rejection, section-readiness, route-stage, blockers, partial-source, required-processing, nested-draft.
- [P] T043 | B35 | Real-NextAuth contracts: PRD 007 creation, optional website, start/resume, typed question prompts/controls/explicit unknown answers, compile, blockers.
- [P] T044 | B36 | Real-Supabase answer provenance + v1 approval/session transaction.
- [ ] T045 | B37 | Pure readiness derivation: lifecycle, blockers, readiness, route stage from persisted state.
- [ ] T046 | B38 | Business creation: PRD 007 fields as facts, optional website queue, remove source-array/budget mismatch.
- [ ] T047 | B39 | Session start/resume: initial session, status/step refresh after pipeline/answers, readiness return.
- [ ] T048 | B40 | Answer validation + fact link: stable question validation, session user-answer source, verified fact/result link, audit, readiness refresh.
- [ ] T049 | B41 | Nested draft compilation: active-fact nested through shared precedence.
- [ ] T050 | B42 | Onboarding routes: DTOs, durable idempotency, roles, canonical 409 blockers, Container.
- [ ] T051 | B43 | Approval SQL: validate readiness, publish sole current v1, audit, approve session atomically.
- [ ] T052 | B44 | E2E: creation fields/facts, optional website, no source-array, route-stage polling, typed questions, explicit unknown, manual-only rejection, qualifying approval, one provenance, nested draft, viewer denial, blocker rejection, idempotent approval, sole v1.

## Wave 8 — US5: Repeat Setup + Corrections (P2, needs US4)

**Independent**: v1 active during update; correction/diff works; stale approval preserves draft; refreshed approval publishes v2.

- [P] T053 | B45 | Update service unit: resume, base capture, current availability, correction provenance, diff attribution, stale decision.
- [P] T054 | B46 | Real-Supabase concurrent start/approval, stale rejection, draft preservation, sole-current.
- [P] T055 | B47 | Route contracts: update mode, correction PATCH, base/draft IDs, attributed diff, version list/detail/compare, expected-current restore, authorization, stale 409.
- [ ] T056 | B48 | Update start/resume + base capture + unique active-session replay + current preservation.
- [ ] T057 | B49 | Fact PATCH → superseding verified correction through session/manual provenance. Base-linked draft, source/reason-attributed diff.
- [ ] T058–T059 | B50 | Expected-base check on approval; stale → `STALE_PROFILE_VERSION`. Typed version list/detail/compare + expected-current restore, immutable history, role checks.
- [ ] T060 | B51 | E2E: resume replay, current availability, correction evidence, source processing, attributed diff, stale 409/intact draft, refreshed v2, immutable v1, sole v2, version compare, unauthorized/stale restore denial, successful restore-as-new-version.

## Wave 9 — US6: Security + Operations (starts after US1, closes after all)

**Independent**: Real HTTP/RLS roles + worker failure/circuit/redaction pass without fake lifecycle updates.

- [P] T061 | B52 | Real-NextAuth HTTP role/guessed-ID matrix. Reject bearer spoofing, `AuthContext` payloads, `X-User-Id` in production/E2E.
- [P] T062 | B53 | Full-table/Storage real-JWT RLS: same-workspace roles, cross-workspace writes (extends B05).
- [P] T063 | B54 | Pipeline operations: circuit, retry eligibility, OCR/legacy non-retry, archive race, heartbeat, dead letter, skipped events, aggregates.
- [P] T064 | B55 | Redaction: persisted-error/log with fixture secrets/body/personal markers.
- [P] T065 | B56 | Meta OAuth/credential: start response, signed state, atomic state consumption, provider-code hash replay rejection, callback redirect/errors, encrypted persistence, refresh, account selection/ownership, sanitized status, worker resolution.
- [ ] T066 | B57 | Verified NextAuth server session + workspace-member mapping. `X-User-Id` restricted to local-test flag. Bearer spoofing rejected. Role preservation.
- [ ] T067 | B58 | Meta connection/OAuth-state ports, adapters, repos, typed start/callback/status/select-account routes. Atomic state + provider-code hash. Encrypted workspace persistence.
- [ ] T068 | B59 | Retry/circuit/archive/recovery + persisted explanatory events across job-runner/circuit/source.
- [ ] T069 | B60 | Stable safe errors/redaction in job errors, source sanitizer, API helpers. Retain actionable codes.
- [ ] T070 | B61 | Source/job/run DTOs: stages, timings, attempts, counts, evidence, quality, warning, provider request/cost, failure, action, retryability, outcome.
- [ ] T071 | B62 | E2E: NextAuth denial, JWT RLS denial, viewer read-only, Meta worker, ClamAV unavailable/infected fail-closed, two-worker safety, kill/restart, retry/dead-letter, circuit probe, archive race, full visibility, zero sensitive markers.

## Wave 10 — Release Gate

- [ ] T072–T073 | B63 | PRD 007 contract-completeness: typed request/success/error for every operation, closed `ErrorCode` registry. CI provider-verification workflow with benchmark report.
- [ ] T074–T075 | B64 | Unit suites + Supabase reset + integration/RLS/contract suites.
- [ ] T076–T077 | B65 | All six E2E suites. Credentialed provider benchmark.
- [ ] T078–T079 | B66 | Lint + build (fix introduced only). Validate `quickstart.md` from clean reset, audit PRD 007 compatibility.

---

## Dependency Waves

| Wave | Slices | Parallel | Blocks |
|------|--------|----------|--------|
| 0 | B01 | — | 1 |
| 1 | B02 | — | 2 |
| 2 | B03, B04, B05 | B05 ‖ B03/B04 | 3 |
| 3 | B06, B07 | — | 4 |
| 4 | B08 | — | 5, 6 |
| 5 | B09–B14 | — | 6, 7 |
| 6 | B15–B33 | US2 ‖ US3 (19 slices) | 7, 8, 9 |
| 7 | B34–B44 | — | 8, 9 |
| 8 | B45–B51 | — | 9 |
| 9 | B52–B62 | B52–B56 ‖ | 10 |
| 10 | B63–B66 | — | — |

**66 slices · 11 waves · max intra-wave parallelism: US2 ‖ US3 (19 slices)**

---

No browser tasks: backend-only. PRD 007 frontend tasks use `agent-browser`.
