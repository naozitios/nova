-- PRD 008C Task 1: meta daily insights table

create table if not exists public.meta_insights_daily (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_campaign_id text,
  meta_ad_set_id text,
  meta_ad_id text not null,
  date_start date not null,
  date_stop date not null,
  spend numeric,
  impressions bigint,
  reach bigint,
  frequency numeric,
  clicks bigint,
  link_clicks bigint,
  landing_page_views bigint,
  actions jsonb not null default '[]',
  action_values jsonb not null default '[]',
  result_count numeric,
  conversion_count numeric,
  conversion_value numeric,
  attribution_setting text not null default 'default',
  currency text,
  account_timezone text,
  data_completeness_state text not null default 'complete',
  meta_sync_run_id uuid references public.meta_sync_runs(id) on delete set null,
  api_version text not null,
  raw_metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_start <= date_stop)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

create unique index idx_meta_insights_daily_unique_provider
  on public.meta_insights_daily (workspace_id, meta_ad_account_id, meta_ad_id, date_start, date_stop, attribution_setting, api_version);

create index if not exists idx_meta_insights_daily_account_date
  on public.meta_insights_daily (workspace_id, meta_ad_account_id, date_start);

create index if not exists idx_meta_insights_daily_ad_date
  on public.meta_insights_daily (workspace_id, meta_ad_id, date_start);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.meta_insights_daily enable row level security;

create policy "meta_insights_daily_member_read" on public.meta_insights_daily
  for select using (is_workspace_member(workspace_id));

create policy "meta_insights_daily_service_role" on public.meta_insights_daily
  for all using (true) with check (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select on public.meta_insights_daily to authenticated;
grant select, insert, update, delete on public.meta_insights_daily to service_role;
