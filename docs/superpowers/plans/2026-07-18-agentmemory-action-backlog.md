# Agentmemory Action Backlog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve remaining actionable agentmemory backlog for NOVA without broad edits or machine-heavy runs.

**Architecture:** Treat existing parent actions as containers. Execute child actions in dependency order with cavecrew-sized boundaries: one diagnosis, one minimal fix slice, one verification gate. Prefer sequential work for Spec 006.2 worker/E2E tasks; lint remediation can split after bucket discovery.

**Tech Stack:** Next.js, Vitest, Supabase local stack, ESLint, agentmemory actions, cavecrew subagents, RTK CLI.

## Global Constraints

- Use `rtk` wrappers for bash commands.
- Keep subagents small and narrowly scoped.
- Do not run full suite/build/lint unless action explicitly says verification requires it.
- Do not delete or revert unrelated worktree changes.
- Use `cavecrew-investigator` for read-only mapping, `cavecrew-builder` for <=2-file fixes, `cavecrew-reviewer` for diff verification.
- For real Next dev app or worker processes, use strict timeout and cleanup.

---

## Remaining Parent Actions

- `act_mrm6ryrc_156705700bcb` — Finish Spec 006.2 B11 worker gate — priority 10 — status `active`.
- `act_mrqh46hi_32417657fa9b` — Fix repo-wide lint baseline — priority 7 — status `active`.

## Recommended Order

1. Complete B11 worker gate before lint work. It blocks meaningful B14 E2E continuation and has higher priority.
2. Complete B14 auth continuation after B11 gate is green.
3. Run lint baseline discovery and split fixes by bucket. Do not patch lint broadly before bucket counts exist.

---

### Task 1: B11 Failure Evidence

**Agentmemory Action:** `act_mrqjqmnz_6656204ede55`

**Parent:** `act_mrm6ryrc_156705700bcb`

**Cavecrew Type:** `cavecrew-investigator` first. Escalate to `cavecrew-builder` only for <=1-file test cleanup.

**Files:**
- Inspect: `tests/integration/business-context/source-processing-worker.claim-lease.test.ts`
- Inspect: `tests/integration/business-context/source-processing-worker.heartbeat-retry.test.ts`
- Inspect: `tests/integration/business-context/source-processing-worker.duplicate-prevention.test.ts`
- Inspect: `tests/integration/business-context/source-processing-worker.shutdown-recovery.test.ts`
- Inspect: `tests/integration/business-context/source-processing-worker.helpers.ts`

**Interfaces:**
- Consumes: existing source-processing-worker integration suite.
- Produces: exact failed test, failed `context_jobs` row fields, suspected lifecycle fault.

- [ ] **Step 1: Run focused batch with compact output**

```bash
rtk npx vitest run \
  tests/integration/business-context/source-processing-worker.claim-lease.test.ts \
  tests/integration/business-context/source-processing-worker.heartbeat-retry.test.ts \
  tests/integration/business-context/source-processing-worker.duplicate-prevention.test.ts \
  tests/integration/business-context/source-processing-worker.shutdown-recovery.test.ts
```

Expected: reproduces batch-only failure or passes and exposes stale action.

- [ ] **Step 2: Capture failed job row before cleanup**

Capture fields: `id`, `status`, `locked_by`, `locked_at`, `heartbeat_at`, `error`, `error_class`, `attempt_count`, `next_run_at`.

- [ ] **Step 3: Record receipt**

Receipt format:

```text
B11.1 receipt:
- failed test: <file>::<test>
- context_jobs row: <field summary>
- suspected fault: <lock/heartbeat/abort/cleanup/claim>
- next file boundary: <1-2 files>
```

---

### Task 2: B11 Lifecycle Fix

**Agentmemory Action:** `act_mrqjqs1z_5d95ba71c65d`

**Requires:** `act_mrqjqmnz_6656204ede55`

**Cavecrew Type:** `cavecrew-builder`

**Files:**
- Candidate modify: `src/infrastructure/business-context/job-runner/job-runner.ts`
- Candidate modify: `src/infrastructure/business-context/job-runner/execution.ts`
- Candidate modify: `src/infrastructure/business-context/job-runner/lease.ts`
- Candidate modify: `src/infrastructure/business-context/job-runner/heartbeat.ts`
- Candidate modify: `src/infrastructure/business-context/repository/jobs/job.repository.ts`
- Candidate modify: `tests/integration/business-context/source-processing-worker.helpers.ts`

**Interfaces:**
- Consumes: B11.1 receipt.
- Produces: behavior-preserving fix for stale `locked_by`, heartbeat leak, abort release, cleanup race, or claim filter.

- [ ] **Step 1: Limit edit scope**

Choose max 2 production files plus focused tests from B11.1 evidence.

- [ ] **Step 2: Add or adjust smallest failing test**

Use implicated integration file or existing job-runner unit test. Test must fail before production fix.

- [ ] **Step 3: Implement minimal fix**

Do not refactor worker architecture. Fix only root cause from captured row evidence.

- [ ] **Step 4: Verify implicated test**

```bash
rtk npx vitest run <implicated-test-file>
```

Expected: PASS.

---

### Task 3: B11 Clean Gate Verification

**Agentmemory Action:** `act_mrqjr2wj_c007fd0b2b75`

**Requires:** `act_mrqjqs1z_5d95ba71c65d`

**Cavecrew Type:** `cavecrew-reviewer` or verifier-style `cavecrew-investigator`

**Files:**
- Verify: four source-processing-worker integration files.
- Verify if runner/policy changed: `src/infrastructure/business-context/job-runner/`
- Verify if policy changed: `tests/unit/business-context/job-policy.test.ts`

**Interfaces:**
- Consumes: B11.2 fix.
- Produces: green B11 worker gate and parent-ready receipt.

- [ ] **Step 1: Reset local Supabase if required by repo scripts**

Use existing repo reset command if tests require clean DB. Do not invent migration state.

- [ ] **Step 2: Run normal four-file batch**

```bash
rtk npx vitest run \
  tests/integration/business-context/source-processing-worker.claim-lease.test.ts \
  tests/integration/business-context/source-processing-worker.heartbeat-retry.test.ts \
  tests/integration/business-context/source-processing-worker.duplicate-prevention.test.ts \
  tests/integration/business-context/source-processing-worker.shutdown-recovery.test.ts
```

Expected: PASS.

- [ ] **Step 3: Mark B11 parent done only if gate passes**

Update `act_mrm6ryrc_156705700bcb` with command evidence.

---

### Task 4: B14 Source Registration Auth

**Agentmemory Action:** `act_mrqjr87j_a2adeda3353e`

**Requires:** `act_mrqjr2wj_c007fd0b2b75`

**Cavecrew Type:** `cavecrew-builder`

**Files:**
- Inspect/modify: `tests/e2e/business-context/b14-t020-source-process-worker.e2e.test.ts`
- Inspect/modify: `tests/e2e/business-context/process.ts`
- Inspect/modify: `src/app/api/businesses/_shared.ts`

**Interfaces:**
- Consumes: green B11 gate.
- Produces: B14 register POST no longer fails with `401 UNAUTHENTICATED`.

- [ ] **Step 1: Reproduce exact 401 with strict cleanup**

Run only B14 E2E path with bounded Next/worker startup timeout.

- [ ] **Step 2: Identify cookie/JWT mismatch**

Check `createTestSession` cookie name, signing secret, and `requireAuthz` `getToken({ req, secret })` parsing.

- [ ] **Step 3: Prefer harness fix**

Modify production `_shared.ts` only if helper behavior is wrong for real app auth.

- [ ] **Step 4: Verify register path**

Expected: source registration reaches authorized route instead of `UNAUTHENTICATED`.

---

### Task 5: Lint Baseline Discovery

**Agentmemory Action:** `act_mrqjrgea_c13472fb5bb4`

**Parent:** `act_mrqh46hi_32417657fa9b`

**Cavecrew Type:** `cavecrew-investigator`

**Files:**
- Inspect: `package.json`
- Inspect: `eslint.config.mjs`
- Inspect: `src/api/adClient.ts`
- Inspect: `src/context/AuthContext.tsx`
- Inspect: `src/app/api/optimization/`
- Inspect: `src/core/optimization/`
- Inspect: `src/core/business-context/`
- Inspect: `src/infrastructure/business-context/`

**Interfaces:**
- Consumes: existing lint baseline.
- Produces: top lint buckets by rule/file group.

- [ ] **Step 1: Run compact lint discovery**

```bash
rtk npm run lint
```

Fallback if output too broad:

```bash
rtk npx eslint src/api/adClient.ts src/context/AuthContext.tsx src/app/api/optimization/ src/core/optimization/ src/core/business-context/ src/infrastructure/business-context/
```

- [ ] **Step 2: Bucket failures**

Receipt must include top 5 rule buckets with counts and first file:line examples.

---

### Task 6: Lint Named Hotspots

**Agentmemory Action:** `act_mrqjrl4i_3cf49686639a`

**Requires:** `act_mrqjrgea_c13472fb5bb4`

**Cavecrew Type:** `cavecrew-builder`

**Files:**
- Modify: `src/api/adClient.ts`
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: Lint.1 buckets.
- Produces: named hotspot files lint-clean.

- [ ] **Step 1: Fix behavior-preserving lint issues only**

No auth/client refactor.

- [ ] **Step 2: Verify focused lint**

```bash
rtk npx eslint src/api/adClient.ts src/context/AuthContext.tsx
```

Expected: PASS.

---

### Task 7: Lint Optimization Slice

**Agentmemory Action:** `act_mrqjrqn0_b17887decc8e`

**Requires:** `act_mrqjrgea_c13472fb5bb4`

**Cavecrew Type:** `cavecrew-builder`

**Files:**
- Candidate modify: `src/app/api/optimization/actions/[id]/approve/route.ts`
- Candidate modify: `src/app/api/optimization/actions/[id]/execute/route.ts`
- Candidate modify: `src/app/api/optimization/actions/[id]/reject/route.ts`
- Candidate modify: `src/app/api/optimization/actions/route.ts`
- Candidate modify: `src/app/api/optimization/health/route.ts`
- Candidate modify: `src/app/api/optimization/recommendations/refresh/route.ts`
- Candidate modify: `src/app/api/optimization/recommendations/route.ts`
- Candidate modify: `src/core/optimization/`

**Interfaces:**
- Consumes: Lint.1 buckets.
- Produces: optimization lint slice improved or further split.

- [ ] **Step 1: Split if needed**

If more than 3 files or multiple rule families require edits, create extra child actions before patching.

- [ ] **Step 2: Verify focused lint**

```bash
rtk npx eslint src/app/api/optimization/ src/core/optimization/
```

Expected: PASS or receipt listing residual split actions.

---

### Task 8: Lint Business-Context Slice

**Agentmemory Action:** `act_mrqjs170_8e3cc59cc602`

**Requires:** `act_mrqjrgea_c13472fb5bb4`

**Cavecrew Type:** `cavecrew-builder`

**Files:**
- Candidate modify: `src/core/business-context/`
- Candidate modify: `src/infrastructure/business-context/`

**Interfaces:**
- Consumes: Lint.1 buckets.
- Produces: business-context lint slice improved or further split.

- [ ] **Step 1: Split by rule family**

Hard cap: <=3 files and one lint rule family per sub-slice.

- [ ] **Step 2: Verify affected lint**

```bash
rtk npx eslint src/core/business-context/ src/infrastructure/business-context/
```

Expected: PASS or receipt listing residual split actions.

---

### Task 9: Final Lint Verification

**Agentmemory Action:** `act_mrqjs8hi_86968ddb0e16`

**Requires:** `act_mrqjrl4i_3cf49686639a`, `act_mrqjrqn0_b17887decc8e`, `act_mrqjs170_8e3cc59cc602`

**Cavecrew Type:** `cavecrew-reviewer`

**Files:**
- Verify: repo lint baseline.

**Interfaces:**
- Consumes: lint slice fixes.
- Produces: full lint pass or new child actions for residual buckets.

- [ ] **Step 1: Run full lint**

```bash
rtk npm run lint
```

Expected: PASS.

- [ ] **Step 2: Update parent only if clean**

Mark `act_mrqh46hi_32417657fa9b` done with full lint evidence.

## Self-Review

- Spec coverage: both pending parent actions now have concrete child chains.
- Placeholder scan: no `TBD`, no broad "fix lint" step without commands.
- Type consistency: action IDs and dependency IDs match created agentmemory actions.
