-- PRD 008A: Meta connection foundation

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

create or replace view public.v_meta_connection_status
with (security_barrier = true, security_invoker = true) as
select id,
       workspace_id,
       connected_by,
       meta_user_id,
       granted_scopes,
       token_expires_at,
       selected_ad_account_id,
       selected_business_id,
       status,
       last_verified_at,
       reconnect_reason,
       created_at,
       updated_at
from public.meta_connections
where exists (
  select 1
  from public.workspace_members wm
  where wm.workspace_id = meta_connections.workspace_id
    and wm.user_id = auth.uid()
);

alter table public.meta_connections enable row level security;
alter table public.meta_oauth_states enable row level security;
alter table public.meta_ad_accounts enable row level security;

drop policy if exists "meta connections service role only" on public.meta_connections;
create policy "meta connections service role only" on public.meta_connections
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "meta oauth states service role only" on public.meta_oauth_states;
create policy "meta oauth states service role only" on public.meta_oauth_states
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists "meta ad accounts member read" on public.meta_ad_accounts;
create policy "meta ad accounts member read" on public.meta_ad_accounts
  for select using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = meta_ad_accounts.workspace_id and wm.user_id = auth.uid()
  ));

drop policy if exists "meta ad accounts service role write" on public.meta_ad_accounts;
create policy "meta ad accounts service role write" on public.meta_ad_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

grant select on public.v_meta_connection_status to authenticated;
grant select, insert, update, delete on public.meta_connections to service_role;
grant select, insert, update, delete on public.meta_oauth_states to service_role;
grant select, insert, update, delete on public.meta_ad_accounts to service_role;
grant select on public.meta_ad_accounts to authenticated;
