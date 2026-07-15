-- Remediation tables RLS: enable, policies, grants, sanitized view.
-- ADDITIVE: does not modify any existing migration.
-- Covers: context_upload_intents, context_idempotency_records,
--         business_context_meta_connections, business_context_meta_oauth_states.
-- Also grants authenticated on existing business-context tables (needed for
-- RLS-enforced reads — Supabase requires explicit GRANT even with RLS enabled).

-- ============================================================================
-- WORKSPACE_MEMBERS — add SELECT policy for storage RLS subqueries
-- The workspace_members table has RLS enabled but no policies. Storage
-- policies query it directly (not via SECURITY DEFINER), so a SELECT
-- policy is required for authenticated users to read membership.
-- ============================================================================

drop policy if exists "workspace_members_select_authenticated" on workspace_members;

create policy "workspace_members_select_authenticated" on workspace_members
  for select using (auth.uid() = user_id or is_workspace_member(workspace_id));

-- ============================================================================
-- ENABLE RLS (new remediation tables only; existing tables already enabled)
-- ============================================================================

alter table context_upload_intents enable row level security;
alter table context_idempotency_records enable row level security;
alter table business_context_meta_connections enable row level security;
alter table business_context_meta_oauth_states enable row level security;

-- ============================================================================
-- GRANTs — authenticated role gets minimum required; service_role retains full
-- ============================================================================

-- context_upload_intents: authenticated SELECT only (server writes via service_role)
revoke insert, update, delete on context_upload_intents from authenticated;
grant select on context_upload_intents to authenticated;

-- context_idempotency_records: authenticated DENIED (server-only)
revoke all on context_idempotency_records from authenticated;

-- business_context_meta_oauth_states: authenticated DENIED (server-only)
revoke all on business_context_meta_oauth_states from authenticated;

-- business_context_meta_connections: authenticated DENIED (server-only)
revoke all on business_context_meta_connections from authenticated;

-- Existing business-context tables (authenticated needs explicit GRANT for RLS reads)
grant select on businesses to authenticated;
grant select on onboarding_sessions to authenticated;
grant select on context_sources to authenticated;
grant select on source_documents to authenticated;
grant select on context_facts to authenticated;
grant select on context_conflicts to authenticated;
grant select on onboarding_questions to authenticated;
grant select on business_profile_versions to authenticated;
grant select on context_jobs to authenticated;
grant select on context_processing_runs to authenticated;
grant select on context_processing_stage_events to authenticated;
grant select on context_quality_gate_results to authenticated;
grant select on context_provider_circuit_breakers to authenticated;
grant select on context_audit_log to authenticated;

-- Ensure service_role retains full access on remediation tables.
grant select, insert, update, delete on context_upload_intents to service_role;
grant select, insert, update, delete on context_idempotency_records to service_role;
grant select, insert, update, delete on business_context_meta_connections to service_role;
grant select, insert, update, delete on business_context_meta_oauth_states to service_role;

-- ============================================================================
-- RLS POLICIES — new remediation tables
-- ============================================================================

-- ---- context_upload_intents ----
-- Workspace members can SELECT; all writes are server-only (no write policies).

drop policy if exists "upload_intents_select" on context_upload_intents;
drop policy if exists "upload_intents_insert" on context_upload_intents;
drop policy if exists "upload_intents_update" on context_upload_intents;
drop policy if exists "upload_intents_delete" on context_upload_intents;

create policy "upload_intents_select" on context_upload_intents
  for select using (is_workspace_member(workspace_id));

-- ---- context_idempotency_records ----
-- Server-only: REVOKE ALL + no policies = fully denied for authenticated.

drop policy if exists "idempotency_select" on context_idempotency_records;
drop policy if exists "idempotency_insert" on context_idempotency_records;
drop policy if exists "idempotency_update" on context_idempotency_records;
drop policy if exists "idempotency_delete" on context_idempotency_records;
drop policy if exists "idempotency_records_select" on context_idempotency_records;
drop policy if exists "idempotency_records_insert" on context_idempotency_records;
drop policy if exists "idempotency_records_update" on context_idempotency_records;
drop policy if exists "idempotency_records_delete" on context_idempotency_records;

-- ---- business_context_meta_connections ----
-- Server-only: REVOKE ALL + no policies = fully denied for authenticated.
-- Safe columns exposed only via sanitized view (security_definer + auth.uid()).

drop policy if exists "meta_connections_select" on business_context_meta_connections;
drop policy if exists "meta_connections_insert" on business_context_meta_connections;
drop policy if exists "meta_connections_update" on business_context_meta_connections;
drop policy if exists "meta_connections_delete" on business_context_meta_connections;

-- ---- business_context_meta_oauth_states ----
-- Server-only: REVOKE ALL + no policies = fully denied for authenticated.

drop policy if exists "meta_oauth_select" on business_context_meta_oauth_states;
drop policy if exists "meta_oauth_insert" on business_context_meta_oauth_states;
drop policy if exists "meta_oauth_update" on business_context_meta_oauth_states;
drop policy if exists "meta_oauth_delete" on business_context_meta_oauth_states;

-- ============================================================================
-- Sanitized view: v_business_context_meta_connections
-- Hides encrypted_access_token from authenticated clients.
-- Uses SECURITY DEFINER (default) so the view runs as the owner, bypassing
-- base-table privilege checks. Workspace isolation is enforced by filtering
-- on auth.uid() membership in workspace_members — this gives the same
-- row-level scoping that security_invoker + base-table RLS would provide,
-- without requiring authenticated SELECT on the base table (which would
-- expose the encrypted token to direct queries).
-- ============================================================================

drop view if exists public.v_business_context_meta_connections;

create or replace view public.v_business_context_meta_connections as
  select mc.id, mc.workspace_id, mc.connected_by, mc.meta_user_id,
         mc.token_expires_at, mc.selected_ad_account_id,
         mc.account_metadata - array['access_token', 'token', 'refresh_token', 'client_secret'],
         mc.status, mc.created_at, mc.updated_at
  from public.business_context_meta_connections mc
  where mc.workspace_id in (
    select wm.workspace_id
    from public.workspace_members wm
    where wm.user_id = auth.uid()
  );

grant select on public.v_business_context_meta_connections to authenticated;
grant select on public.v_business_context_meta_connections to service_role;

-- ============================================================================
-- get_meta_connections — security_definer function
-- Bypasses base-table RLS to return safe columns only.
-- Enforces workspace membership internally; search_path pinned to public.
-- ============================================================================

create or replace function public.get_meta_connections(p_workspace_id uuid)
returns table (
  id uuid,
  workspace_id uuid,
  connected_by uuid,
  meta_user_id text,
  token_expires_at timestamptz,
  selected_ad_account_id text,
  account_metadata jsonb,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select mc.id, mc.workspace_id, mc.connected_by, mc.meta_user_id,
         mc.token_expires_at, mc.selected_ad_account_id,
         mc.account_metadata - array['access_token', 'token', 'refresh_token', 'client_secret'],
         mc.status, mc.created_at, mc.updated_at
  from business_context_meta_connections mc
  where mc.workspace_id = p_workspace_id
    and is_workspace_member(mc.workspace_id)
$$;

grant execute on function public.get_meta_connections(uuid) to authenticated;
grant execute on function public.get_meta_connections(uuid) to service_role;
