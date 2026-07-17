-- approve_onboarding_v1 (v2): atomic onboarding approval — nested profile from dotted fact_keys
-- Splits dotted fact_key (e.g. 'business.name') into section + field, merges fields under
-- nested JSON sections so validation sees top-level keys: business, market, advertising, economics.
-- Multiple fields in the same section merge (not overwrite) via jsonb_set + || operator.
-- All authorization, readiness, version, and audit behavior preserved unchanged.

create or replace function approve_onboarding_v1(
  p_workspace_id uuid,
  p_business_id uuid,
  p_approver_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_session record;
  v_profile jsonb := '{}'::jsonb;
  v_question record;
  v_missing_sections text[];
  v_required_sections text[] := array[
    'business', 'market', 'advertising', 'economics'
  ];
  v_section text;
  v_field text;
  v_dot_pos integer;
  v_open_conflict_count integer;
  v_current record;
  v_has_current boolean := false;
  v_next_version integer;
  v_new_id uuid;
  v_before jsonb;
begin
  -- 1. Find and lock the latest session for this business
  select * into v_session
  from onboarding_sessions
  where workspace_id = p_workspace_id
    and business_id = p_business_id
  order by started_at desc
  limit 1
  for update;

  if v_session is null then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'NO_SESSION',
        'message', 'No onboarding session found'
      )
    );
  end if;

  -- 2. Require ready_for_approval status
  if v_session.status != 'ready_for_approval' then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'SESSION_NOT_READY',
        'message', 'Session is not ready for approval (status: ' || v_session.status || ')'
      )
    );
  end if;

  -- 3. Compile profile from answered questions
  --    Dotted fact_key (e.g. 'business.name') → section='business', field='name'
  --    → profile = { "business": { "name": <answer> } }
  --    Multiple fields in same section merge via jsonb || (last-write-wins per key).
  --    Bare keys (no dot) set directly for backward compatibility.
  for v_question in
    select fact_key, answer
    from onboarding_questions
    where workspace_id = p_workspace_id
      and session_id = v_session.id
      and status = 'answered'
      and answer is not null
  loop
    v_dot_pos := position('.' in v_question.fact_key);
    if v_dot_pos > 0 then
      v_section := substr(v_question.fact_key, 1, v_dot_pos - 1);
      v_field   := substr(v_question.fact_key, v_dot_pos + 1);
      -- Merge field into existing section object (preserves other fields)
      v_profile := jsonb_set(
        v_profile,
        array[v_section],
        COALESCE(v_profile -> v_section, '{}'::jsonb) || jsonb_build_object(v_field, v_question.answer)
      );
    else
      -- Bare key: set directly (backward compat for non-dotted fact_keys)
      v_profile := v_profile || jsonb_build_object(v_question.fact_key, v_question.answer);
    end if;
  end loop;

  -- 4. Validate required sections
  v_missing_sections := array[]::text[];
  foreach v_section in array v_required_sections loop
    if v_profile is null or not v_profile ? v_section then
      v_missing_sections := array_append(v_missing_sections, v_section);
    elsif jsonb_typeof(v_profile -> v_section) = 'object'
          and (v_profile -> v_section)::text = '{}' then
      v_missing_sections := array_append(v_missing_sections, v_section);
    end if;
  end loop;

  if array_length(v_missing_sections, 1) > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'PROFILE_INCOMPLETE',
        'message', 'Missing required sections: ' || array_to_string(v_missing_sections, ', '),
        'details', jsonb_build_object(
          'missingSections', to_jsonb(v_missing_sections),
          'unresolvedConflicts', 0
        )
      )
    );
  end if;

  -- 5. Check for unresolved conflicts
  select count(*) into v_open_conflict_count
  from context_conflicts
  where workspace_id = p_workspace_id
    and business_id = p_business_id
    and status = 'open';

  if v_open_conflict_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'OPEN_CONFLICTS',
        'message', 'Unresolved conflicts must be resolved before approval',
        'details', jsonb_build_object(
          'missingSections', '[]'::jsonb,
          'unresolvedConflicts', v_open_conflict_count
        )
      )
    );
  end if;

  -- 6. Supersede current version if one exists
  select * into v_current
  from business_profile_versions
  where workspace_id = p_workspace_id
    and business_id = p_business_id
    and status = 'current';
  v_has_current := found;

  if v_has_current then
    v_before := jsonb_build_object('version', v_current.version, 'status', v_current.status);

    update business_profile_versions
    set status = 'superseded'
    where workspace_id = p_workspace_id
      and business_id = p_business_id
      and status = 'current';

    v_next_version := v_current.version + 1;
  else
    v_before := null;
    v_next_version := 1;
  end if;

  -- 7. Create new current profile version
  insert into business_profile_versions (
    workspace_id, business_id, version, profile, profile_markdown,
    status, change_summary, created_by, approved_by, approved_at
  ) values (
    p_workspace_id, p_business_id, v_next_version, v_profile, null,
    'current', 'Initial approved profile', p_approver_id, p_approver_id, now()
  )
  returning id into v_new_id;

  -- 8. Set session approved
  update onboarding_sessions
  set status = 'approved', completed_at = now()
  where id = v_session.id;

  -- 9. Audit: profile version approved
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_approver_id, 'user', 'profile_version_approved',
    'business_profile_version', v_new_id,
    v_before,
    jsonb_build_object('version', v_next_version, 'status', 'current')
  );

  -- 10. Audit: onboarding session approved
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_approver_id, 'user', 'onboarding_session_approved',
    'onboarding_session', v_session.id,
    jsonb_build_object('status', v_session.status),
    jsonb_build_object('status', 'approved')
  );

  -- 11. Return created version
  return jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_new_id,
      'workspaceId', p_workspace_id,
      'businessId', p_business_id,
      'version', v_next_version,
      'profile', v_profile,
      'profileMarkdown', null,
      'status', 'current',
      'changeSummary', 'Initial approved profile',
      'createdBy', p_approver_id,
      'createdAt', now(),
      'approvedBy', p_approver_id,
      'approvedAt', now()
    )
  );
end;
$$;

-- Restrict to service_role
revoke execute on function approve_onboarding_v1(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function approve_onboarding_v1(uuid, uuid, uuid) to service_role;
