# 008A Meta Connection Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build secure workspace-scoped Meta OAuth, token storage, ad account listing/selection, and Business Context readiness handoff.

**Architecture:** Add `src/core/meta-data` for provider-independent rules, keep Next routes thin, and use Supabase repositories for durable state. This plan intentionally stops before durable campaign/insight sync.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, Supabase Postgres/RLS, Meta Marketing API OAuth, Node `crypto`.

## Global Constraints

- Clients use NOVA's Meta Developer App; clients do not bring their own app.
- Tokens must never be stored in cookies, returned to browser, logged, or exposed through RLS-readable tables/views.
- OAuth state must be short-lived, signed or nonce-bound, single-use, and scoped to user/workspace/return path.
- Users must explicitly select an accessible ad account; do not silently select the first account.
- Existing PRD 006 Business Context patterns and Supabase local workflow remain source of truth.
- No Meta write/mutation action is introduced.

---

## File Structure

- Create `src/core/meta-data/entities.ts`: connection/account/status/value types.
- Create `src/core/meta-data/oauth-state.ts`: state encode/decode/hash helpers.
- Create `src/core/meta-data/token-vault.port.ts`: token encryption interface.
- Create `src/core/meta-data/repository.port.ts`: repository interface for connection slice.
- Create `src/infrastructure/meta/token-vault.ts`: AES-GCM encryption using `META_ENCRYPTION_KEY`.
- Create `src/infrastructure/meta/supabase-meta.repository.ts`: Supabase implementation.
- Modify `src/infrastructure/meta/meta-oauth.adapter.ts`: support v25 OAuth and token verification helper.
- Modify `src/infrastructure/meta/meta-api.adapter.ts`: add accessible account listing wrapper.
- Create/replace routes under `src/app/api/meta/oauth/*`, `src/app/api/meta/ad-accounts/*`, `src/app/api/meta/connections/*`.
- Add migration `supabase/migrations/202607180001_meta_connection_foundation.sql`.
- Add tests under `tests/unit/meta-data`, `tests/contract/meta-data`, `tests/integration/meta-data`, `tests/rls/meta-data`.

## Task 1: Core OAuth State And Entity Types

**Files:**
- Create: `src/core/meta-data/entities.ts`
- Create: `src/core/meta-data/oauth-state.ts`
- Test: `tests/unit/meta-data/oauth-state.test.ts`

**Interfaces:**
- Produces: `encodeMetaOAuthState(input: MetaOAuthStatePayload): string`
- Produces: `decodeMetaOAuthState(raw: string): MetaOAuthStatePayload | null`
- Produces: `hashMetaOAuthNonce(nonce: string): string`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/meta-data/oauth-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decodeMetaOAuthState, encodeMetaOAuthState, hashMetaOAuthNonce } from '@/core/meta-data/oauth-state'

describe('Meta OAuth state helpers', () => {
  it('round-trips workspace, user, nonce, and return path', () => {
    const encoded = encodeMetaOAuthState({
      stateId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      nonce: 'nonce-value',
      returnPath: '/settings?tab=meta',
    })
    expect(decodeMetaOAuthState(encoded)).toEqual({
      stateId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      nonce: 'nonce-value',
      returnPath: '/settings?tab=meta',
    })
  })

  it('returns null for invalid state', () => {
    expect(decodeMetaOAuthState('not-valid-base64')).toBeNull()
  })

  it('hashes nonce with sha256 hex', () => {
    expect(hashMetaOAuthNonce('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
```

- [ ] **Step 2: Run failing test**

Run: `npm run test:unit -- tests/unit/meta-data/oauth-state.test.ts`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement core files**

Create `src/core/meta-data/entities.ts`:

```ts
export type MetaConnectionStatus = 'pending' | 'connected' | 'degraded' | 'reconnect_required' | 'disconnected'

export interface MetaOAuthStatePayload {
  stateId: string
  workspaceId: string
  userId: string
  nonce: string
  returnPath: string
}

export interface MetaConnectionStatusView {
  id: string
  workspaceId: string
  connectedBy: string
  metaUserId: string
  status: MetaConnectionStatus
  grantedScopes: string[]
  tokenExpiresAt: Date | null
  selectedAdAccountId: string | null
  selectedBusinessId: string | null
  lastVerifiedAt: Date | null
  reconnectReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MetaAdAccountSummary {
  id: string
  accountId: string
  name: string
  currency: string | null
  timezoneName: string | null
  businessId: string | null
  businessName: string | null
  isSelected: boolean
}
```

Create `src/core/meta-data/oauth-state.ts`:

```ts
import { createHash } from 'crypto'
import type { MetaOAuthStatePayload } from './entities'

export function encodeMetaOAuthState(input: MetaOAuthStatePayload): string {
  return Buffer.from(JSON.stringify(input), 'utf8').toString('base64url')
}

export function decodeMetaOAuthState(raw: string): MetaOAuthStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<MetaOAuthStatePayload>
    if (!parsed.stateId || !parsed.workspaceId || !parsed.userId || !parsed.nonce || !parsed.returnPath) return null
    return {
      stateId: parsed.stateId,
      workspaceId: parsed.workspaceId,
      userId: parsed.userId,
      nonce: parsed.nonce,
      returnPath: parsed.returnPath,
    }
  } catch {
    return null
  }
}

export function hashMetaOAuthNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex')
}
```

- [ ] **Step 4: Verify pass**

Run: `npm run test:unit -- tests/unit/meta-data/oauth-state.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/core/meta-data tests/unit/meta-data && git commit -m "feat: add Meta OAuth state helpers"`

## Task 2: Supabase Connection Schema And RLS

**Files:**
- Create: `supabase/migrations/202607180001_meta_connection_foundation.sql`
- Test: `tests/integration/meta-data/meta-connection-schema.test.ts`
- Test: `tests/rls/meta-data/meta-connection-rls.test.ts`

**Interfaces:**
- Produces tables: `meta_connections`, `meta_oauth_states`, `meta_ad_accounts`
- Produces view: `v_meta_connection_status`

- [ ] **Step 1: Write schema introspection test**

Create `tests/integration/meta-data/meta-connection-schema.test.ts` using existing `tests/integration/business-context/db-introspect-helpers.ts` helpers. Assert required tables/columns exist: `workspace_id`, `business_id`, `encrypted_access_token`, `selected_ad_account_id`, `granted_scopes`, `status`, `expires_at`, `consumed_at`.

- [ ] **Step 2: Write RLS denial test**

Create `tests/rls/meta-data/meta-connection-rls.test.ts`. Seed a row with service role, then assert anon/authenticated workspace users cannot select `encrypted_access_token` from `meta_connections` and can only read sanitized rows from `v_meta_connection_status` for their workspace.

- [ ] **Step 3: Run failing tests**

Run: `npm run test:integration -- tests/integration/meta-data/meta-connection-schema.test.ts`

Expected: FAIL because tables do not exist.

- [ ] **Step 4: Add migration**

Create migration with:

```sql
create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connected_by uuid not null,
  meta_user_id text not null,
  encrypted_access_token text not null,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  selected_ad_account_id text,
  selected_business_id uuid references public.businesses(id) on delete set null,
  status text not null check (status in ('pending','connected','degraded','reconnect_required','disconnected')),
  last_verified_at timestamptz,
  reconnect_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null,
  state_nonce_hash text not null unique,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  provider_code_hash text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  connection_id uuid not null references public.meta_connections(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete set null,
  meta_account_id text not null,
  account_id text not null,
  name text not null,
  currency text,
  timezone_name text,
  meta_business_id text,
  meta_business_name text,
  is_selected boolean not null default false,
  raw_metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, connection_id, meta_account_id)
);

create unique index if not exists idx_meta_connections_one_active_user
on public.meta_connections (workspace_id, meta_user_id)
where status in ('pending','connected','degraded','reconnect_required');

create unique index if not exists idx_meta_ad_accounts_one_selected_business
on public.meta_ad_accounts (workspace_id, business_id)
where is_selected = true and business_id is not null;

create or replace view public.v_meta_connection_status as
select id, workspace_id, connected_by, meta_user_id, granted_scopes, token_expires_at,
       selected_ad_account_id, selected_business_id, status, last_verified_at,
       reconnect_reason, created_at, updated_at
from public.meta_connections;

alter table public.meta_connections enable row level security;
alter table public.meta_oauth_states enable row level security;
alter table public.meta_ad_accounts enable row level security;

create policy "meta connections service role only" on public.meta_connections
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "meta oauth states service role only" on public.meta_oauth_states
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "meta ad accounts member read" on public.meta_ad_accounts
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = meta_ad_accounts.workspace_id and wm.user_id = auth.uid()
  ));

create policy "meta ad accounts service role write" on public.meta_ad_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
```

- [ ] **Step 5: Reset Supabase and verify**

Run: `npm run supabase:reset`

Expected: migrations apply without error.

Run: `npm run test:integration -- tests/integration/meta-data/meta-connection-schema.test.ts`

Expected: PASS.

Run: `npm run test:rls -- tests/rls/meta-data/meta-connection-rls.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations tests/integration/meta-data tests/rls/meta-data && git commit -m "feat: add Meta connection schema"`

## Task 3: Token Vault

**Files:**
- Create: `src/core/meta-data/token-vault.port.ts`
- Create: `src/infrastructure/meta/token-vault.ts`
- Test: `tests/unit/meta-data/token-vault.test.ts`

**Interfaces:**
- Produces: `TokenVaultPort.encrypt(plaintext: string): string`
- Produces: `TokenVaultPort.decrypt(ciphertext: string): string`

- [ ] **Step 1: Write failing tests**

Test that encrypted output does not contain plaintext, decrypt round-trips, and missing/short `META_ENCRYPTION_KEY` throws clear error.

- [ ] **Step 2: Implement vault**

Use AES-256-GCM with random 12-byte IV. Store payload as `v1:<ivBase64url>:<tagBase64url>:<cipherBase64url>`. Derive 32-byte key with SHA-256 over `META_ENCRYPTION_KEY`.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/meta-data/token-vault.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/token-vault.port.ts src/infrastructure/meta/token-vault.ts tests/unit/meta-data/token-vault.test.ts && git commit -m "feat: add Meta token vault"`

## Task 4: Supabase Meta Repository

**Files:**
- Create: `src/core/meta-data/repository.port.ts`
- Create: `src/infrastructure/meta/supabase-meta.repository.ts`
- Test: `tests/integration/meta-data/meta-repository.test.ts`

**Interfaces:**
- Produces: `createOAuthState`, `consumeOAuthState`, `upsertConnection`, `listAdAccounts`, `selectAdAccount`, `getStatus`.

- [ ] **Step 1: Write repository tests**

Cover one-time OAuth state consumption, provider code replay rejection, sanitized status, account upsert, selected account binding to business.

- [ ] **Step 2: Implement port and repository**

Repository uses Supabase service client only. `getStatus` reads sanitized view and maps snake_case to camelCase.

- [ ] **Step 3: Verify**

Run: `npm run test:integration -- tests/integration/meta-data/meta-repository.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/meta-data/repository.port.ts src/infrastructure/meta/supabase-meta.repository.ts tests/integration/meta-data/meta-repository.test.ts && git commit -m "feat: add Meta connection repository"`

## Task 5: OAuth Start And Callback Routes

**Files:**
- Create: `src/app/api/meta/oauth/start/route.ts`
- Create: `src/app/api/meta/oauth/callback/route.ts`
- Modify: `src/infrastructure/meta/meta-oauth.adapter.ts`
- Test: `tests/contract/meta-data/meta-oauth-routes.test.ts`

**Interfaces:**
- Consumes Task 1 state helpers, Task 3 vault, Task 4 repository.
- Produces OAuth start JSON `{ authorization_url, state_id, expires_at }`.

- [ ] **Step 1: Write route contract tests**

Assert POST start requires authz and returns URL, callback rejects invalid state, callback never sets token cookies, and callback redirects with 303.

- [ ] **Step 2: Implement POST start**

Validate body `{ workspace_id: string, return_path?: string }`, require editor authz, create nonce/state row, encode state, return Meta auth URL.

- [ ] **Step 3: Implement GET callback**

Decode state, verify nonce hash, reject expired/consumed states, hash code before token exchange, exchange server-side, encrypt token, upsert connection, redirect to return path.

- [ ] **Step 4: Verify**

Run: `npm run test:contract -- tests/contract/meta-data/meta-oauth-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/app/api/meta/oauth src/infrastructure/meta/meta-oauth.adapter.ts tests/contract/meta-data/meta-oauth-routes.test.ts && git commit -m "feat: add secure Meta OAuth routes"`

## Task 6: Ad Account Listing And Selection

**Files:**
- Modify: `src/infrastructure/meta/meta-api.adapter.ts`
- Create: `src/app/api/meta/ad-accounts/route.ts`
- Create: `src/app/api/meta/ad-accounts/[accountId]/select/route.ts`
- Test: `tests/contract/meta-data/meta-ad-accounts-routes.test.ts`

**Interfaces:**
- Produces `GET /api/meta/ad-accounts?workspace_id=...`.
- Produces `POST /api/meta/ad-accounts/:accountId/select` body `{ workspace_id, business_id }`.

- [ ] **Step 1: Write tests**

Assert account listing does not expose token, selection requires editor, selection validates accessible account exists, response includes selected business/account fields.

- [ ] **Step 2: Implement Meta API account listing**

Read `me/adaccounts?fields=id,account_id,name,currency,timezone_name,business{id,name},account_status` with supplied token.

- [ ] **Step 3: Implement routes**

Decrypt token server-side, refresh stored accounts from Meta on list, select only accounts already stored for connection/workspace.

- [ ] **Step 4: Verify**

Run: `npm run test:contract -- tests/contract/meta-data/meta-ad-accounts-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add src/app/api/meta/ad-accounts src/infrastructure/meta/meta-api.adapter.ts tests/contract/meta-data/meta-ad-accounts-routes.test.ts && git commit -m "feat: add Meta ad account selection"`

## Task 7: Business Context Readiness Handoff

**Files:**
- Modify: `src/core/business-context/onboarding-readiness.ts`
- Modify: existing Business Context API status route if present, or add metadata helper under `src/core/business-context/meta-readiness.ts`
- Test: `tests/unit/business-context/meta-readiness.test.ts`

**Interfaces:**
- Produces helper `hasSelectedMetaAccount(input): boolean` or equivalent readiness field.

- [ ] **Step 1: Write test**

Assert readiness returns true when business has selected `meta_ad_accounts` row and false when connection exists but no selected business account.

- [ ] **Step 2: Implement minimal helper**

Expose selected account status to onboarding/business context status without importing infrastructure into core.

- [ ] **Step 3: Verify**

Run: `npm run test:unit -- tests/unit/business-context/meta-readiness.test.ts`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/core/business-context tests/unit/business-context/meta-readiness.test.ts && git commit -m "feat: expose Meta account readiness"`

## Task 8: Deprecate Prototype Cookie OAuth Paths

**Files:**
- Modify: `src/app/api/meta/auth/route.ts`
- Modify: `src/app/api/meta/callback/route.ts`
- Modify: `src/app/api/meta/accounts/route.ts`
- Test: `tests/contract/meta-data/meta-prototype-routes.test.ts`

**Interfaces:**
- Produces clear 410/redirect compatibility behavior without cookie token storage.

- [ ] **Step 1: Write tests**

Assert old routes do not set/read `meta_access_token` cookies and point callers to `/api/meta/oauth/start` or `/api/meta/ad-accounts`.

- [ ] **Step 2: Implement compatibility responses**

Return `410 Gone` JSON for old JSON routes and redirect old callback to settings with `meta_route_deprecated` if invoked.

- [ ] **Step 3: Verify full connection slice**

Run: `npm run test:unit -- tests/unit/meta-data tests/unit/business-context/meta-readiness.test.ts`

Run: `npm run test:contract -- tests/contract/meta-data`

Run: `npm run test:integration -- tests/integration/meta-data`

Run: `npm run test:rls -- tests/rls/meta-data`

Expected: PASS.

- [ ] **Step 4: Commit**

Run: `git add src/app/api/meta tests/contract/meta-data/meta-prototype-routes.test.ts && git commit -m "refactor: retire prototype Meta cookie routes"`

## Final Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run test:all` if local Supabase is available.
- [ ] Run `npm run build`.
- [ ] Verify local Meta env contains `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_API_VERSION`, `META_ENCRYPTION_KEY`.
- [ ] Manual smoke with ngrok callback: start OAuth, complete Meta login, list accounts, select account.
