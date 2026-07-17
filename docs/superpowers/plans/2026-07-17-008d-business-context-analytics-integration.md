# 008D Business Context And Analytics Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use stored PRD 008 Meta data as Business Context evidence and migrate analytics routes away from live/mock Meta fallbacks.

**Architecture:** Business Context keeps ownership of synthesis/reconciliation. PRD 008 supplies selected-account Meta evidence documents from Supabase. Analytics reads stored canonical/insight tables only.

**Tech Stack:** TypeScript, Vitest, Supabase repositories, existing Business Context source processing, Next.js API routes.

## Global Constraints

- Requires 008A, 008B, and 008C completed.
- Meta evidence never silently becomes approved Business Context truth.
- `source_type = meta` reads stored Supabase Meta data, not `.env` tokens or live one-off API calls.
- Final Business Context records Meta account, sync run/data window, and freshness used.
- No mock analytics success for connected businesses.

---

## File Structure

- Modify `src/infrastructure/business-context/meta/meta-adapter.ts`: read stored Meta data instead of env token fallback.
- Create `src/infrastructure/business-context/meta/meta-evidence.builder.ts`: convert stored Meta objects/insights into source documents.
- Modify `src/di/providers/business-context.ts`: inject Meta data repository/query service into adapter.
- Modify Business Context source registration/process routes only if needed for selected-account metadata.
- Modify `src/app/api/analytics/route.ts` and `src/app/api/analytics/timeseries/route.ts` or current analytics routes.
- Add tests under `tests/unit/business-context`, `tests/integration/business-context`, `tests/contract/meta-data`.

## Task 1: Meta Evidence Builder

**Files:**
- Create: `src/infrastructure/business-context/meta/meta-evidence.builder.ts`
- Test: `tests/unit/business-context/meta-evidence-builder.test.ts`

**Interfaces:**
- Produces: `buildMetaEvidenceDocuments(input: StoredMetaEvidenceInput): CollectedSource['documents']`.

- [ ] **Step 1: Write tests**

Assert builder creates documents for campaign objectives, active ads/creative copy, spend ranges, optimization/conversion fields, and includes account ID/data window metadata.

- [ ] **Step 2: Implement builder**

Input is plain objects from repository, output is Business Context `CollectedSource` documents with `mimeType: 'application/json'` and human-readable `contentText`.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/business-context/meta-evidence-builder.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/infrastructure/business-context/meta/meta-evidence.builder.ts tests/unit/business-context/meta-evidence-builder.test.ts && git commit -m "feat: build Meta evidence documents"`

## Task 2: Stored Meta Source Adapter

**Files:**
- Modify: `src/infrastructure/business-context/meta/meta-adapter.ts`
- Modify: `src/di/providers/business-context.ts`
- Test: `tests/integration/business-context/meta-source-stored-data.test.ts`

**Interfaces:**
- Consumes selected account and stored hierarchy/insight query methods from PRD 008 repositories.
- Produces Business Context `CollectedSource` for `source_type = meta`.

- [ ] **Step 1: Write integration test**

Seed selected Meta account, campaign, ad, creative, and insights. Register/process `source_type = meta`. Assert documents are created from stored data and no `META_ACCESS_TOKEN` env is required.

- [ ] **Step 2: Implement adapter change**

Remove env token/account fallback for Business Context processing. Adapter returns `NO_SELECTED_META_ACCOUNT` when business lacks selected account, and `META_DATA_NOT_SYNCED` when account exists but no synced data.

- [ ] **Step 3: Verify**

Run: `npm run test:integration -- tests/integration/business-context/meta-source-stored-data.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/infrastructure/business-context/meta/meta-adapter.ts src/di/providers/business-context.ts tests/integration/business-context/meta-source-stored-data.test.ts && git commit -m "feat: source Business Context Meta evidence from stored data"`

## Task 3: Context Provenance

**Files:**
- Modify: Business Context compiler/profile version code under `src/core/business-context`.
- Test: `tests/unit/business-context/meta-provenance.test.ts`

**Interfaces:**
- Produces profile/source metadata fields containing selected Meta account, sync run ID, and data window.

- [ ] **Step 1: Write test**

Assert compiled context includes Meta evidence provenance when Meta source documents exist, and omits it when no Meta source is present.

- [ ] **Step 2: Implement minimal provenance mapping**

Use source document metadata from Task 1. Do not add new truth fields beyond provenance/evidence references.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/business-context/meta-provenance.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/business-context tests/unit/business-context/meta-provenance.test.ts && git commit -m "feat: include Meta evidence provenance in context"`

## Task 4: Conflict Behavior Guard

**Files:**
- Test: `tests/integration/business-context/meta-conflict-reconciliation.test.ts`
- Modify: reconciliation/extraction glue only if test exposes silent overwrite.

**Interfaces:**
- Conflicting Meta facts must produce unresolved conflict/question instead of overwriting website/manual facts.

- [ ] **Step 1: Write integration test**

Seed website/manual fact `offer.discount = 20%`. Process Meta evidence saying `offer.discount = 50%`. Assert both facts remain and a conflict/question exists.

- [ ] **Step 2: Implement minimal fix if needed**

If existing reconciliation already passes, commit test only. If not, adjust fact reconciliation source-authority handling so Meta is evidence source, not automatic winner.

- [ ] **Step 3: Verify**

Run: `npm run test:integration -- tests/integration/business-context/meta-conflict-reconciliation.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add tests/integration/business-context/meta-conflict-reconciliation.test.ts src/core/business-context && git commit -m "test: guard Meta evidence conflict handling"`

## Task 5: Analytics Query Service

**Files:**
- Create: `src/core/meta-data/analytics-query.service.ts`
- Modify: `src/core/meta-data/repository.port.ts`
- Modify: `src/infrastructure/meta/supabase-meta.repository.ts`
- Test: `tests/unit/meta-data/analytics-query.service.test.ts`

**Interfaces:**
- Produces: `getStoredAnalyticsSummary(input): Promise<ServiceResult<AnalyticsSummary>>`
- Produces: `getStoredTimeseries(input): Promise<ServiceResult<AnalyticsTimeseriesPoint[]>>`

- [ ] **Step 1: Write unit tests**

Use fake repository rows. Assert summary totals spend/clicks/impressions from stored insights and returns `NOT_SYNCED` when no selected account or no insight rows.

- [ ] **Step 2: Implement service**

Pure aggregation over repository-returned rows. No fetch, no Meta adapter, no mock fallback.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/analytics-query.service.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/analytics-query.service.ts src/core/meta-data/repository.port.ts src/infrastructure/meta/supabase-meta.repository.ts tests/unit/meta-data/analytics-query.service.test.ts && git commit -m "feat: query stored Meta analytics"`

## Task 6: Analytics Route Migration

**Files:**
- Modify: `src/app/api/analytics/route.ts`
- Modify: `src/app/api/analytics/timeseries/route.ts` if present.
- Test: `tests/contract/meta-data/analytics-routes-stored-meta.test.ts`

**Interfaces:**
- Existing analytics clients receive stored-data response or clear not-synced error/state.

- [ ] **Step 1: Write route tests**

Assert routes do not import/use `MetaApiAdapter` directly, do not read `META_ACCESS_TOKEN`/`META_AD_ACCOUNT_ID`, and do not return mock success for connected business without synced data.

- [ ] **Step 2: Implement route migration**

Routes resolve workspace/business auth, call stored analytics service, and return `409 NOT_SYNCED` or compatible empty state with actionable message when no data exists.

- [ ] **Step 3: Verify**

Run: `npm run test:contract -- tests/contract/meta-data/analytics-routes-stored-meta.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/app/api/analytics tests/contract/meta-data/analytics-routes-stored-meta.test.ts && git commit -m "refactor: read analytics from stored Meta data"`

## Task 7: End-To-End Meta Evidence Smoke

**Files:**
- Create: `tests/e2e/business-context/meta-evidence-flow.e2e.test.ts`

**Interfaces:**
- Verifies selected account -> synced stored data -> Meta source -> context draft provenance.

- [ ] **Step 1: Write e2e test with seeded data**

Use Supabase fixtures, not live Meta. Create workspace/business, selected Meta account, synced campaign/ad/creative/insight rows, register Meta source, process source, compile draft, assert draft references Meta source provenance.

- [ ] **Step 2: Run failing test and fix wiring**

Run: `npm run test:e2e -- tests/e2e/business-context/meta-evidence-flow.e2e.test.ts`

Expected before fixes: FAIL at first missing integration point. Fix only wiring needed for seeded flow.

- [ ] **Step 3: Verify pass**

Run: `npm run test:e2e -- tests/e2e/business-context/meta-evidence-flow.e2e.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add tests/e2e/business-context/meta-evidence-flow.e2e.test.ts src && git commit -m "test: cover Meta evidence context flow"`

## Final Verification

- [ ] Run `npm run test:unit -- tests/unit/business-context tests/unit/meta-data`.
- [ ] Run `npm run test:integration -- tests/integration/business-context tests/integration/meta-data`.
- [ ] Run `npm run test:contract -- tests/contract/meta-data`.
- [ ] Run `npm run test:e2e -- tests/e2e/business-context/meta-evidence-flow.e2e.test.ts`.
- [ ] Run `npm run build`.
