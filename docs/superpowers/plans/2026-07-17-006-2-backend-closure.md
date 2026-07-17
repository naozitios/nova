# 006.2 Backend Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every 006.2 backend requirement, rationalize Business Context tests without reducing coverage, and pass all release gates so only PRD 007 browser work remains.

**Architecture:** Five dependency-gated tracks: domain truth and transactions, contract-to-route parity, missing real-boundary E2E, provider/release gates, then balanced test rationalization. Pure policy remains in core; Supabase transactions enforce final invariants; Next.js routes use Container services and shared auth/idempotency helpers.

**Tech Stack:** TypeScript 5 strict, Next.js 16.1.1, NextAuth 4.24.14, Zod 4.3.5, Supabase JS 2.110.4/Postgres/Storage/Auth/RLS, Vitest 4.1.10, Node 22, ClamAV 1.4.3.

## Global Constraints

- No Business Context SQLite/mock/in-memory production endpoints.
- No browser credentials or `X-User-Id` in production/E2E.
- Upload scanning fails closed; OCR and legacy conversion remain deferred with retained originals.
- Current approved profile remains active during update.
- Real HTTP/NextAuth/Supabase/worker/Storage/RLS E2E is required; browser UI is deferred.
- Existing dependencies only; no new queue, ORM, auth, UI, or LLM provider.
- Every behavior change uses red-green-refactor and focused review.
- Cavecrew builders receive at most two known files; main thread owns SQL and cross-cutting changes.
- Do not update completion statuses before fresh gate evidence exists.

---

## File Structure And Ownership

- `src/core/business-context/onboarding-readiness.ts`: pure readiness policy.
- `src/core/business-context/service/onboarding.service.ts`: session, answers, readiness refresh, onboarding draft facade.
- `src/core/business-context/compiler.ts`: active-fact selection and nested draft projection.
- `supabase/migrations/*approve_onboarding*.sql`: locked atomic approval policy.
- `src/core/business-context/service/upload.service.ts`: upload intent/finalization orchestration.
- `src/app/api/businesses/[id]/context/uploads/**`: upload HTTP API.
- `src/app/api/meta/connections/**`: workspace-scoped Meta HTTP API.
- `src/app/api/businesses/[id]/context/versions/**`: version detail/compare HTTP API.
- `tests/e2e/business-context/*`: one user-story suite per backend story plus shared harness.
- `tests/coverage/business-context-requirements.md`: FR/SC evidence matrix and test-rationalization record.
- `vitest.config.ts` and package scripts: safe unit/contract parallelism and serial DB/E2E gates.

---

### Task 1: Establish Requirement Coverage And Baseline Metrics

**Files:**
- Create: `tests/coverage/business-context-requirements.md`
- Modify: `specs/006.2-business-context-remediation/tasks.md`

**Interfaces:**
- Consumes: FR-001–FR-056 and SC-001–SC-015 from `spec.md`.
- Produces: one evidence row per requirement with owning test and gate command.

- [ ] **Step 1: Record current baseline**

Run:
```bash
npm test
npm run test:business-context:e2e
npm run lint
npm run build
```
Expected baseline: full suite and lint fail; dedicated E2E and build pass.

- [ ] **Step 2: Create evidence matrix**

Use this exact schema:
```markdown
| Requirement | Behavior | Strongest test | Boundary | Status |
|---|---|---|---|---|
| FR-001 | Durable mutation idempotency | tests/contract/business-context/idempotency-inventory.test.ts | contract/source audit | covered |
| SC-001 | Create-to-v1 real-boundary flow | tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts | HTTP/Auth/worker/Supabase | failing |
```
Add all 71 FR/SC rows. Use `missing` when no test exists; do not infer coverage.

- [ ] **Step 3: Mark task statuses from evidence only**

Change stale comments such as B44 `NOT_IMPLEMENTED` to `PARTIAL` because a happy-path file exists but required scenarios and full-suite reliability are missing. Keep B63–B66 partial.

- [ ] **Step 4: Commit**

```bash
git add tests/coverage/business-context-requirements.md specs/006.2-business-context-remediation/tasks.md
git commit -m "docs: map 006.2 requirement evidence"
```

---

### Task 2: Make Answer Submission Reuse Provenance And Derive Readiness

**Files:**
- Modify: `src/core/business-context/service/onboarding.service.ts:222-304`
- Modify: `tests/unit/business-context/service.test.ts`

**Interfaces:**
- Consumes: `getReadiness(repo, businessId, workspaceId)`.
- Produces: `findOrCreateSessionAnswerSource(...)` and readiness-derived session updates.

- [ ] **Step 1: Write failing unit tests**

Add tests proving two answer batches create one `user_answer` source and a blocked readiness result does not set `READY_FOR_APPROVAL`:
```typescript
expect(repo.createContextSource).toHaveBeenCalledTimes(1)
expect(repo.updateOnboardingSession).toHaveBeenLastCalledWith(
  workspaceId,
  session.id,
  expect.objectContaining({ status: OnboardingStatus.AWAITING_ANSWERS }),
)
```

- [ ] **Step 2: Run red test**

```bash
npm test -- tests/unit/business-context/service.test.ts
```
Expected: FAIL because `submitAnswers` creates a source every call and always writes `READY_FOR_APPROVAL`.

- [ ] **Step 3: Implement minimal reuse and status derivation**

Search existing sources for `sourceType === SourceType.USER_ANSWER` and `metadata.sessionId === session.id`; create only when absent. After writes, call `getReadiness` and map:
```typescript
const nextStatus = readiness.data?.approvalReady
  ? OnboardingStatus.READY_FOR_APPROVAL
  : OnboardingStatus.AWAITING_ANSWERS
const currentStep = readiness.data?.approvalReady
  ? 'approval'
  : readiness.data?.routeStage ?? 'questions'
```

- [ ] **Step 4: Run focused gate**

```bash
npm test -- tests/unit/business-context/service.test.ts tests/unit/business-context/onboarding-readiness.test.ts
```
Expected: PASS.

- [ ] **Step 5: Cavecrew review and commit**

```bash
git add src/core/business-context/service/onboarding.service.ts tests/unit/business-context/service.test.ts
git commit -m "fix(onboarding): derive readiness after answers"
```

---

### Task 3: Supersede Repeated User Facts Instead Of Duplicating Them

**Files:**
- Modify: `src/core/business-context/repository/fact.port.ts:24-32`
- Modify: `src/core/business-context/service/onboarding.service.ts:260-296`
- Modify: `tests/integration/business-context/onboarding-question-persistence.test.ts`
- Modify: `tests/unit/business-context/service.test.ts`

**Interfaces:**
- Consumes: `persistFactReconciliation(workspaceId, businessId, supersessions, creations, conflicts)`.
- Produces: typed atomic reconciliation payload and one active user-verified fact per session/key with retained superseded history.

- [ ] **Step 1: Add failing real-Supabase test**

Submit two values for `market.primary`; assert one active fact, one superseded fact, and `new.supersedes_fact_id === old.id`.

- [ ] **Step 2: Run red test**

```bash
npm test -- tests/integration/business-context/onboarding-question-persistence.test.ts
```
Expected: FAIL with two active facts or missing supersession link.

- [ ] **Step 3: Implement atomic supersession**

First extend `PersistFactReconciliationCreate` with fields already consumed by the SQL RPC:
```typescript
sourceDocumentId?: string | null
verificationStatus?: VerificationStatus
validFrom?: Date
validTo?: Date | null
createdBy?: string
```
Load active same-key facts and call reconciliation with:
```typescript
const supersessions = activeFacts.map((fact) => ({ oldFactId: fact.id }))
const creations = [{
  factKey: item.factKey,
  value: item.answer,
  sourceId: provenanceSourceId,
  confidence: 1,
  supersedesFactId: activeFacts[0]?.id ?? null,
  verificationStatus: VerificationStatus.USER_VERIFIED,
}]
```
Serialize `Date` values in the repository adapter before sending JSON to Supabase.

- [ ] **Step 4: Run unit and integration gates**

```bash
npm test -- tests/unit/business-context/service.test.ts tests/integration/business-context/onboarding-question-persistence.test.ts tests/integration/business-context/reconciliation-atomicity.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/business-context/repository/fact.port.ts src/core/business-context/service/onboarding.service.ts tests/unit/business-context/service.test.ts tests/integration/business-context/onboarding-question-persistence.test.ts
git commit -m "fix(onboarding): supersede repeated answers"
```

---

### Task 4: Compile Onboarding Drafts From Active Facts

**Files:**
- Modify: `src/core/business-context/service/onboarding.service.ts:307-331`
- Modify: `tests/unit/business-context/compiler.test.ts`
- Modify: `tests/unit/business-context/service.test.ts`

**Interfaces:**
- Consumes: `compileDraftFromFacts(repo, workspaceId, businessId)` from `compiler.ts`.
- Produces: nested fact-backed profile; questions no longer serve as profile truth.

- [ ] **Step 1: Write failing tests**

Assert question answer differs from active verified fact and compiled profile uses fact value:
```typescript
expect(result).toEqual({
  business: { name: 'Verified Name' },
  market: { primary: 'Verified Market' },
})
```

- [ ] **Step 2: Run red tests**

```bash
npm test -- tests/unit/business-context/compiler.test.ts tests/unit/business-context/service.test.ts
```
Expected: FAIL because `compileOnboardingDraft` iterates questions.

- [ ] **Step 3: Delegate to shared compiler**

Replace question projection with `compileDraftFromFacts`; return its nested `profile` and preserve compiler warnings in the route DTO where supported.

- [ ] **Step 4: Run focused gate and commit**

```bash
npm test -- tests/unit/business-context/compiler.test.ts tests/unit/business-context/service.test.ts tests/contract/business-context/context-compile.test.ts
git add src/core/business-context/service/onboarding.service.ts tests/unit/business-context/compiler.test.ts tests/unit/business-context/service.test.ts
git commit -m "fix(onboarding): compile drafts from facts"
```

---

### Task 5: Enforce Readiness Inside Atomic Approval

**Files:**
- Create: `supabase/migrations/202607170000_approve_onboarding_v3_readiness.sql`
- Modify: `tests/integration/business-context/approve-onboarding-atomic.test.ts`

**Interfaces:**
- Consumes: persisted sources, facts, conflicts, quality gates, jobs, session, and current version.
- Produces: `approve_onboarding_v1(uuid, uuid, uuid)` with full readiness recheck under transaction locks.

- [ ] **Step 1: Add failing integration cases**

Add cases for `EVIDENCE_SOURCE_REQUIRED`, `MISSING_REQUIRED_FACT`, `REQUIRED_KEY_UNKNOWN`, `SOURCE_NOT_PROCESSED`, and blocking quality. Each case asserts no new version, no session approval, and no audit row. Expected-base enforcement belongs to update approval and is covered in Task 13 because initial-v1 RPC has no base-version input.

- [ ] **Step 2: Run red gate**

```bash
npm run supabase:reset
npm test -- tests/integration/business-context/approve-onboarding-atomic.test.ts
```
Expected: FAIL because v2 RPC checks only session status, sections, and conflicts.

- [ ] **Step 3: Implement v3 RPC**

Inside one PL/pgSQL function:
```sql
select * into v_session
from onboarding_sessions
where workspace_id = p_workspace_id and business_id = p_business_id
order by started_at desc
limit 1
for update;

perform 1 from businesses
where id = p_business_id and workspace_id = p_workspace_id
for update;
```
Build profile from active facts (`verification_status in ('user_verified','verified')`, `valid_to is null`), enforce qualifying processed evidence, required keys, explicit unknown policy, no active required jobs, no open conflicts, and no blocking quality results before version writes.

- [ ] **Step 4: Run reset and atomic gate**

```bash
npm run supabase:reset
npm test -- tests/integration/business-context/approve-onboarding-atomic.test.ts tests/integration/business-context/profile-versions.test.ts
```
Expected: PASS.

- [ ] **Step 5: Review SQL and commit**

```bash
git add supabase/migrations/202607170000_approve_onboarding_v3_readiness.sql tests/integration/business-context/approve-onboarding-atomic.test.ts
git commit -m "fix(db): enforce onboarding readiness atomically"
```

---

### Task 6: Correct Worker Timeout, Blocked Outcome, And Reconciliation Ownership

**Files:**
- Modify: `src/core/business-context/service/onboarding.service.ts:71-93`
- Modify: `src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts:83-85`
- Modify: `src/infrastructure/business-context/job-runner/handlers/extract.handler.ts:15-22`
- Create: `supabase/migrations/202607170001_reconciliation_workspace_guard.sql`
- Modify tests: nearest handler, service, and reconciliation integration tests.

**Interfaces:**
- Produces: website jobs with `stageTimeoutSeconds: 30`; explicit blocked handler status; workspace-owned reconciliation writes.

- [ ] **Step 1: Add failing focused tests**

Assert optional website job timeout equals 30, blocked handler result equals `blocked_needs_user_action`, and cross-workspace reconciliation returns a stable ownership error with zero writes.

- [ ] **Step 2: Run red tests**

```bash
npm test -- src/infrastructure/business-context/job-runner/handlers/source-processing.handler.test.ts tests/unit/business-context/service.test.ts tests/integration/business-context/reconciliation-atomicity.test.ts
```

- [ ] **Step 3: Implement minimal changes**

Extend `JobHandler.terminalStatus` with `'blocked_needs_user_action'`; set timeout 30; add business/workspace existence guard at start of reconciliation RPC.

- [ ] **Step 4: Run reset/focused gates and commit**

```bash
npm run supabase:reset
npm test -- src/infrastructure/business-context/job-runner/handlers/source-processing.handler.test.ts tests/unit/business-context/service.test.ts tests/integration/business-context/reconciliation-atomicity.test.ts
git add src/core/business-context/service/onboarding.service.ts src/infrastructure/business-context/job-runner/handlers/source-processing.handler.ts src/infrastructure/business-context/job-runner/handlers/extract.handler.ts supabase/migrations/202607170001_reconciliation_workspace_guard.sql
git commit -m "fix(worker): preserve blocked outcomes"
```

---

### Task 7: Add Upload API And Finalization Service

**Files:**
- Modify: `src/core/business-context/service/upload.service.ts`
- Create: `src/app/api/businesses/[id]/context/uploads/route.ts`
- Create: `src/app/api/businesses/[id]/context/uploads/classification-proposals/route.ts`
- Create: `src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route.ts`
- Create: `tests/contract/business-context/uploads.test.ts`

**Interfaces:**
- Consumes: `getUploadRepository`, `getUploadStorage`, `getMalwareScanner`, `getIdempotencyService` from Container providers.
- Produces: proposal, intent, and completion HTTP operations matching OpenAPI.

- [ ] **Step 1: Write route contract tests**

Assert editor authorization, required idempotency on mutations, proposal binding, signed URL response, completion `202`, viewer `403`, mismatch/expiry/malware stable errors.

- [ ] **Step 2: Run red contract test**

```bash
npm test -- tests/contract/business-context/uploads.test.ts
```
Expected: FAIL because route modules do not exist.

- [ ] **Step 3: Implement finalization service**

Add `completeUploadIntent(...)` that loads intent, verifies ownership/expiry/object metadata/size/signature, streams scanner before parsing, hashes SHA-256, deduplicates in-business checksum, creates source/job idempotently, and records only safe scanner result/code.

- [ ] **Step 4: Implement routes using shared helpers**

Each mutation follows:
```typescript
const auth = await requireAuthz(request, workspaceId, 'editor')
if (!auth.ok) return auth.response
return withIdempotency(request, handler, { operation, workspaceId })
```

- [ ] **Step 5: Run contract/unit gates and commit**

```bash
npm test -- src/core/business-context/service/upload.service.test.ts tests/contract/business-context/uploads.test.ts tests/contract/business-context/idempotency-inventory.test.ts
git add src/core/business-context/service/upload.service.ts src/app/api/businesses/[id]/context/uploads tests/contract/business-context/uploads.test.ts
git commit -m "feat(api): add secure upload lifecycle"
```

---

### Task 8: Add Version Detail And Comparison Routes

**Files:**
- Modify: `src/core/business-context/service/context.service.ts`
- Create: `src/app/api/businesses/[id]/context/versions/[versionId]/route.ts`
- Create: `src/app/api/businesses/[id]/context/versions/compare/route.ts`
- Modify: `tests/contract/business-context/context-management.test.ts`

**Interfaces:**
- Produces: `getVersion(repo, workspaceId, businessId, versionId)` and `compareVersions(...)` with attributed diffs.

- [ ] **Step 1: Add failing contract cases**

Verify business ownership, viewer access, cross-business `404`, `from`/`to` validation, and old/proposed values.

- [ ] **Step 2: Run red test**

```bash
npm test -- tests/contract/business-context/context-management.test.ts
```

- [ ] **Step 3: Implement service and routes**

Load both versions with workspace ID, reject when `businessId` differs, call `computeFieldDiffs(from.profile, to.profile)`, and return typed metadata.

- [ ] **Step 4: Run gate and commit**

```bash
npm test -- tests/contract/business-context/context-management.test.ts tests/integration/business-context/profile-versions.test.ts
git add src/core/business-context/service/context.service.ts src/app/api/businesses/[id]/context/versions tests/contract/business-context/context-management.test.ts
git commit -m "feat(api): add version detail and compare"
```

---

### Task 9: Add Workspace-Scoped Meta Connection Routes

**Files:**
- Create: `src/app/api/meta/connections/route.ts`
- Create: `src/app/api/meta/connections/callback/route.ts`
- Create: `src/app/api/meta/connections/select-account/route.ts`
- Create: `tests/contract/business-context/meta-connections.test.ts`
- Modify: `tests/contract/business-context/_idempotency-helpers.ts`

**Interfaces:**
- Consumes: Meta connection repository/resolver, signed state, provider-code replay repository, existing OAuth adapter.
- Produces: sanitized status/start/callback/account-selection operations matching OpenAPI.

- [ ] **Step 1: Write failing contract tests**

Cover editor/admin role, no token in response, signed state binding, state/code replay rejection, account ownership, sanitized status, callback `303`, and mutation idempotency.

- [ ] **Step 2: Run red tests**

```bash
npm test -- tests/contract/business-context/meta-connections.test.ts tests/contract/business-context/idempotency-inventory.test.ts
```

- [ ] **Step 3: Implement routes**

Reuse existing OAuth exchange logic behind Container-owned services. Callback remains header-idempotency exception and consumes signed state/provider code exactly once.

- [ ] **Step 4: Run Meta/RLS gates and commit**

```bash
npm test -- tests/contract/business-context/meta-connections.test.ts tests/integration/business-context/meta-replay.test.ts tests/rls/business-context/remediation-isolation-meta.test.ts
git add src/app/api/meta/connections tests/contract/business-context/meta-connections.test.ts tests/contract/business-context/_idempotency-helpers.ts
git commit -m "feat(api): add workspace meta connections"
```

---

### Task 10: Complete B44 Onboarding E2E Scenarios

**Files:**
- Rewrite: `tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts`
- Modify: `tests/e2e/business-context/supabase.ts`

**Interfaces:**
- Consumes: shared E2E harness and completed Tracks A/B.
- Produces: independent named scenarios for SC-001, SC-008, SC-009, SC-010, SC-011.

- [ ] **Step 1: Split lifecycle from assertions**

Use describe-scoped setup/cleanup and named tests for happy path, explicit unknown, manual-only rejection, open conflict, active job, viewer denial, and idempotent approval.

- [ ] **Step 2: Add nested profile assertions**

```typescript
expect(profile).toMatchObject({
  business: { name: expect.any(String), primary_outcome: expect.anything() },
  market: { primary: expect.anything() },
  advertising: { primary_objective: expect.anything() },
  economics: { monthly_meta_budget: expect.anything() },
})
```

- [ ] **Step 3: Run B44 repeatedly**

```bash
npm test -- tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts
npm test -- tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts
```
Expected: both runs PASS with cleanup leaving no app/worker process.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/business-context/b44-onboarding-user-flow.e2e.test.ts tests/e2e/business-context/supabase.ts
git commit -m "test(e2e): complete onboarding scenarios"
```

---

### Task 11: Add US2 Upload E2E

**Files:**
- Create: `tests/e2e/business-context/us2-upload-management.e2e.test.ts`
- Create: `tests/fixtures/business-context/uploads/` fixture files
- Modify: `tests/e2e/business-context/harness.ts` only if shared Storage helper is required.

**Interfaces:**
- Produces: real HTTP/Storage/scanner/worker proof for SC-005 and SC-006.

- [ ] **Step 1: Add fixture manifest**

Include text, HTML, PDF, DOCX, PPTX, XLSX, legacy DOC/PPT/XLS signatures, malformed, MIME mismatch, empty, oversized metadata, and EICAR fixture generation.

- [ ] **Step 2: Write end-to-end scenarios**

Create proposal/intent, PUT to signed private Storage URL, complete through HTTP, poll worker, inspect source/documents/facts/history. Assert infected/unavailable/invalid paths create zero facts.

- [ ] **Step 3: Run US2 gate**

```bash
npm test -- tests/e2e/business-context/us2-upload-management.e2e.test.ts
```
Expected: PASS; legacy/OCR outcomes remain actionable and non-retryable.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/business-context/us2-upload-management.e2e.test.ts tests/fixtures/business-context/uploads tests/e2e/business-context/harness.ts
git commit -m "test(e2e): cover upload management"
```

---

### Task 12: Add US3 Extraction And Conflict E2E

**Files:**
- Create: `tests/e2e/business-context/us3-extraction-conflicts.e2e.test.ts`
- Reuse: `tests/fixtures/business-context/extraction/*.json`

**Interfaces:**
- Produces: HTTP/worker/Supabase proof for SC-007 and SC-008.

- [ ] **Step 1: Write corpus and filtering scenario**

Process versioned marketing/business-plan/financial fixtures; calculate expected-key recall, null rejection, excerpt coverage, and locator coverage.

- [ ] **Step 2: Write conflict lifecycle scenario**

Process competing facts, assert exactly one open conflict and targeted question, approval `409`, resolve through HTTP, assert obsolete question dismissal and readiness refresh.

- [ ] **Step 3: Run gate and commit**

```bash
npm test -- tests/e2e/business-context/us3-extraction-conflicts.e2e.test.ts
git add tests/e2e/business-context/us3-extraction-conflicts.e2e.test.ts
git commit -m "test(e2e): cover extraction conflicts"
```

---

### Task 13: Add US5 Repeat-Setup E2E

**Files:**
- Create: `tests/e2e/business-context/us5-repeat-setup.e2e.test.ts`

**Interfaces:**
- Produces: HTTP/Supabase proof for SC-011 and version API parity.

- [ ] **Step 1: Write v1-to-v2 scenario**

Approve v1, start/resume one update session, create correction, verify v1 remains current, compile attributed diff, reject stale expected base with intact draft, approve v2, verify immutable v1 and sole current v2.

- [ ] **Step 2: Write compare/restore scenario**

Compare v1/v2, reject viewer and stale restore, restore v1 as new v3, verify immutable history and one current version.

- [ ] **Step 3: Run gate and commit**

```bash
npm test -- tests/e2e/business-context/us5-repeat-setup.e2e.test.ts
git add tests/e2e/business-context/us5-repeat-setup.e2e.test.ts
git commit -m "test(e2e): cover repeat setup"
```

---

### Task 14: Add US6 Security And Operations E2E

**Files:**
- Create: `tests/e2e/business-context/us6-security-operations.e2e.test.ts`

**Interfaces:**
- Produces: real NextAuth/JWT/RLS/worker/scanner/log proof for SC-012–SC-014.

- [ ] **Step 1: Write authorization and RLS matrix**

Assert guessed cross-workspace IDs fail, viewer reads sanitized state but cannot mutate, bearer spoofing and `X-User-Id` fail, and direct user-JWT RLS denies tenant crossing.

- [ ] **Step 2: Write operations scenarios**

Cover Meta credential missing/expired/cross-workspace, scanner unavailable/EICAR, retry/dead-letter, circuit half-open probe, archive race, visibility DTO, and sensitive marker scan.

- [ ] **Step 3: Run gate and commit**

```bash
npm test -- tests/e2e/business-context/us6-security-operations.e2e.test.ts
git add tests/e2e/business-context/us6-security-operations.e2e.test.ts
git commit -m "test(e2e): cover security operations"
```

---

### Task 15: Restore Provider Verification And Rationalize Tests

**Files:**
- Create: `tests/integration/business-context/extraction-provider.integration.test.ts`
- Modify: `.github/workflows/business-context-provider-verification.yml`
- Modify: `vitest.config.ts`
- Create: `vitest.business-context.unit.config.ts`
- Create: `vitest.business-context.serial.config.ts`
- Modify: `package.json`
- Modify/delete duplicate mock definitions identified in coverage matrix.

**Interfaces:**
- Produces: executable provider gate; parallel-safe pure suite; serial DB/RLS/E2E suite.

- [ ] **Step 1: Add provider gate behavior**

When `BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1`, missing key fails. With key, execute extraction and assert schema/evidence/latency report. Without requested flag, emit one explicit skipped test.

- [ ] **Step 2: Verify red then green script wiring**

```bash
BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1 npm run test:business-context:providers
```
Expected before credentials: FAIL with `GROQ_API_KEY required`, not “No test files found”.

- [ ] **Step 3: Split safe and serial configs**

Unit config includes `src/**/*.test.ts`, `tests/unit/**`, and pure contract files with `fileParallelism: true`. Serial config includes integration/RLS/E2E with `fileParallelism: false`.

- [ ] **Step 4: Remove proven duplicate setup**

Replace inline `createMockRepo` and conflict fixtures with canonical shared helpers. Move mock-only “integration” tests to contract tier or delete when real atomic tests cover identical behavior. Record every deletion and replacement test in coverage matrix.

- [ ] **Step 5: Run both pools and commit**

```bash
npm run test:business-context:unit
npm run test:business-context:serial
git add tests/integration/business-context/extraction-provider.integration.test.ts .github/workflows/business-context-provider-verification.yml vitest*.ts package.json tests/contract tests/integration tests/coverage/business-context-requirements.md
git commit -m "test: streamline business context gates"
```

---

### Task 16: Close Release Gates And Reconcile Documentation

**Files:**
- Modify: `specs/006.2-business-context-remediation/spec.md`
- Modify: `specs/006.2-business-context-remediation/plan.md`
- Modify: `specs/006.2-business-context-remediation/tasks.md`
- Modify: `specs/006.2-business-context-remediation/quickstart.md`
- Modify: `tests/coverage/business-context-requirements.md`

**Interfaces:**
- Produces: one honest final completion record tied to current command evidence.

- [ ] **Step 1: Clean reset and subsystem gates**

```bash
npm run supabase:reset
npm run test:business-context:unit
npm run test:business-context:serial
npm run test:business-context:e2e
```
Expected: all pass with zero skipped required suites.

- [ ] **Step 2: Full repository gates**

```bash
npm test
npm run lint
npm run build
```
Expected: all exit 0.

- [ ] **Step 3: Provider release gate**

```bash
BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1 GROQ_API_KEY="$GROQ_API_KEY" npm run test:business-context:providers
```
Expected: executed provider test passes and report contains no `skipped` status.

- [ ] **Step 4: Route and process audit**

Compare `next build` route manifest with every OpenAPI path. Confirm no stale `next dev`, Vitest, or worker processes remain after E2E.

- [ ] **Step 5: Update evidence and statuses**

Set B-blocks to `VERIFIED` only where the current revision has passing evidence. Remove blocker text only when all completion criteria in the design document hold.

- [ ] **Step 6: Final cavecrew review**

Review full branch against FR-001–FR-056, SC-001–SC-015, OpenAPI, migrations, and test matrix. Resolve every critical/high finding before commit.

- [ ] **Step 7: Commit final evidence**

```bash
git add specs/006.2-business-context-remediation tests/coverage/business-context-requirements.md
git commit -m "docs: verify 006.2 backend closure"
```

## Final Success Criteria

- Every FR/SC has strongest-boundary evidence.
- All promised routes exist and match OpenAPI.
- All six backend E2E stories pass from clean state.
- Full suite has no cross-suite interference.
- Provider requested run executes rather than skips.
- Lint and build pass.
- Test count/runtime/duplication metrics improve without requirement coverage loss.
- Only PRD 007 browser implementation remains.
