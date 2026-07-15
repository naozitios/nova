-- Grant table-level permissions to service_role for business context tables.
-- Without these GRANTs, the service_role key cannot INSERT/SELECT/UPDATE/DELETE
-- even though RLS is enabled (service_role bypasses RLS but still needs base
-- table permissions).

grant usage on schema public to service_role;

grant select, insert, update, delete on public.context_jobs to service_role;
grant select, insert, update, delete on public.context_sources to service_role;
grant select, insert, update, delete on public.source_documents to service_role;
grant select, insert, update, delete on public.context_facts to service_role;
grant select, insert, update, delete on public.context_conflicts to service_role;
grant select, insert, update, delete on public.context_processing_runs to service_role;
grant select, insert, update, delete on public.context_processing_stage_events to service_role;
grant select, insert, update, delete on public.context_quality_gate_results to service_role;
grant select, insert, update, delete on public.context_provider_circuit_breakers to service_role;
grant select, insert, update, delete on public.context_audit_log to service_role;
grant select, insert, update, delete on public.context_upload_intents to service_role;
grant select, insert, update, delete on public.context_idempotency_records to service_role;
grant select, insert, update, delete on public.businesses to service_role;
grant select, insert, update, delete on public.onboarding_sessions to service_role;
grant select, insert, update, delete on public.onboarding_questions to service_role;
grant select, insert, update, delete on public.business_profile_versions to service_role;
grant select, insert, update, delete on public.business_context_meta_connections to service_role;
grant select, insert, update, delete on public.business_context_meta_oauth_states to service_role;

-- Also grant on workspaces/workspace_members for test setup
grant select, insert, update, delete on public.workspaces to service_role;
grant select, insert, update, delete on public.workspace_members to service_role;
