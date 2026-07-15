-- Business Context migration
-- Tables, constraints, indexes, RLS policies, storage, and SQL functions.

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  website_url text,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'created',
  current_step text,
  started_by uuid not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error jsonb
);

create table if not exists context_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_type text not null,
  source_name text not null,
  external_reference text,
  status text not null default 'registered',
  current_stage text,
  terminal_outcome text,
  metadata jsonb not null default '{}',
  collected_at timestamptz not null default now()
);

create table if not exists source_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_id uuid not null references context_sources(id) on delete cascade,
  url text,
  title text,
  document_type text,
  mime_type text,
  file_name text,
  file_size_bytes bigint,
  content_text text,
  storage_path text,
  content_hash text not null,
  http_status integer,
  page_or_slide_count integer,
  parser_name text,
  parser_version text,
  effective_at timestamptz,
  supersedes_document_id uuid,
  metadata jsonb not null default '{}',
  retrieved_at timestamptz not null default now()
);

create table if not exists context_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  fact_key text not null,
  value jsonb not null,
  source_id uuid not null references context_sources(id) on delete cascade,
  source_document_id uuid references source_documents(id),
  source_excerpt text,
  evidence_locator jsonb,
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  verification_status text not null default 'extracted',
  supersedes_fact_id uuid,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  created_at timestamptz not null default now(),
  created_by text not null
);

create table if not exists context_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  fact_key text not null,
  fact_ids uuid[] not null,
  status text not null default 'open',
  resolution_fact_id uuid,
  resolution_note text,
  resolved_by uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  fact_key text not null,
  question_type text not null,
  question text not null,
  options jsonb,
  reason text not null,
  priority integer not null default 0,
  status text not null default 'open',
  answer jsonb,
  answered_by uuid,
  answered_at timestamptz
);

create table if not exists business_profile_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  version integer not null,
  profile jsonb not null,
  profile_markdown text,
  status text not null default 'draft',
  change_summary text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz
);

create table if not exists context_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  session_id uuid,
  job_type text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 4,
  idempotency_key text not null unique,
  stage text,
  input jsonb not null,
  output jsonb,
  error jsonb,
  error_class text,
  retry_policy jsonb not null default '{}',
  next_run_at timestamptz,
  locked_by text,
  locked_at timestamptz,
  heartbeat_at timestamptz,
  stage_timeout_seconds integer,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table if not exists context_processing_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_id uuid not null references context_sources(id) on delete cascade,
  job_id uuid,
  pipeline_type text not null,
  status text not null default 'running',
  current_stage text not null,
  terminal_outcome text,
  attempt_count integer not null default 0,
  pages_processed integer not null default 0,
  slides_processed integer not null default 0,
  documents_created integer not null default 0,
  facts_extracted integer not null default 0,
  warnings_count integer not null default 0,
  credits_consumed numeric not null default 0,
  quality_summary jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists context_processing_stage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  run_id uuid not null references context_processing_runs(id) on delete cascade,
  job_id uuid,
  source_id uuid not null references context_sources(id) on delete cascade,
  stage text not null,
  status text not null,
  attempt integer not null,
  worker_id text,
  provider text,
  provider_request_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  pages_processed integer not null default 0,
  slides_processed integer not null default 0,
  bytes_processed bigint not null default 0,
  documents_created integer not null default 0,
  facts_extracted integer not null default 0,
  warnings_count integer not null default 0,
  credits_consumed numeric not null default 0,
  error_class text,
  error jsonb,
  metadata jsonb not null default '{}'
);

create table if not exists context_quality_gate_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  run_id uuid,
  source_id uuid,
  source_document_id uuid,
  fact_id uuid,
  gate_scope text not null,
  gate_name text not null,
  status text not null,
  measured_value jsonb,
  threshold jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists context_provider_circuit_breakers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  provider text not null,
  state text not null default 'closed',
  failure_count integer not null default 0,
  success_count integer not null default 0,
  timeout_count integer not null default 0,
  quota_exhausted boolean not null default false,
  opened_at timestamptz,
  half_open_after timestamptz,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  metadata jsonb not null default '{}'
);

create table if not exists context_audit_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  actor_id uuid,
  actor_type text not null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- CONSTRAINTS
-- ============================================================================

alter table context_facts
  add constraint context_facts_confidence_bounds check (confidence >= 0 and confidence <= 1);

alter table business_profile_versions
  add constraint business_profile_versions_business_id_version_unique unique (business_id, version);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- businesses
create index if not exists idx_businesses_workspace_id on businesses(workspace_id);
create index if not exists idx_businesses_workspace_status on businesses(workspace_id, status);

-- onboarding_sessions
create index if not exists idx_onboarding_sessions_workspace_business on onboarding_sessions(workspace_id, business_id);
create index if not exists idx_onboarding_sessions_workspace_status on onboarding_sessions(workspace_id, status);

-- context_sources
create index if not exists idx_context_sources_workspace_business on context_sources(workspace_id, business_id);
create index if not exists idx_context_sources_workspace_status on context_sources(workspace_id, status);
create index if not exists idx_context_sources_business_type on context_sources(business_id, source_type);
create index if not exists idx_context_sources_business_stage on context_sources(business_id, current_stage);

-- source_documents
create index if not exists idx_source_documents_workspace_business on source_documents(workspace_id, business_id);
create index if not exists idx_source_documents_source_id on source_documents(source_id);
create index if not exists idx_source_documents_business_hash on source_documents(business_id, content_hash);
create index if not exists idx_source_documents_supersedes on source_documents(supersedes_document_id);

-- context_facts
create index if not exists idx_context_facts_workspace_business_key on context_facts(workspace_id, business_id, fact_key);
create index if not exists idx_context_facts_source_id on context_facts(source_id);
create index if not exists idx_context_facts_source_document_id on context_facts(source_document_id);
create index if not exists idx_context_facts_supersedes on context_facts(supersedes_fact_id);
create index if not exists idx_context_facts_active on context_facts(business_id, fact_key)
  where valid_to is null and verification_status not in ('rejected', 'superseded');

-- context_conflicts
create index if not exists idx_context_conflicts_workspace_business_status on context_conflicts(workspace_id, business_id, status);
create index if not exists idx_context_conflicts_business_key on context_conflicts(business_id, fact_key);

-- onboarding_questions
create index if not exists idx_onboarding_questions_workspace_session_status on onboarding_questions(workspace_id, session_id, status);
create index if not exists idx_onboarding_questions_business_key on onboarding_questions(business_id, fact_key);

-- business_profile_versions
create unique index one_current_business_profile on business_profile_versions(business_id) where status = 'current';
create index if not exists idx_business_profile_versions_workspace_business_status on business_profile_versions(workspace_id, business_id, status);

-- context_jobs
create index if not exists idx_context_jobs_workspace_business_status on context_jobs(workspace_id, business_id, status);
create index if not exists idx_context_jobs_type_status_created on context_jobs(job_type, status, created_at);
create index if not exists idx_context_jobs_status_next_run on context_jobs(status, next_run_at);
create index if not exists idx_context_jobs_status_heartbeat on context_jobs(status, heartbeat_at);
create index if not exists idx_context_jobs_locked on context_jobs(locked_by, locked_at);

-- context_processing_runs
create index if not exists idx_processing_runs_workspace_business_status on context_processing_runs(workspace_id, business_id, status);
create index if not exists idx_processing_runs_source_started on context_processing_runs(source_id, started_at desc);
create index if not exists idx_processing_runs_job_id on context_processing_runs(job_id);

-- context_processing_stage_events
create index if not exists idx_stage_events_workspace_business_started on context_processing_stage_events(workspace_id, business_id, started_at desc);
create index if not exists idx_stage_events_run_started on context_processing_stage_events(run_id, started_at);
create index if not exists idx_stage_events_job_id on context_processing_stage_events(job_id);
create index if not exists idx_stage_events_source_stage on context_processing_stage_events(source_id, stage);

-- context_quality_gate_results
create index if not exists idx_quality_gates_workspace_business_scope_status on context_quality_gate_results(workspace_id, business_id, gate_scope, status);
create index if not exists idx_quality_gates_run_id on context_quality_gate_results(run_id);
create index if not exists idx_quality_gates_source_document_id on context_quality_gate_results(source_document_id);
create index if not exists idx_quality_gates_fact_id on context_quality_gate_results(fact_id);

-- context_provider_circuit_breakers
create unique index idx_circuit_breakers_workspace_provider on context_provider_circuit_breakers(workspace_id, provider);
create index if not exists idx_circuit_breakers_state_half_open on context_provider_circuit_breakers(state, half_open_after);

-- context_audit_log
create index if not exists idx_audit_log_workspace_business_created on context_audit_log(workspace_id, business_id, created_at desc);
create index if not exists idx_audit_log_entity on context_audit_log(entity_type, entity_id);

-- context_upload_intents
create index if not exists idx_upload_intents_workspace_business on context_upload_intents(workspace_id, business_id);
create index if not exists idx_upload_intents_status on context_upload_intents(status);
create unique index if not exists idx_upload_intents_storage_path on context_upload_intents(storage_path);

-- context_idempotency_records
create index if not exists idx_idempotency_workspace_operation_key on context_idempotency_records(workspace_id, operation, idempotency_key);
create index if not exists idx_idempotency_expires on context_idempotency_records(expires_at);

-- business_context_meta_connections
create index if not exists idx_meta_connections_workspace on business_context_meta_connections(workspace_id);
create unique index if not exists idx_meta_connections_active_per_workspace on business_context_meta_connections(workspace_id) where status = 'active';

-- meta_oauth_states
create index if not exists idx_meta_oauth_states_workspace on meta_oauth_states(workspace_id);
create index if not exists idx_meta_oauth_states_expires on meta_oauth_states(expires_at);

-- meta_provider_code_hashes
create index if not exists idx_meta_code_hashes_oauth_state on meta_provider_code_hashes(oauth_state_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table businesses enable row level security;
alter table onboarding_sessions enable row level security;
alter table context_sources enable row level security;
alter table source_documents enable row level security;
alter table context_facts enable row level security;
alter table context_conflicts enable row level security;
alter table onboarding_questions enable row level security;
alter table business_profile_versions enable row level security;
alter table context_jobs enable row level security;
alter table context_processing_runs enable row level security;
alter table context_processing_stage_events enable row level security;
alter table context_quality_gate_results enable row level security;
alter table context_provider_circuit_breakers enable row level security;
alter table context_audit_log enable row level security;
alter table context_upload_intents enable row level security;
alter table context_idempotency_records enable row level security;
alter table business_context_meta_connections enable row level security;
alter table meta_oauth_states enable row level security;
alter table meta_provider_code_hashes enable row level security;

-- Helper: check workspace membership
create or replace function is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
  );
$$;

-- Helper: check workspace role
create or replace function has_workspace_role(ws_id uuid, min_role text)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = ws_id and user_id = auth.uid()
    and case min_role
      when 'viewer' then role in ('viewer', 'editor', 'admin', 'owner')
      when 'editor' then role in ('editor', 'admin', 'owner')
      when 'admin' then role in ('admin', 'owner')
      when 'owner' then role = 'owner'
      else false
    end
  );
$$;

-- ---- businesses ----

create policy "businesses_select" on businesses
  for select using (is_workspace_member(workspace_id));

create policy "businesses_insert" on businesses
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "businesses_update" on businesses
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "businesses_delete" on businesses
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- onboarding_sessions ----

create policy "onboarding_sessions_select" on onboarding_sessions
  for select using (is_workspace_member(workspace_id));

create policy "onboarding_sessions_insert" on onboarding_sessions
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "onboarding_sessions_update" on onboarding_sessions
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "onboarding_sessions_delete" on onboarding_sessions
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_sources ----

create policy "context_sources_select" on context_sources
  for select using (is_workspace_member(workspace_id));

create policy "context_sources_insert" on context_sources
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "context_sources_update" on context_sources
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "context_sources_delete" on context_sources
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- source_documents ----

create policy "source_documents_select" on source_documents
  for select using (is_workspace_member(workspace_id));

create policy "source_documents_insert" on source_documents
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "source_documents_update" on source_documents
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "source_documents_delete" on source_documents
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_facts ----

create policy "context_facts_select" on context_facts
  for select using (is_workspace_member(workspace_id));

create policy "context_facts_insert" on context_facts
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "context_facts_update" on context_facts
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "context_facts_delete" on context_facts
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_conflicts ----

create policy "context_conflicts_select" on context_conflicts
  for select using (is_workspace_member(workspace_id));

create policy "context_conflicts_insert" on context_conflicts
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "context_conflicts_update" on context_conflicts
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "context_conflicts_delete" on context_conflicts
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- onboarding_questions ----

create policy "onboarding_questions_select" on onboarding_questions
  for select using (is_workspace_member(workspace_id));

create policy "onboarding_questions_insert" on onboarding_questions
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "onboarding_questions_update" on onboarding_questions
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "onboarding_questions_delete" on onboarding_questions
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- business_profile_versions ----

create policy "business_profile_versions_select" on business_profile_versions
  for select using (is_workspace_member(workspace_id));

create policy "business_profile_versions_insert" on business_profile_versions
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "business_profile_versions_update" on business_profile_versions
  for update using (has_workspace_role(workspace_id, 'admin'));

create policy "business_profile_versions_delete" on business_profile_versions
  for delete using (has_workspace_role(workspace_id, 'owner'));

-- ---- context_jobs ----

create policy "context_jobs_select" on context_jobs
  for select using (is_workspace_member(workspace_id));

create policy "context_jobs_insert" on context_jobs
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "context_jobs_update" on context_jobs
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "context_jobs_delete" on context_jobs
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_processing_runs ----

create policy "processing_runs_select" on context_processing_runs
  for select using (is_workspace_member(workspace_id));

create policy "processing_runs_insert" on context_processing_runs
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "processing_runs_update" on context_processing_runs
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "processing_runs_delete" on context_processing_runs
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_processing_stage_events ----

create policy "stage_events_select" on context_processing_stage_events
  for select using (is_workspace_member(workspace_id));

create policy "stage_events_insert" on context_processing_stage_events
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "stage_events_update" on context_processing_stage_events
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "stage_events_delete" on context_processing_stage_events
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_quality_gate_results ----

create policy "quality_gates_select" on context_quality_gate_results
  for select using (is_workspace_member(workspace_id));

create policy "quality_gates_insert" on context_quality_gate_results
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "quality_gates_update" on context_quality_gate_results
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "quality_gates_delete" on context_quality_gate_results
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_provider_circuit_breakers ----

create policy "circuit_breakers_select" on context_provider_circuit_breakers
  for select using (workspace_id is null or is_workspace_member(workspace_id));

create policy "circuit_breakers_insert" on context_provider_circuit_breakers
  for insert with check (workspace_id is null or has_workspace_role(workspace_id, 'editor'));

create policy "circuit_breakers_update" on context_provider_circuit_breakers
  for update using (workspace_id is null or has_workspace_role(workspace_id, 'editor'));

create policy "circuit_breakers_delete" on context_provider_circuit_breakers
  for delete using (workspace_id is null or has_workspace_role(workspace_id, 'admin'));

-- ---- context_audit_log ----

create policy "audit_log_select" on context_audit_log
  for select using (is_workspace_member(workspace_id));

create policy "audit_log_insert" on context_audit_log
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "audit_log_update" on context_audit_log
  for update using (false);

create policy "audit_log_delete" on context_audit_log
  for delete using (has_workspace_role(workspace_id, 'owner'));

-- ---- context_upload_intents ----

create policy "upload_intents_select" on context_upload_intents
  for select using (is_workspace_member(workspace_id));

create policy "upload_intents_insert" on context_upload_intents
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "upload_intents_update" on context_upload_intents
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "upload_intents_delete" on context_upload_intents
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- context_idempotency_records ----

create policy "idempotency_records_select" on context_idempotency_records
  for select using (is_workspace_member(workspace_id));

create policy "idempotency_records_insert" on context_idempotency_records
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "idempotency_records_update" on context_idempotency_records
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "idempotency_records_delete" on context_idempotency_records
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- business_context_meta_connections ----

create policy "meta_connections_select" on business_context_meta_connections
  for select using (is_workspace_member(workspace_id));

create policy "meta_connections_insert" on business_context_meta_connections
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "meta_connections_update" on business_context_meta_connections
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "meta_connections_delete" on business_context_meta_connections
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- meta_oauth_states ----

create policy "meta_oauth_states_select" on meta_oauth_states
  for select using (is_workspace_member(workspace_id));

create policy "meta_oauth_states_insert" on meta_oauth_states
  for insert with check (has_workspace_role(workspace_id, 'editor'));

create policy "meta_oauth_states_update" on meta_oauth_states
  for update using (has_workspace_role(workspace_id, 'editor'));

create policy "meta_oauth_states_delete" on meta_oauth_states
  for delete using (has_workspace_role(workspace_id, 'admin'));

-- ---- meta_provider_code_hashes ----

create policy "meta_code_hashes_select" on meta_provider_code_hashes
  for select using (
    exists (
      select 1 from meta_oauth_states mos
      where mos.id = meta_provider_code_hashes.oauth_state_id
        and is_workspace_member(mos.workspace_id)
    )
  );

create policy "meta_code_hashes_insert" on meta_provider_code_hashes
  for insert with check (
    exists (
      select 1 from meta_oauth_states mos
      where mos.id = meta_provider_code_hashes.oauth_state_id
        and has_workspace_role(mos.workspace_id, 'editor')
    )
  );

create policy "meta_code_hashes_delete" on meta_provider_code_hashes
  for delete using (
    exists (
      select 1 from meta_oauth_states mos
      where mos.id = meta_provider_code_hashes.oauth_state_id
        and has_workspace_role(mos.workspace_id, 'admin')
    )
  );

-- ============================================================================
-- STORAGE BUCKETS AND POLICIES
-- ============================================================================

-- Create private storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('business-context-sources', 'business-context-sources', false, 52428800, null),
  ('business-context-archives', 'business-context-archives', false, 52428800, null)
on conflict (id) do nothing;

-- Storage ownership policy: users can only access files under their workspace path
-- Path format: {workspace_id}/{business_id}/sources/{source_id}/{checksum}-{filename}
-- Path format: {workspace_id}/{business_id}/archives/{source_id}/{artifact}

create policy "storage_sources_select" on storage.objects
  for select using (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_sources_insert" on storage.objects
  for insert with check (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_sources_delete" on storage.objects
  for delete using (
    bucket_id = 'business-context-sources'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

create policy "storage_archives_select" on storage.objects
  for select using (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_archives_insert" on storage.objects
  for insert with check (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
    )
  );

create policy "storage_archives_delete" on storage.objects
  for delete using (
    bucket_id = 'business-context-archives'
    and exists (
      select 1 from workspace_members wm
      where wm.workspace_id::text = (string_to_array(name, '/'))[1]
        and wm.user_id = auth.uid()
        and wm.role in ('admin', 'owner')
    )
  );

-- ============================================================================
-- SQL FUNCTIONS
-- ============================================================================

-- Atomic business profile version approval.
-- Validates required profile sections, supersedes current, inserts new current version, writes audit.
create or replace function approve_business_profile_version(
  p_workspace_id uuid,
  p_business_id uuid,
  p_version_id uuid,
  p_approver_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_version record;
  v_current record;
  v_profile jsonb;
  v_missing_sections text[];
  v_required_sections text[] := array[
    'business', 'offers', 'customers', 'conversion_journey',
    'economics', 'brand', 'creative_capacity', 'measurement'
  ];
  v_section text;
begin
  -- Lock the version row
  select * into v_version
  from business_profile_versions
  where id = p_version_id
    and workspace_id = p_workspace_id
    and business_id = p_business_id
  for update;

  if v_version is null then
    raise exception 'Version not found';
  end if;

  if v_version.status != 'draft' then
    raise exception 'Only draft versions can be approved, got %', v_version.status;
  end if;

  v_profile := v_version.profile;

  -- Validate required sections
  v_missing_sections := array[]::text[];
  foreach v_section in array v_required_sections loop
    if v_profile is null or not v_profile ? v_section then
      v_missing_sections := array_append(v_missing_sections, v_section);
    end if;
  end loop;

  if array_length(v_missing_sections, 1) > 0 then
    raise exception 'Missing required profile sections: %', array_to_string(v_missing_sections, ', ');
  end if;

  -- Supersede current version if one exists
  update business_profile_versions
  set status = 'superseded'
  where workspace_id = p_workspace_id
    and business_id = p_business_id
    and status = 'current';

  -- Set this version as current
  update business_profile_versions
  set status = 'current',
      approved_by = p_approver_id,
      approved_at = now()
  where id = p_version_id;

  -- Write audit event
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_approver_id, 'user', 'profile_version_approved',
    'business_profile_versions', p_version_id,
    jsonb_build_object('status', v_version.status),
    jsonb_build_object('status', 'current', 'approved_by', p_approver_id)
  );

  return jsonb_build_object(
    'ok', true,
    'version_id', p_version_id,
    'version', v_version.version,
    'status', 'current'
  );
end;
$$;

-- Restore a previous profile version by creating a new draft copy.
create or replace function restore_business_profile_version(
  p_workspace_id uuid,
  p_business_id uuid,
  p_source_version_id uuid,
  p_restorer_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_source record;
  v_next_version integer;
  v_new_id uuid;
begin
  -- Read the source version
  select * into v_source
  from business_profile_versions
  where id = p_source_version_id
    and workspace_id = p_workspace_id
    and business_id = p_business_id;

  if v_source is null then
    raise exception 'Source version not found';
  end if;

  -- Compute next version number
  select coalesce(max(version), 0) + 1 into v_next_version
  from business_profile_versions
  where workspace_id = p_workspace_id
    and business_id = p_business_id;

  -- Insert new draft version from snapshot
  insert into business_profile_versions (
    workspace_id, business_id, version, profile, profile_markdown,
    status, change_summary, created_by
  ) values (
    p_workspace_id, p_business_id, v_next_version,
    v_source.profile, v_source.profile_markdown,
    'draft', format('Restored from version %s', v_source.version),
    p_restorer_id
  ) returning id into v_new_id;

  -- Write audit event
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_restorer_id, 'user', 'profile_version_restored',
    'business_profile_versions', v_new_id,
    jsonb_build_object('source_version_id', p_source_version_id, 'source_version', v_source.version),
    jsonb_build_object('new_version_id', v_new_id, 'new_version', v_next_version, 'status', 'draft')
  );

  return jsonb_build_object(
    'ok', true,
    'new_version_id', v_new_id,
    'new_version', v_next_version,
    'status', 'draft'
  );
end;
$$;

-- ============================================================================
-- REMEDIATION TABLES (T006)
-- ============================================================================

-- Upload intents: track file upload lifecycle before source creation
create table if not exists context_upload_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_id uuid references context_sources(id),
  source_type text not null default 'upload',
  source_name text not null,
  document_class text not null,
  classification_source text not null default 'user_declared',
  file_name text not null,
  declared_mime_type text not null,
  expected_size_bytes bigint not null,
  storage_path text not null,
  created_by uuid not null,
  status text not null default 'pending',
  malware_scan_status text not null default 'pending',
  malware_scan_code integer,
  malware_scanned_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Idempotency records: prevent duplicate operations
create table if not exists context_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  state text not null default 'pending',
  resource_type text,
  resource_id uuid,
  response_status integer,
  response_body jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, operation, idempotency_key)
);

-- Meta connections: one active connection per workspace
create table if not exists business_context_meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  connected_by uuid not null,
  meta_user_id text not null,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  selected_ad_account_id text,
  account_metadata jsonb not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Meta OAuth states: temporary OAuth flow state
create table if not exists meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid not null,
  state_nonce_hash text not null,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  provider_code_hash text,
  created_at timestamptz not null default now()
);

-- Meta provider code hashes: hashed OAuth codes for verification
create table if not exists meta_provider_code_hashes (
  id uuid primary key default gen_random_uuid(),
  oauth_state_id uuid not null references meta_oauth_states(id) on delete cascade,
  provider_code_hash text not null,
  created_at timestamptz not null default now()
);
