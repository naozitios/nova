# 008B Meta Hierarchy Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist account/campaign/ad set/ad/creative hierarchy from selected Meta ad accounts with resumable sync runs, checkpoints, and quarantine.

**Architecture:** Build on 008A connection/account foundation. Add canonical tables, sync policies, provider contract registry, repository writes, and a worker handler that partitions hierarchy sync by object type.

**Tech Stack:** TypeScript, Vitest, Supabase Postgres/RLS, Meta Marketing API, existing worker/job conventions.

## Global Constraints

- Requires 008A completed and selected business-bound Meta ad account available.
- Sync reads only; no Meta write/mutation action.
- Canonical rows use stable Meta IDs and upsert semantics.
- Failed partitions do not rerun completed partitions.
- Invalid provider records are quarantined and do not poison canonical tables.
- Sync state must be visible and resumable.

---

## File Structure

- Create `src/core/meta-data/data-contract-registry.ts`: hierarchy endpoint/field registry.
- Create `src/core/meta-data/sync-policy.ts`: sync states, partitions, retry policy.
- Modify `src/core/meta-data/entities.ts`: hierarchy object and sync types.
- Modify `src/core/meta-data/repository.port.ts`: hierarchy/sync methods.
- Modify `src/infrastructure/meta/meta-api.adapter.ts`: paginated campaign/adset/ad/creative reads.
- Modify `src/infrastructure/meta/supabase-meta.repository.ts`: canonical upserts/checkpoints/quarantine.
- Create `src/workers/meta-sync/hierarchy-handler.ts`: hierarchy sync worker handler.
- Create routes `src/app/api/meta/sync/route.ts`, `src/app/api/meta/sync/[runId]/route.ts`, `src/app/api/meta/sync/[runId]/retry/route.ts` or migrate existing routes.
- Add migration `supabase/migrations/202607180002_meta_hierarchy_sync.sql`.
- Add tests under `tests/unit/meta-data`, `tests/integration/meta-data`, `tests/contract/meta-data`.

## Task 1: Hierarchy Schema

**Files:**
- Create: `supabase/migrations/202607180002_meta_hierarchy_sync.sql`
- Test: `tests/integration/meta-data/meta-hierarchy-schema.test.ts`
- Test: `tests/rls/meta-data/meta-hierarchy-rls.test.ts`

**Interfaces:**
- Produces tables: `meta_campaigns`, `meta_ad_sets`, `meta_ads`, `meta_creatives`, `meta_sync_runs`, `meta_sync_checkpoints`, `meta_sync_attempts`, `meta_quarantined_records`.

- [ ] **Step 1: Write schema tests**

Assert each table exists, has `workspace_id`, provider IDs, parent IDs where applicable, `raw_metadata_json`, `meta_sync_run_id`, `first_seen_at`, `last_seen_at`, and unique indexes by workspace/account/provider ID.

- [ ] **Step 2: Write RLS tests**

Assert workspace members can read canonical hierarchy rows in their workspace but cannot write. Assert service role can write sync/checkpoint/quarantine rows.

- [ ] **Step 3: Run failing tests**

Run: `npm run test:integration -- tests/integration/meta-data/meta-hierarchy-schema.test.ts`

Expected: FAIL because tables do not exist.

- [ ] **Step 4: Add migration**

Create tables with stable unique indexes:

```sql
create table public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text not null,
  name text not null,
  objective text,
  effective_status text,
  configured_status text,
  buying_type text,
  start_time timestamptz,
  stop_time timestamptz,
  provider_created_time timestamptz,
  provider_updated_time timestamptz,
  raw_metadata_json jsonb not null default '{}',
  meta_sync_run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, meta_ad_account_id, meta_campaign_id)
);
```

Add equivalent `meta_ad_sets`, `meta_ads`, `meta_creatives`, sync run/checkpoint/attempt/quarantine tables. Enable RLS and service-role write policies, member read policies.

- [ ] **Step 5: Verify**

Run: `npm run supabase:reset`

Run: `npm run test:integration -- tests/integration/meta-data/meta-hierarchy-schema.test.ts`

Run: `npm run test:rls -- tests/rls/meta-data/meta-hierarchy-rls.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations tests/integration/meta-data/meta-hierarchy-schema.test.ts tests/rls/meta-data/meta-hierarchy-rls.test.ts && git commit -m "feat: add Meta hierarchy sync schema"`

## Task 2: Data Contract Registry

**Files:**
- Create: `src/core/meta-data/data-contract-registry.ts`
- Test: `tests/unit/meta-data/data-contract-registry.test.ts`

**Interfaces:**
- Produces: `META_DATA_CONTRACTS`
- Produces: `getMetaContractsForObject(objectType: MetaContractObjectType)`

- [ ] **Step 1: Write tests**

Assert registry includes campaigns, ad sets, ads, creatives with contract ID, version, endpoint, fields, required permissions, grain, and validation keys.

- [ ] **Step 2: Implement registry**

Define read contracts for:

- `account.campaigns`: `id,name,objective,effective_status,configured_status,buying_type,start_time,stop_time,created_time,updated_time`
- `account.adsets`: `id,campaign_id,name,optimization_goal,billing_event,effective_status,configured_status,daily_budget,lifetime_budget,start_time,end_time,created_time,updated_time`
- `account.ads`: `id,campaign_id,adset_id,name,effective_status,configured_status,creative{id},created_time,updated_time`
- `account.creatives`: `id,name,title,body,object_story_spec,asset_feed_spec,thumbnail_url,image_url,video_id,effective_object_story_id`

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/data-contract-registry.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/data-contract-registry.ts tests/unit/meta-data/data-contract-registry.test.ts && git commit -m "feat: add Meta hierarchy data contracts"`

## Task 3: Sync Policy And Partitioning

**Files:**
- Create: `src/core/meta-data/sync-policy.ts`
- Test: `tests/unit/meta-data/sync-policy.test.ts`

**Interfaces:**
- Produces: `buildHierarchyPartitions(accountId: string): MetaSyncPartition[]`
- Produces: `classifyMetaSyncError(error): 'retryable' | 'permission' | 'auth' | 'schema' | 'permanent'`

- [ ] **Step 1: Write tests**

Assert partition order is campaigns, ad_sets, ads, creatives. Assert 429/5xx/network are retryable; 401 is auth; 403 is permission; validation failure is schema.

- [ ] **Step 2: Implement policy**

Create focused pure functions only. No Supabase or fetch imports.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/sync-policy.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/sync-policy.ts tests/unit/meta-data/sync-policy.test.ts && git commit -m "feat: add Meta hierarchy sync policy"`

## Task 4: Meta API Hierarchy Reads

**Files:**
- Modify: `src/infrastructure/meta/meta-api.adapter.ts`
- Test: `tests/unit/meta-data/meta-api-hierarchy.test.ts`

**Interfaces:**
- Produces: `getCampaignsPage`, `getAdSetsPage`, `getAdsPage`, `getCreativesPage` or equivalent paginated methods returning `{ data, nextPageUrl }`.

- [ ] **Step 1: Write fixture tests**

Mock `fetch`. Assert adapter sends expected endpoint/fields, follows paging cursor/url, and returns provider errors with status and safe message.

- [ ] **Step 2: Implement methods**

Keep existing methods compatible. Add new paginated methods used by sync worker.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/meta-api-hierarchy.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/infrastructure/meta/meta-api.adapter.ts tests/unit/meta-data/meta-api-hierarchy.test.ts && git commit -m "feat: add Meta hierarchy API reads"`

## Task 5: Repository Upserts And Quarantine

**Files:**
- Modify: `src/core/meta-data/repository.port.ts`
- Modify: `src/infrastructure/meta/supabase-meta.repository.ts`
- Test: `tests/integration/meta-data/meta-hierarchy-repository.test.ts`

**Interfaces:**
- Produces: `createSyncRun`, `claimSyncRun`, `upsertCampaigns`, `upsertAdSets`, `upsertAds`, `upsertCreatives`, `advanceCheckpoint`, `quarantineRecords`.

- [ ] **Step 1: Write integration tests**

Seed workspace/account. Assert upsert updates existing campaign not duplicate. Assert ad with missing ad set is quarantined. Assert checkpoint is advanced after write.

- [ ] **Step 2: Implement repository methods**

Use service client. Map Meta payloads to canonical columns. Store redacted invalid payload in quarantine.

- [ ] **Step 3: Verify**

Run: `npm run test:integration -- tests/integration/meta-data/meta-hierarchy-repository.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/repository.port.ts src/infrastructure/meta/supabase-meta.repository.ts tests/integration/meta-data/meta-hierarchy-repository.test.ts && git commit -m "feat: persist Meta hierarchy sync data"`

## Task 6: Hierarchy Sync Worker Handler

**Files:**
- Create: `src/workers/meta-sync/hierarchy-handler.ts`
- Test: `tests/unit/meta-data/hierarchy-handler.test.ts`

**Interfaces:**
- Produces: `runHierarchySync(input: { runId: string }): Promise<ServiceResult<void>>`

- [ ] **Step 1: Write worker tests**

Use fake repository/API. Assert partitions run in order, completed checkpoints skip on retry, retryable provider error schedules retry, schema-invalid record quarantines and continues.

- [ ] **Step 2: Implement worker handler**

No route logic. Handler loads sync run, decrypts token via repository/vault boundary, executes partitions, writes attempts/checkpoints.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/hierarchy-handler.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/workers/meta-sync/hierarchy-handler.ts tests/unit/meta-data/hierarchy-handler.test.ts && git commit -m "feat: add Meta hierarchy sync worker"`

## Task 7: Sync API Routes

**Files:**
- Create/modify: `src/app/api/meta/sync/route.ts`
- Create/modify: `src/app/api/meta/sync/[runId]/route.ts`
- Create: `src/app/api/meta/sync/[runId]/retry/route.ts`
- Test: `tests/contract/meta-data/meta-sync-routes.test.ts`

**Interfaces:**
- Produces `POST /api/meta/sync` body `{ workspace_id, business_id, mode: 'initial_backfill' | 'manual_refresh' }`.
- Produces `GET /api/meta/sync/:runId` progress response.
- Produces `POST /api/meta/sync/:runId/retry`.

- [ ] **Step 1: Write contract tests**

Assert route requires editor for POST/retry, member for GET, uses idempotency for POST/retry, rejects missing selected account, returns sanitized errors.

- [ ] **Step 2: Implement routes**

Routes enqueue sync run only. Do not hold request open for full sync.

- [ ] **Step 3: Verify**

Run: `npm run test:contract -- tests/contract/meta-data/meta-sync-routes.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/app/api/meta/sync tests/contract/meta-data/meta-sync-routes.test.ts && git commit -m "feat: add Meta hierarchy sync routes"`

## Final Verification

- [ ] Run `npm run test:unit -- tests/unit/meta-data`.
- [ ] Run `npm run test:contract -- tests/contract/meta-data`.
- [ ] Run `npm run test:integration -- tests/integration/meta-data`.
- [ ] Run `npm run test:rls -- tests/rls/meta-data`.
- [ ] Run `npm run build`.
