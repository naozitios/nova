# 006.2 Backend Closure Design

## Goal

Complete every backend requirement in `006.2-business-context-remediation` before PRD 007 frontend work begins. Browser UI and browser-driven tests remain deferred. Backend API, worker, Supabase, Auth, RLS, Storage, provider verification, and real-boundary E2E must be complete and repeatably green.

## Current Problems

The release review found these blocking classes of defects:

1. Onboarding readiness is not authoritative. Answer submission can mark a session ready without applying the full readiness policy.
2. Draft and approval paths compile question rows instead of active precedence-resolved facts.
3. Answer submissions create duplicate provenance sources and facts, producing conflicts and nondeterministic values.
4. Approval transaction does not independently enforce the full readiness matrix.
5. OpenAPI documents upload, Meta connection, and version operations that production routes do not expose.
6. US2, US3, US5, and US6 lack complete real-boundary E2E proof.
7. Provider verification references a missing test file.
8. Full test and lint gates fail. Dedicated E2E passes alone but is not reliable inside the full suite.
9. Business Context tests contain duplicated setup, overlapping assertions, mock-only coverage, and oversized E2E scenarios.

## Execution Architecture

Work proceeds through five dependency-gated tracks. A later track may start only when its required earlier gate passes.

### Track A: Domain Truth And Transactions

Make one readiness policy authoritative across session creation, answer submission, draft compilation, and approval.

- `computeOnboardingReadiness` remains the pure policy source.
- `submitAnswers` writes answers and facts, recomputes readiness, then derives session status and route step.
- One `user_answer` source is reused per onboarding session.
- A later answer or correction supersedes the active same-key user fact while retaining prior evidence.
- Draft compilation reads active facts through shared precedence and nests dotted keys.
- Questions remain interaction records; they are not profile truth.
- Approval rechecks readiness inside the database transaction while relevant session/version rows are locked.
- Approval requires qualifying processed evidence, required verified or explicit-unknown facts, no open conflicts, no blocking quality failures, no required active processing, and a valid expected base.
- Approval atomically publishes one current version, approves the session, and writes audit records.
- Rejected approval changes no current profile, draft, session, or audit state.
- Reconciliation validates business/workspace ownership before fact writes.
- Optional website jobs receive bounded stage timeouts.
- OCR and legacy blocks retain the explicit `blocked_needs_user_action` outcome and are never retried.

### Track B: Contract-To-Route Parity

Every backend operation promised by OpenAPI must exist in the Next.js route manifest and use production composition.

- Upload classification proposal, upload intent, and upload completion routes.
- Meta connection start, callback, status, and account-selection routes.
- Version detail and arbitrary comparison routes.
- Existing source, job, onboarding, profile, conflict, diff, restore, and approval routes audited for request/response parity.
- Routes use NextAuth identity, workspace membership, role checks, Zod validation, durable idempotency, Container services, and canonical errors.
- No route-level adapter construction and no compatibility aliases unless an existing external consumer requires one.
- OpenAPI changes only when implementation and approved scope intentionally differ.

### Track C: Missing Real-Boundary Proof

Add complete backend E2E for missing user stories. External provider responses may be deterministic fakes; persistence and process boundaries remain real.

- US2 upload: signed private upload, completion verification, malware scan outcomes, modern parsing, legacy/OCR blocks, duplicate checksum, invalid/oversized/foreign objects, retry, archive, and retained history.
- US3 extraction: corpus thresholds, evidence locators, null rejection, conflicts, one question per normalized key, obsolete dismissal, and approval blocking through HTTP.
- US5 repeat setup: active v1 during update, session replay, correction provenance, attributed diff, stale-base rejection, v2 approval, immutable history, compare, and restore-as-new-version.
- US6 operations: NextAuth role matrix, real JWT RLS, viewer read-only behavior, Meta credential resolution, scanner fail-closed behavior, retry/dead-letter, circuit probe, archive race, visibility, and sensitive-data scan.
- B44 onboarding scenarios cover happy path, explicit unknown, manual-only evidence rejection, conflict blocker, processing blocker, nested fact-backed draft, viewer denial, idempotent approval, and sole current v1.
- Harness owns app, worker, scanner, users, reset, ports, polling, and teardown.

### Track D: Provider And Release Gates

- Restore the provider integration test referenced by `test:business-context:providers`, or change script and workflow together to one real maintained gate.
- A requested credentialed run fails if it skips.
- Provider workflow triggers for all files that can change provider behavior or benchmark expectations.
- Clean Supabase reset, migrations, integration, contract, RLS, full suite, dedicated E2E, provider gate, lint, build, quickstart smoke, and PRD 007 compatibility audit must pass.
- DB-backed suites run serially when sharing resettable local infrastructure.
- Spec and task statuses update only after fresh evidence exists.

### Track E: Balanced Test Rationalization

Reduce test cost without weakening requirement proof.

1. Build an FR/SC-to-test coverage map for all Business Context requirements.
2. Classify each test file and scenario as keep, merge, rewrite, or delete.
3. Keep pure policy tests fast and local.
4. Keep integration tests at real repository, transaction, parser, Storage, and RLS boundaries.
5. Keep a small number of E2E journeys for cross-process behavior.
6. Remove mock-only tests when stronger integration or E2E coverage proves the same behavior.
7. Merge repeated fixture and process setup into shared helpers without hiding assertions.
8. Split oversized single-case E2E files into named scenarios while sharing lifecycle safely.
9. Preserve security, concurrency, transaction rollback, idempotency, and regression tests even when slow.
10. Measure before and after: test files, scenarios, runtime, duplicated lines, flaky failures, and FR/SC coverage.

Deletion requires evidence that another retained test covers the same requirement at an equal or stronger boundary.

## Test-First Workflow

Every behavior change follows red-green-refactor:

1. Add or identify the smallest failing test that proves the defect.
2. Run it and record the expected failure.
3. Apply one minimal production change.
4. Run the focused test and affected subsystem gate.
5. Run a cavecrew review for the completed slice.
6. Refactor or rationalize tests only after behavior is green.

Migration changes require clean-reset integration tests before application changes depend on them.

## Cavecrew Responsibilities

- `cavecrew-investigator`: locate definitions, callers, tests, and requirement coverage for one bounded slice.
- `cavecrew-builder`: make surgical changes limited to one or two known files.
- `cavecrew-reviewer`: audit each slice or track for bugs and missing tests.
- Main thread: architecture, dependency ordering, SQL transactions, cross-file changes, conflict resolution, release decisions, and final verification.

No builder receives an ambiguous multi-file feature. Cross-cutting work remains in the main thread or is decomposed first.

## Failure Handling

- Stable domain codes cross service, RPC, route, and OpenAPI layers.
- Security-sensitive errors never expose document bodies, credentials, tokens, personal markers, or provider response bodies.
- Failed transactional operations leave no partial facts, versions, audits, or session transitions.
- Retryable and non-retryable outcomes remain distinct.
- Test harness failures report process logs, current persisted state, and cleanup status.

## Completion Evidence

006.2 is complete only when all conditions hold in one current revision:

1. Every backend FR-001 through FR-056 has implementation and mapped test evidence.
2. Every SC-001 through SC-015 has passing evidence or an explicitly approved credentialed release artifact.
3. OpenAPI operations match production routes and typed behavior.
4. All six backend user-story E2E suites pass from a clean local environment.
5. `npm test` passes without cross-suite interference.
6. `npm run test:business-context:e2e` passes.
7. Requested provider verification executes and passes; it does not silently skip.
8. `npm run lint` passes.
9. `npm run build` passes.
10. Quickstart commands work from clean reset.
11. Test rationalization preserves complete FR/SC coverage and records before/after metrics.
12. Worktree has no stale test-owned processes after gates.
13. `spec.md`, `plan.md`, `tasks.md`, and `quickstart.md` state the same honest completion status.

Only browser components and browser-driven onboarding/editor tests remain for PRD 007.
