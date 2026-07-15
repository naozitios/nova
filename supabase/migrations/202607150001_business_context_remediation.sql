-- Business Context Pipeline Remediation migration
-- ADDITIVE only: new tables, new columns, new indexes/constraints
-- Preserves all existing rows and schema

-- ============================================================================
-- NEW TABLE: context_upload_intents
-- ============================================================================

create table if not exists context_upload_intents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  source_id uuid references context_sources(id) on delete set null,
  source_type text not null,
  source_name text not null,
  document_class text,
  classification_source text not null default 'user_selected',
  file_name text not null,
  declared_mime_type text not null,
  expected_size_bytes integer not null check (expected_size_bytes >= 1 and expected_size_bytes <= 52428800),
  storage_path text not null unique,
  created_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'uploaded', 'completed', 'expired', 'rejected')),
  malware_scan_status text not null default 'pending' check (malware_scan_status in ('pending', 'clean', 'infected', 'suspicious', 'unavailable', 'failed')),
  malware_scan_code text,
  malware_scanned_at timestamptz,
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table context_upload_intents is 'Tracks file upload intents with malware scanning workflow';
comment on column context_upload_intents.storage_path is 'Unique storage path: workspaces/{workspaceId}/businesses/{businessId}/uploads/{uploadIntentId}/{safeFileName}';

-- Indexes for context_upload_intents
create index if not exists idx_upload_intents_business_status on context_upload_intents(business_id, status);
create index if not exists idx_upload_intents_expires_at on context_upload_intents(expires_at);

-- ============================================================================
-- NEW TABLE: context_idempotency_records
-- ============================================================================

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

comment on table context_idempotency_records is 'Idempotency records for workspace/operation/key combinations';

-- ============================================================================
-- NEW TABLE: business_context_meta_connections
-- ============================================================================

create table if not exists business_context_meta_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  connected_by uuid not null,
  meta_user_id text not null,
  encrypted_access_token text not null,
  token_expires_at timestamptz,
  selected_ad_account_id text,
  account_metadata jsonb not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'disconnected', 'error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table business_context_meta_connections is 'Meta (Facebook) OAuth connections with encrypted token storage';

-- Partial unique index: one connected row per workspace
create unique index idx_meta_connections_workspace_connected
  on business_context_meta_connections(workspace_id)
  where status = 'connected';

-- ============================================================================
-- NEW TABLE: business_context_meta_oauth_states
-- ============================================================================

create table if not exists business_context_meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_by uuid not null,
  state_nonce_hash text not null unique,
  return_path text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  provider_code_hash text unique,
  created_at timestamptz not null default now()
);

comment on table business_context_meta_oauth_states is 'OAuth state nonce hashes for Meta callback verification';

-- ============================================================================
-- MODIFY TABLE: onboarding_sessions
-- ============================================================================

-- Add new columns
alter table onboarding_sessions add column if not exists mode text not null default 'initial';
alter table onboarding_sessions add column if not exists base_profile_version_id uuid references business_profile_versions(id) on delete set null;
alter table onboarding_sessions add column if not exists draft_profile_version_id uuid references business_profile_versions(id) on delete set null;

-- Partial unique index: one active session per business
create unique index if not exists idx_onboarding_sessions_business_active
  on onboarding_sessions(business_id)
  where status in ('created', 'scanning', 'extracting', 'awaiting_review', 'awaiting_answers', 'ready_for_approval');

-- ============================================================================
-- MODIFY TABLE: onboarding_questions
-- ============================================================================

-- Add new columns
alter table onboarding_questions add column if not exists generation_kind text;
alter table onboarding_questions add column if not exists prompt text;
alter table onboarding_questions add column if not exists control_type text;
alter table onboarding_questions add column if not exists options jsonb;
alter table onboarding_questions add column if not exists allows_unknown boolean not null default false;
alter table onboarding_questions add column if not exists answer_is_unknown boolean;
alter table onboarding_questions add column if not exists conflict_id uuid;
alter table onboarding_questions add column if not exists resulting_fact_id uuid;
alter table onboarding_questions add column if not exists generation_key text;
alter table onboarding_questions add column if not exists dismissed_at timestamptz;

-- Partial unique index: one open question per session/generation_key
create unique index if not exists idx_onboarding_questions_session_generation_open
  on onboarding_questions(session_id, generation_key)
  where status = 'open' and generation_key is not null;

-- ============================================================================
-- MODIFY TABLE: business_profile_versions
-- ============================================================================

-- Add new columns
alter table business_profile_versions add column if not exists base_version_id uuid references business_profile_versions(id) on delete set null;
alter table business_profile_versions add column if not exists onboarding_session_id uuid references onboarding_sessions(id) on delete set null;

-- Partial unique index: one draft per session
create unique index if not exists idx_profile_versions_session_draft
  on business_profile_versions(onboarding_session_id)
  where status = 'draft' and onboarding_session_id is not null;

-- ============================================================================
-- NEW CONSTRAINTS AND INDEXES
-- ============================================================================

-- One open context_conflicts row per business/fact_key
create unique index if not exists idx_context_conflicts_business_key_open
  on context_conflicts(business_id, fact_key)
  where status = 'open';

-- Workspace/job-type/idempotency uniqueness on context_jobs
create unique index if not exists idx_context_jobs_workspace_type_idempotency
  on context_jobs(workspace_id, job_type, idempotency_key);

-- Runnable job index on context_jobs (status, next_run_at, created_at)
create index if not exists idx_context_jobs_runnable
  on context_jobs(status, next_run_at, created_at)
  where status = 'queued';

-- Source polling index on context_sources (workspace_id, business_id, status, current_stage)
create index if not exists idx_context_sources_polling
  on context_sources(workspace_id, business_id, status, current_stage);

-- Active-fact index on context_facts (workspace_id, business_id, fact_key, verification_status, valid_to)
create index if not exists idx_context_facts_active_fact
  on context_facts(workspace_id, business_id, fact_key, verification_status)
  where valid_to is null and verification_status not in ('rejected', 'superseded');

-- Run index on context_processing_runs (workspace_id, source_id, started_at)
create index if not exists idx_processing_runs_workspace_source_started
  on context_processing_runs(workspace_id, source_id, started_at desc);

-- Question index on onboarding_questions (workspace_id, session_id, status, priority)
create index if not exists idx_onboarding_questions_workspace_session_status_priority
  on onboarding_questions(workspace_id, session_id, status, priority desc);
