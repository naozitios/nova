# PRD 008 Meta Data Foundation Design

Date: 2026-07-17

## Purpose

Build NOVA's reliable Meta data foundation: secure workspace-scoped Meta connection, explicit ad account selection, durable Supabase-backed Meta data sync, freshness/status visibility, and Business Context evidence integration.

PRD 008 does not diagnose performance or recommend actions. It makes Meta data trustworthy enough for later PRDs to use.

## Scope Decision

Ship Meta account data foundation first. Defer website measurement verification to a later phase.

Included now:

- Secure Meta OAuth connection and reconnect/disconnect lifecycle.
- Server-side encrypted token storage.
- Explicit Meta ad account selection for a NOVA business.
- Capability discovery for required read endpoints and permissions.
- Durable hierarchy sync: ad account, campaigns, ad sets, ads, creatives.
- Durable daily ad-level insights sync with real Meta reporting dates.
- Sync runs, checkpoints, attempts, retries, quarantine, and freshness APIs.
- Business Context integration through `source_type = meta`.
- Migration of prototype/mock analytics paths to stored Supabase Meta data.

Deferred:

- Browser-based Pixel checks.
- UTM/redirect retention checks.
- Consent/event firing checks.
- Website measurement run UI and worker.

## Existing Baseline

Current repository already has useful pieces:

- `MetaOAuthAdapter` and `MetaApiAdapter` under `src/infrastructure/meta`.
- Prototype routes under `src/app/api/meta/**`.
- Business Context `source_type = meta` support.
- `MetaSourceAdapter` that can collect campaign/ad set/ad/ad creative style evidence.
- Supabase-backed Business Context patterns from PRD 006.

Current gaps:

- OAuth state/callback flow is mismatched and prototype-level.
- Tokens can be cookie-based in old routes and are not yet a production connection model.
- Meta source processing falls back to environment token/account instead of business-selected connection.
- Ad account selection is not validated against accessible accounts.
- Durable campaign/ad set/ad/ad creative/insight tables do not exist.
- Sync progress, checkpoints, retries, freshness, and quarantine are missing.
- Analytics routes may still fetch live Meta or return mock data.

## Architecture

### Core

Add `src/core/meta-data/` for provider-independent rules and contracts:

- `entities.ts`: connection, account, sync run, checkpoint, capability, canonical object, insight, freshness shapes.
- `ports.ts`: repository, OAuth, Meta API, token vault, sync worker ports.
- `data-contract-registry.ts`: versioned list of required Meta endpoints, fields, permissions, grains, cadence, and validation rules.
- `sync-policy.ts`: sync modes, partitioning, retry classification, freshness rules.
- `services.ts`: orchestration for OAuth completion, account selection, capability discovery, sync enqueue/retry, freshness reads.

Core must not import Next.js, Supabase, Meta SDKs, or browser APIs.

### Infrastructure

Extend existing infrastructure instead of creating a parallel provider stack:

- Expand `src/infrastructure/meta/meta-oauth.adapter.ts` for OAuth URL/token exchange/verification.
- Expand `src/infrastructure/meta/meta-api.adapter.ts` for paginated reads and typed endpoint wrappers.
- Add Supabase Meta repository under `src/infrastructure/meta/`.
- Add token vault/encryption boundary under `src/infrastructure/meta/token-vault.ts`.
- Add sync worker under `src/workers/meta-sync/` or equivalent existing worker pattern.

### API

Target routes:

- `POST /api/meta/oauth/start`
- `GET /api/meta/oauth/callback`
- `GET /api/meta/connections`
- `DELETE /api/meta/connections/:connectionId`
- `GET /api/meta/ad-accounts`
- `POST /api/meta/ad-accounts/:accountId/select`
- `GET /api/meta/capabilities`
- `POST /api/meta/sync`
- `GET /api/meta/sync/:runId`
- `POST /api/meta/sync/:runId/retry`
- `GET /api/meta/data-freshness`
- `GET /api/meta/objects`
- `GET /api/meta/insights`

All routes resolve authenticated workspace membership server-side. Browser-supplied workspace/business IDs are treated as selectors, not proof of authorisation.

## Data Model

All tenant-owned tables include `workspace_id`, UUID primary keys, timestamps, RLS, and workspace membership policies.

Required tables:

- `meta_connections`: OAuth identity, status, encrypted token reference/ciphertext, granted scopes, expiry, verification state.
- `meta_oauth_states`: short-lived single-use OAuth states bound to user, workspace, return path, and nonce hash.
- `meta_ad_accounts`: accessible/selected accounts, business association, timezone, currency, provider metadata.
- `meta_api_capabilities`: per connection/account/contract capability result.
- `meta_campaigns`: canonical campaign metadata.
- `meta_ad_sets`: canonical ad set metadata with campaign parent.
- `meta_ads`: canonical ad metadata with ad set/campaign parents.
- `meta_creatives`: canonical creative metadata and safe asset references.
- `meta_insights_daily`: daily ad-grain metrics and raw action/action value arrays.
- `meta_sync_runs`: requested sync state, lease, progress, outcome.
- `meta_sync_checkpoints`: partition cursor/date/object progress.
- `meta_sync_attempts`: append-only attempt timing, error/retry decisions.
- `meta_quarantined_records`: invalid/redacted provider payloads and validation errors.

Important constraints:

- One active selected Meta ad account per business unless later tenancy decision permits sharing.
- Stable provider natural keys prevent duplicate canonical rows.
- Daily insight uniqueness includes account, ad, reporting date, attribution setting, and API version where needed.
- Token ciphertext and raw sensitive provider errors are never browser-readable.

## Sync Design

### Modes

- `capability_discovery`: checks required endpoints/fields/scopes/assets.
- `initial_backfill`: hierarchy plus default 90 complete days of daily insights.
- `incremental`: changed objects plus recent restatement window.
- `manual_refresh`: user-triggered incremental run.
- `repair`: retry explicit failed partition/date window.

### Partitioning

Partition by account, object type, endpoint/capability family, and bounded date window. A failed insight partition must not force completed hierarchy or creative partitions to rerun.

### Reliability

- Runs are queued, leased, heartbeated, and reclaimable.
- Checkpoints advance only after corresponding data writes where practical.
- Retries use exponential backoff and respect provider rate-limit signals when available.
- Auth/permission/schema failures do not retry indefinitely.
- Invalid records are quarantined; valid partitions can still succeed.

## Quality Rules

Validate before canonical writes:

- Required IDs and parent relationships exist.
- Reporting dates come from Meta `date_start` / `date_stop`, never ingestion date.
- `date_start <= date_stop`.
- Currency/timezone are consistent for account.
- Counts and monetary metrics obey contract rules.
- Missing fields are explicit states, not fake zeroes.
- Duplicate natural keys are rejected or safely upserted.
- Orphaned ad sets/ads are quarantined.
- Provider schema drift fails the affected contract instead of silently dropping fields.

Capability states:

- `available`
- `empty`
- `permission_blocked`
- `asset_missing`
- `unsupported`
- `provider_error`

Observability states for future tracking evidence remain aligned with PRD 008, but browser measurement is deferred.

## Business Context Integration

PRD 008 integrates with Business Context through the existing `source_type = meta` path.

Behavior:

- When a business has a selected Meta ad account, Business Context can register/process a Meta source.
- Meta source processing reads stored PRD 008 Supabase data, not `.env` tokens or live one-off API calls.
- The source creates normalized evidence documents from selected account data:
  - campaign objectives and names,
  - promoted offers/products inferred from ads,
  - creative copy/themes,
  - optimization/conversion events,
  - spend/budget ranges and active/inactive status,
  - data window and freshness metadata.
- Business Context extraction/reconciliation treats Meta as evidence, not final truth.
- Conflicts between Meta, website, documents, and user answers generate questions or unresolved facts; Meta does not silently overwrite approved Business Context.
- Published Business Context records which Meta account, sync run, and data window influenced synthesis.

## Delivery Roadmap

### Phase 0: Spec And Contract

Create PRD 008 spec artifacts and API/data contracts. Explicitly defer website measurement verification.

Exit gate:

- Spec and roadmap approved.
- API list, table list, and Business Context integration boundary documented.

### Phase 1: Supabase Schema

Add migrations, RLS, indexes, seed fixtures, generated types, and repository contract tests for Meta tables.

Exit gate:

- `supabase db reset` applies cleanly.
- RLS allows same-workspace access and blocks cross-workspace access.
- Token fields are not readable by browser policies.

### Phase 2: Secure OAuth Connection

Replace prototype OAuth with PRD 008 routes, signed/single-use state, encrypted server-side token storage, reconnect, disconnect, and sanitized status.

Exit gate:

- Replayed/expired/mismatched state rejected.
- Token never stored in cookies or returned to browser.
- Connection status shows connected/degraded/reconnect_required/disconnected.

### Phase 3: Explicit Account Selection

List accessible ad accounts, validate selected account belongs to connected user, and bind account to business.

Exit gate:

- Unknown/cross-workspace account selection rejected.
- One selected active account per business.
- Selected account visible to Business Context readiness.

### Phase 4: Capability Discovery

Implement versioned data-contract registry and probe required read endpoints/fields/permissions.

Exit gate:

- Empty, permission-blocked, unsupported, missing asset, and provider-error states are distinct.
- Scheduler skips known permission-blocked partitions until reconnect/retry.

### Phase 5: Hierarchy Sync

Sync ad account, campaigns, ad sets, ads, and creatives into canonical tables with checkpoints and quarantine.

Exit gate:

- Retry does not duplicate canonical rows.
- Failed partition does not rerun completed partitions.
- Parent-child integrity checks run.

### Phase 6: Daily Insights Sync

Backfill 90 complete days of daily ad-level insights and support incremental restatement-window refresh.

Exit gate:

- Stored dates match Meta reporting dates.
- Raw actions/action values preserved.
- Freshness and missing-date coverage visible.

### Phase 7: Business Context Meta Evidence

Replace env-based Meta evidence with stored PRD 008 data and pipe summarized Meta evidence into Business Context synthesis.

Exit gate:

- `source_type = meta` processes selected account data.
- Final context can cite Meta account, sync run, and data window.
- Conflicts create questions/unresolved facts, not silent overwrites.

### Phase 8: Analytics Migration

Move prototype analytics routes to stored Supabase Meta query service or return clear not-synced states.

Exit gate:

- No cookie-token or `.env` token/account fallback remains for user business data.
- No mock success data for connected businesses.

## Testing Strategy

- Unit tests for sync policy, data contract registry, state validation, retry classification, quality validation, and Business Context evidence mapping.
- Contract tests for API request/response shapes and idempotency.
- RLS tests for every Meta table.
- Repository integration tests against local Supabase.
- Provider adapter tests with Meta fixture responses, pagination, rate limits, permission errors, empty responses, and schema drift.
- Worker tests for resume, checkpoints, partial success, quarantine, and duplicate request safety.
- End-to-end local flow using Meta test app/account where available.

## Operational Requirements

- Use NOVA's Meta Developer App; clients do not bring their own app.
- Users must have Meta access to the ad account they connect.
- Local testing uses HTTPS tunnel callback, e.g. ngrok.
- Production requires reviewed/approved Meta permissions and configured production callback URL.
- Secrets stay in environment/secret manager and are never committed.
- Logs redact tokens, signed state, raw sensitive provider payloads, and user data.

## Open Non-Blocking Decisions

- Exact Meta API version for first implementation. PRD says target current supported version; local config currently defaults older. Implementation should standardize on configured version and test upgrade boundary.
- Whether to include `ads_management` in requested scopes during read-only PRD 008. Current app shows it ready for testing, but implementation should only perform reads.
- Exact UI surface for connection/freshness controls. Backend/API roadmap can proceed without final UI layout.

## Acceptance Summary

Done means:

- Authorised user connects Meta through NOVA.
- Token is stored server-side only.
- User explicitly selects ad account for business.
- Capability status is visible and precise.
- Hierarchy and daily insights sync into Supabase with checkpoints.
- Sync can resume after failure and does not duplicate data.
- Freshness and partial coverage are visible.
- Business Context consumes stored Meta evidence when synthesising final context.
- Prototype cookie, `.env`, and mock analytics fallbacks are removed or blocked for connected businesses.
- No Meta write/mutation action is introduced.
