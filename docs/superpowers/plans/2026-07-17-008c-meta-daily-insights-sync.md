# 008C Meta Daily Insights Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill and incrementally refresh daily ad-level Meta insights with real reporting dates, freshness visibility, and safe retry/checkpoint behavior.

**Architecture:** Build on 008A selected account and 008B sync infrastructure. Add insight schema, date window partitioning, Meta insights adapter reads, repository upserts, freshness calculations, and query APIs.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres/RLS, Meta Marketing API insights endpoint.

## Global Constraints

- Requires 008A and 008B completed.
- Store Meta `date_start` and `date_stop`; never use ingestion date as reporting date.
- Preserve raw `actions` and `action_values` arrays.
- Do not convert missing metrics to zero unless contract explicitly says zero.
- Initial backfill defaults to 90 complete days.
- Incremental sync refreshes recent restatement window.

---

## File Structure

- Add migration `supabase/migrations/202607180003_meta_daily_insights.sql`.
- Modify `src/core/meta-data/data-contract-registry.ts`: insights contract.
- Modify `src/core/meta-data/sync-policy.ts`: date windows and restatement policy.
- Modify `src/infrastructure/meta/meta-api.adapter.ts`: paginated insights read.
- Modify `src/infrastructure/meta/supabase-meta.repository.ts`: insight upserts/freshness reads.
- Create `src/workers/meta-sync/insights-handler.ts`.
- Create routes `src/app/api/meta/insights/route.ts`, `src/app/api/meta/data-freshness/route.ts`.
- Add tests under `tests/unit/meta-data`, `tests/integration/meta-data`, `tests/contract/meta-data`.

## Task 1: Insights Schema

**Files:**
- Create: `supabase/migrations/202607180003_meta_daily_insights.sql`
- Test: `tests/integration/meta-data/meta-insights-schema.test.ts`

**Interfaces:**
- Produces table: `meta_insights_daily`
- Produces supporting indexes for account/date/ad queries.

- [ ] **Step 1: Write schema test**

Assert table has `workspace_id`, `meta_ad_account_id`, `meta_campaign_id`, `meta_ad_set_id`, `meta_ad_id`, `date_start`, `date_stop`, `spend`, `impressions`, `reach`, `clicks`, `actions`, `action_values`, `attribution_setting`, `currency`, `account_timezone`, `data_completeness_state`, `meta_sync_run_id`, `api_version`.

- [ ] **Step 2: Run failing test**

Run: `npm run test:integration -- tests/integration/meta-data/meta-insights-schema.test.ts`

Expected: FAIL because table does not exist.

- [ ] **Step 3: Add migration**

Create `meta_insights_daily` with exact numeric fields, JSONB action arrays, and unique index on `(workspace_id, meta_ad_account_id, meta_ad_id, date_start, date_stop, attribution_setting, api_version)`.

- [ ] **Step 4: Verify**

Run: `npm run supabase:reset`

Run: `npm run test:integration -- tests/integration/meta-data/meta-insights-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add supabase/migrations tests/integration/meta-data/meta-insights-schema.test.ts && git commit -m "feat: add Meta daily insights schema"`

## Task 2: Date Window Policy

**Files:**
- Modify: `src/core/meta-data/sync-policy.ts`
- Test: `tests/unit/meta-data/insights-window-policy.test.ts`

**Interfaces:**
- Produces: `buildInitialInsightWindows(today: string, days = 90): DateWindow[]`
- Produces: `buildIncrementalInsightWindows(today: string, lookbackDays = 7): DateWindow[]`

- [ ] **Step 1: Write tests**

Assert initial excludes current incomplete day and returns 90 single-day windows. Assert incremental returns recent complete days only.

- [ ] **Step 2: Implement pure functions**

Use UTC ISO date strings; do not read system clock inside pure functions.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/insights-window-policy.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/sync-policy.ts tests/unit/meta-data/insights-window-policy.test.ts && git commit -m "feat: add Meta insight window policy"`

## Task 3: Insights Contract Registry

**Files:**
- Modify: `src/core/meta-data/data-contract-registry.ts`
- Test: `tests/unit/meta-data/insights-contract.test.ts`

**Interfaces:**
- Adds contract `insights.ad_daily.v1`.

- [ ] **Step 1: Write test**

Assert fields include `date_start,date_stop,campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,actions,action_values` and grain is `ad_daily`.

- [ ] **Step 2: Implement contract**

Add permission requirement `ads_read`, endpoint `/{ad_account_id}/insights`, level `ad`, and cadence `initial_backfill,incremental`.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/insights-contract.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/data-contract-registry.ts tests/unit/meta-data/insights-contract.test.ts && git commit -m "feat: register Meta daily insights contract"`

## Task 4: Meta API Insights Read

**Files:**
- Modify: `src/infrastructure/meta/meta-api.adapter.ts`
- Test: `tests/unit/meta-data/meta-api-insights.test.ts`

**Interfaces:**
- Produces: `getDailyAdInsightsPage(accountId, window, accessToken, after?)`.

- [ ] **Step 1: Write fetch tests**

Mock response with `date_start` from provider. Assert adapter preserves date fields and raw actions/action_values.

- [ ] **Step 2: Implement paginated read**

Request level `ad`, date range, fields from contract, and return next cursor/url.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/meta-api-insights.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/infrastructure/meta/meta-api.adapter.ts tests/unit/meta-data/meta-api-insights.test.ts && git commit -m "feat: add Meta insights API read"`

## Task 5: Insights Repository Upsert And Freshness

**Files:**
- Modify: `src/core/meta-data/repository.port.ts`
- Modify: `src/infrastructure/meta/supabase-meta.repository.ts`
- Test: `tests/integration/meta-data/meta-insights-repository.test.ts`

**Interfaces:**
- Produces: `upsertDailyInsights`, `getDataFreshness`, `listDailyInsights`.

- [ ] **Step 1: Write integration tests**

Assert duplicate insight upsert updates row, missing `date_start` quarantines, freshness returns latest successful date and missing windows.

- [ ] **Step 2: Implement repository methods**

Map numeric strings to decimal-safe strings/numbers matching schema. Keep raw action arrays as JSONB.

- [ ] **Step 3: Verify**

Run: `npm run test:integration -- tests/integration/meta-data/meta-insights-repository.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/repository.port.ts src/infrastructure/meta/supabase-meta.repository.ts tests/integration/meta-data/meta-insights-repository.test.ts && git commit -m "feat: persist Meta daily insights"`

## Task 6: Insights Sync Worker

**Files:**
- Create: `src/workers/meta-sync/insights-handler.ts`
- Test: `tests/unit/meta-data/insights-handler.test.ts`

**Interfaces:**
- Produces: `runInsightsSync(input: { runId: string }): Promise<ServiceResult<void>>`.

- [ ] **Step 1: Write worker tests**

Assert initial run creates 90 complete date partitions, completed windows skip on retry, provider 429 schedules retry, invalid records quarantine and do not block valid windows.

- [ ] **Step 2: Implement worker**

Reuse 008B sync run/checkpoint/attempt conventions. Process bounded date windows.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/insights-handler.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/workers/meta-sync/insights-handler.ts tests/unit/meta-data/insights-handler.test.ts && git commit -m "feat: add Meta insights sync worker"`

## Task 7: Insights And Freshness APIs

**Files:**
- Create: `src/app/api/meta/insights/route.ts`
- Create: `src/app/api/meta/data-freshness/route.ts`
- Test: `tests/contract/meta-data/meta-insights-routes.test.ts`

**Interfaces:**
- Produces `GET /api/meta/insights?workspace_id=&business_id=&since=&until=`.
- Produces `GET /api/meta/data-freshness?workspace_id=&business_id=`.

- [ ] **Step 1: Write route tests**

Assert member auth required, cross-workspace rejected, responses contain no token/raw provider errors, freshness includes latest date and gap count.

- [ ] **Step 2: Implement routes**

Read selected account for business, then query stored insights/freshness. Do not fetch live Meta in route.

- [ ] **Step 3: Verify**

Run: `npm run test:contract -- tests/contract/meta-data/meta-insights-routes.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/app/api/meta/insights src/app/api/meta/data-freshness tests/contract/meta-data/meta-insights-routes.test.ts && git commit -m "feat: expose Meta insights freshness APIs"`

## Final Verification

- [ ] Run `npm run test:unit -- tests/unit/meta-data`.
- [ ] Run `npm run test:integration -- tests/integration/meta-data`.
- [ ] Run `npm run test:contract -- tests/contract/meta-data`.
- [ ] Run `npm run build`.
