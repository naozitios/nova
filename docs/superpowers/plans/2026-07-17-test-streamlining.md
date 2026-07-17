# Test Streamlining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the test suite into clear lanes, document the rules, and centralize reusable harness helpers without changing tested behavior.

**Architecture:** Use Vitest v4 projects for TypeScript test lanes and keep pytest for the Python worker. Keep DB-backed suites serial while allowing unit and contract suites to run in parallel. Add focused harness modules that wrap existing helpers for backward-compatible migration.

**Tech Stack:** Next.js 16.1.1, TypeScript 5, Vitest 4.1.10, Supabase JS 2.110.4, pytest for `workers/paddleocr`.

## Global Constraints

- Do not change product behavior or test assertions.
- Keep `tests/setup.ts` as shared Vitest setup.
- Unit and contract lanes must not require Supabase.
- Integration, RLS, and E2E lanes may require local Supabase and must run serially.
- Preserve existing exports from `tests/harness/index.ts` so current tests keep compiling.
- Use incremental cleanup only; do not rewrite every test in this pass.

---

### Task 1: Document Testing Taxonomy

**Files:**

- Create: `docs/testing.md`

**Interfaces:**

- Consumes: `docs/superpowers/specs/2026-07-17-test-streamlining-design.md`
- Produces: test lane rules used by config and future migrations.

- [ ] **Step 1: Create docs/testing.md**

Add sections for commands, lanes, file naming, fixtures, environment gates, and migration rules.

- [ ] **Step 2: Verify docs are concrete**

Run: `test -s docs/testing.md`
Expected: exit 0.

---

### Task 2: Split Vitest Lanes And Scripts

**Files:**

- Modify: `vitest.config.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Vitest v4 `test.projects` with `--project` filtering.
- Produces: `test`, `test:unit`, `test:contract`, `test:integration`, `test:rls`, `test:e2e`, `test:all`, and existing specialized scripts.

- [ ] **Step 1: Update package scripts**

Set `test` to run unit and contract projects. Add lane scripts. Keep existing Business Context scripts.

- [ ] **Step 2: Update Vitest config**

Define projects named `unit`, `contract`, `integration`, `rls`, and `e2e`. Keep alias and env loading. Use `fileParallelism: false` only for DB/E2E projects.

- [ ] **Step 3: Verify config parses**

Run: `npm run test:unit -- --runInBand`
Expected: command starts Vitest with project `unit`; failures, if any, should be from tests, not config syntax.

---

### Task 3: Add Focused Harness Modules

**Files:**

- Create: `tests/harness/cleanup.ts`
- Create: `tests/harness/supabase-env.ts`
- Create: `tests/harness/workspace-fixtures.ts`
- Create: `tests/harness/job-fixtures.ts`
- Modify: `tests/harness/index.ts`

**Interfaces:**

- Consumes: existing `tests/harness/supabase-test-env.ts` and `tests/harness/fixtures.ts`.
- Produces: focused helpers for future migrations while preserving current helpers.

- [ ] **Step 1: Add cleanup helper**

Create reverse-order cleanup tracker that accepts table/id pairs and deletes with `getSupabaseTestEnv().serviceClient`.

- [ ] **Step 2: Add Supabase env wrapper**

Create named exports for setup guidance and client access using existing `getSupabaseTestEnv()`.

- [ ] **Step 3: Add workspace fixture wrapper**

Re-export current workspace constants and seed helpers from focused module.

- [ ] **Step 4: Add job fixture helper**

Add `createContextJob`, `readContextJob`, and `trackContextJob` helpers with valid defaults.

- [ ] **Step 5: Export focused modules**

Update `tests/harness/index.ts` to export new modules.

---

### Task 4: Verify And Review

**Files:**

- Review all changed files.

**Interfaces:**

- Consumes: Tasks 1-3.
- Produces: verified test-streamlining foundation.

- [ ] **Step 1: Run fast lane verification**

Run: `npm run test:unit`
Expected: Vitest runs `unit` project.

- [ ] **Step 2: Run contract lane verification**

Run: `npm run test:contract`
Expected: Vitest runs `contract` project.

- [ ] **Step 3: Run diagnostics**

Run repository diagnostics/type checks available in current toolchain.

- [ ] **Step 4: Review diff**

Check for broken scripts, overlapping test globs, and exports that could break existing imports.
