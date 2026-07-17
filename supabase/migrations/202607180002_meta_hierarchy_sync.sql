-- Meta hierarchy sync schema: canonical ad hierarchy tables + sync orchestration.
-- Produces: meta_campaigns, meta_ad_sets, meta_ads, meta_creatives,
--           meta_sync_runs, meta_sync_checkpoints, meta_sync_attempts,
--           meta_quarantined_records.

-- ============================================================================
-- CANONICAL TABLES
-- ============================================================================

create table if not exists meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
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
  updated_at timestamptz not null default now()
);

create table if not exists meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_ad_set_id text not null,
  meta_campaign_id text not null,
  name text not null,
  optimization_goal text,
  billing_event text,
  effective_status text,
  configured_status text,
  daily_budget text,
  lifetime_budget text,
  start_time timestamptz,
  end_time timestamptz,
  provider_created_time timestamptz,
  provider_updated_time timestamptz,
  raw_metadata_json jsonb not null default '{}',
  meta_sync_run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meta_ads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_ad_id text not null,
  meta_campaign_id text not null,
  meta_ad_set_id text,
  meta_creative_id text,
  name text not null,
  effective_status text,
  configured_status text,
  provider_created_time timestamptz,
  provider_updated_time timestamptz,
  raw_metadata_json jsonb not null default '{}',
  meta_sync_run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meta_creatives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  meta_creative_id text not null,
  name text not null,
  title text,
  body text,
  object_story_spec jsonb,
  asset_feed_spec jsonb,
  thumbnail_url text,
  image_url text,
  video_id text,
  effective_object_story_id text,
  provider_created_time timestamptz,
  provider_updated_time timestamptz,
  raw_metadata_json jsonb not null default '{}',
  meta_sync_run_id uuid,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- SYNC ORCHESTRATION TABLES
-- ============================================================================

create table if not exists meta_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  meta_ad_account_id text not null,
  status text not null default 'queued',
  mode text not null,
  idempotency_key text not null unique,
  lease_owner text,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  partition_states jsonb not null default '{}',
  error jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists meta_sync_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  run_id uuid not null references meta_sync_runs(id) on delete cascade,
  partition_key text not null,
  cursor text,
  records_upserted integer not null default 0,
  records_quarantined integer not null default 0,
  status text not null default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, partition_key)
);

create table if not exists meta_sync_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  run_id uuid not null references meta_sync_runs(id) on delete cascade,
  partition_key text not null,
  attempt_number integer not null,
  status text not null,
  provider_status_code integer,
  provider_request_id text,
  duration_ms integer,
  records_fetched integer not null default 0,
  records_upserted integer not null default 0,
  records_quarantined integer not null default 0,
  error jsonb,
  created_at timestamptz not null default now()
);

create table if not exists meta_quarantined_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  run_id uuid references meta_sync_runs(id) on delete set null,
  source_table text not null,
  provider_id text not null,
  redacted_payload jsonb not null default '{}',
  validation_errors jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- ============================================================================
-- UNIQUE INDEXES (provider identity)
-- ============================================================================

create unique index idx_meta_campaigns_unique_provider
  on meta_campaigns (workspace_id, meta_ad_account_id, meta_campaign_id);

create unique index idx_meta_ad_sets_unique_provider
  on meta_ad_sets (workspace_id, meta_ad_account_id, meta_ad_set_id);

create unique index idx_meta_ads_unique_provider
  on meta_ads (workspace_id, meta_ad_account_id, meta_ad_id);

create unique index idx_meta_creatives_unique_provider
  on meta_creatives (workspace_id, meta_ad_account_id, meta_creative_id);

-- ============================================================================
-- ADDITIONAL INDEXES
-- ============================================================================

create index if not exists idx_meta_campaigns_workspace on meta_campaigns(workspace_id);
create index if not exists idx_meta_campaigns_account on meta_campaigns(workspace_id, meta_ad_account_id);
create index if not exists idx_meta_campaigns_status on meta_campaigns(workspace_id, effective_status);

create index if not exists idx_meta_ad_sets_workspace on meta_ad_sets(workspace_id);
create index if not exists idx_meta_ad_sets_account on meta_ad_sets(workspace_id, meta_ad_account_id);
create index if not exists idx_meta_ad_sets_campaign on meta_ad_sets(workspace_id, meta_campaign_id);

create index if not exists idx_meta_ads_workspace on meta_ads(workspace_id);
create index if not exists idx_meta_ads_account on meta_ads(workspace_id, meta_ad_account_id);
create index if not exists idx_meta_ads_campaign on meta_ads(workspace_id, meta_campaign_id);
create index if not exists idx_meta_ads_ad_set on meta_ads(workspace_id, meta_ad_set_id);

create index if not exists idx_meta_creatives_workspace on meta_creatives(workspace_id);
create index if not exists idx_meta_creatives_account on meta_creatives(workspace_id, meta_ad_account_id);

create index if not exists idx_meta_sync_runs_workspace_status on meta_sync_runs(workspace_id, status);
create index if not exists idx_meta_sync_runs_account on meta_sync_runs(workspace_id, meta_ad_account_id);
create index if not exists idx_meta_sync_runs_idempotency on meta_sync_runs(idempotency_key);
create index if not exists idx_meta_sync_runs_lease on meta_sync_runs(lease_owner, lease_expires_at);

create index if not exists idx_meta_sync_checkpoints_run on meta_sync_checkpoints(run_id);
create index if not exists idx_meta_sync_checkpoints_partition on meta_sync_checkpoints(run_id, partition_key);

create index if not exists idx_meta_sync_attempts_run on meta_sync_attempts(run_id);
create index if not exists idx_meta_sync_attempts_partition on meta_sync_attempts(run_id, partition_key);

create index if not exists idx_meta_quarantined_workspace on meta_quarantined_records(workspace_id);
create index if not exists idx_meta_quarantined_run on meta_quarantined_records(run_id);
create index if not exists idx_meta_quarantined_source on meta_quarantined_records(source_table, provider_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table meta_campaigns enable row level security;
alter table meta_ad_sets enable row level security;
alter table meta_ads enable row level security;
alter table meta_creatives enable row level security;
alter table meta_sync_runs enable row level security;
alter table meta_sync_checkpoints enable row level security;
alter table meta_sync_attempts enable row level security;
alter table meta_quarantined_records enable row level security;

-- ============================================================================
-- MEMBER SELECT POLICIES (canonical tables: authenticated members read)
-- ============================================================================

create policy "meta_campaigns_select" on meta_campaigns
  for select using (is_workspace_member(workspace_id));

create policy "meta_ad_sets_select" on meta_ad_sets
  for select using (is_workspace_member(workspace_id));

create policy "meta_ads_select" on meta_ads
  for select using (is_workspace_member(workspace_id));

create policy "meta_creatives_select" on meta_creatives
  for select using (is_workspace_member(workspace_id));

-- Sync tables: member read for visibility into own workspace sync state

create policy "meta_sync_runs_select" on meta_sync_runs
  for select using (is_workspace_member(workspace_id));

create policy "meta_sync_checkpoints_select" on meta_sync_checkpoints
  for select using (is_workspace_member(workspace_id));

create policy "meta_sync_attempts_select" on meta_sync_attempts
  for select using (is_workspace_member(workspace_id));

create policy "meta_quarantined_records_select" on meta_quarantined_records
  for select using (is_workspace_member(workspace_id));

-- ============================================================================
-- SERVICE_ROLE POLICIES (service_role bypasses RLS but needs explicit policies
-- for the Postgres GRANT system; these are permissive for service_role usage)
-- ============================================================================

create policy "meta_campaigns_service_role" on meta_campaigns
  for all using (true) with check (true);

create policy "meta_ad_sets_service_role" on meta_ad_sets
  for all using (true) with check (true);

create policy "meta_ads_service_role" on meta_ads
  for all using (true) with check (true);

create policy "meta_creatives_service_role" on meta_creatives
  for all using (true) with check (true);

create policy "meta_sync_runs_service_role" on meta_sync_runs
  for all using (true) with check (true);

create policy "meta_sync_checkpoints_service_role" on meta_sync_checkpoints
  for all using (true) with check (true);

create policy "meta_sync_attempts_service_role" on meta_sync_attempts
  for all using (true) with check (true);

create policy "meta_quarantined_records_service_role" on meta_quarantined_records
  for all using (true) with check (true);

-- ============================================================================
-- GRANTS: service_role full CRUD on all new tables
-- ============================================================================

grant select, insert, update, delete on public.meta_campaigns to service_role;
grant select, insert, update, delete on public.meta_ad_sets to service_role;
grant select, insert, update, delete on public.meta_ads to service_role;
grant select, insert, update, delete on public.meta_creatives to service_role;
grant select, insert, update, delete on public.meta_sync_runs to service_role;
grant select, insert, update, delete on public.meta_sync_checkpoints to service_role;
grant select, insert, update, delete on public.meta_sync_attempts to service_role;
grant select, insert, update, delete on public.meta_quarantined_records to service_role;

-- ============================================================================
-- GRANTS: authenticated SELECT on canonical tables (read-only for frontend)
-- ============================================================================

grant select on public.meta_campaigns to authenticated;
grant select on public.meta_ad_sets to authenticated;
grant select on public.meta_ads to authenticated;
grant select on public.meta_creatives to authenticated;
