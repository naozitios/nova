-- approve_onboarding_v1 (v3): atomic onboarding approval with readiness enforcement
-- v3 adds full readiness recheck inside the transaction lock before any version writes:
--   EVIDENCE_SOURCE_REQUIRED  — at least one terminal evidence source
--   SOURCE_NOT_PROCESSED      — unprocessed evidence sources block
--   QUALITY_GATE_BLOCKING     — failed_blocking quality gates block
--   MISSING_REQUIRED_FACT     — required fact keys must be user_verified/verified
--   REQUIRED_KEY_UNKNOWN      — business.name cannot be null
-- Profile is compiled from active facts (user_verified/verified, valid_to is null),
-- not from onboarding_questions. Preserves v2 atomic sole-current, approved session,
-- two audits, and service_role-only execute.

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
  v_blocked boolean;
  v_entity_id uuid;

  -- Readiness constants (mirrors src/core/business-context/onboarding-readiness.ts)
  v_required_fact_keys text[] := array[
    'business.name',
    'market.primary',
    'advertising.primary_objective',
    'business.primary_outcome',
    'economics.monthly_meta_budget'
  ];
  v_unknown_disallowed_keys text[] := array[
    'business.name'
  ];
  v_evidence_source_types text[] := array[
    'website', 'brand_deck', 'brand_playbook', 'product_document',
    'campaign_brief', 'research_document', 'meta'
  ];
  v_terminal_source_statuses text[] := array[
    'processed', 'processed_with_warnings'
  ];
  v_key text;
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

  -- 3. EVIDENCE_SOURCE_REQUIRED — at least one terminal evidence source
  perform 1 from context_sources cs
  where cs.workspace_id = p_workspace_id
    and cs.business_id = p_business_id
    and cs.status = any(v_terminal_source_statuses)
    and cs.source_type = any(v_evidence_source_types);
  if not found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'EVIDENCE_SOURCE_REQUIRED',
        'message', 'At least one completed website, document, or Meta source is required. User answer and system inference sources cannot satisfy this requirement alone.'
      )
    );
  end if;

  -- 4. SOURCE_NOT_PROCESSED — unprocessed evidence sources block
  select cs.id into v_entity_id
  from context_sources cs
  where cs.workspace_id = p_workspace_id
    and cs.business_id = p_business_id
    and cs.source_type = any(v_evidence_source_types)
    and not (cs.status = any(v_terminal_source_statuses))
  limit 1;
  if found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'SOURCE_NOT_PROCESSED',
        'message', 'An evidence source is not yet processed.',
        'entityId', v_entity_id
      )
    );
  end if;

  -- 5. QUALITY_GATE_BLOCKING — failed_blocking quality gates block
  perform 1 from context_quality_gate_results qg
  where qg.workspace_id = p_workspace_id
    and qg.business_id = p_business_id
    and qg.status = 'failed_blocking';
  if found then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'QUALITY_GATE_BLOCKING',
        'message', 'A blocking quality gate has failed.',
        'entityId', (
          select qg2.id from context_quality_gate_results qg2
          where qg2.workspace_id = p_workspace_id
            and qg2.business_id = p_business_id
            and qg2.status = 'failed_blocking'
          limit 1
        )
      )
    );
  end if;

  -- 6. MISSING_REQUIRED_FACT + REQUIRED_KEY_UNKNOWN — compile active facts and check
  --    Active: verification_status in ('user_verified','verified') and valid_to is null.
  --    Pick highest confidence per fact_key (matches TypeScript pickActiveFacts).
  v_blocked := false;
  foreach v_key in array v_required_fact_keys loop
    -- Check: required fact must exist with active verification status
    if not exists (
      select 1 from context_facts cf
      where cf.workspace_id = p_workspace_id
        and cf.business_id = p_business_id
        and cf.fact_key = v_key
        and cf.verification_status in ('user_verified', 'verified')
        and cf.valid_to is null
    ) then
      return jsonb_build_object(
        'ok', false,
        'error', jsonb_build_object(
          'code', 'MISSING_REQUIRED_FACT',
          'message', 'Required fact "' || v_key || '" must be user-verified.'
        )
      );
    end if;

    -- Check: disallowed key cannot have null value
    if v_key = any(v_unknown_disallowed_keys) then
      if exists (
        select 1 from context_facts cf
        where cf.workspace_id = p_workspace_id
          and cf.business_id = p_business_id
          and cf.fact_key = v_key
          and cf.verification_status in ('user_verified', 'verified')
          and cf.valid_to is null
          and (cf.value is null or cf.value = 'null'::jsonb)
      ) then
        return jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'REQUIRED_KEY_UNKNOWN',
            'message', 'Required fact "' || v_key || '" cannot be marked as unknown.'
          )
        );
      end if;
    end if;
  end loop;

  -- 7. OPEN_CONFLICTS — unresolved conflicts block
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

  -- 8. Compile profile from active facts (user_verified/verified, valid_to is null)
  --    Dotted fact_key (e.g. 'business.name') → section='business', field='name'
  --    → profile = { "business": { "name": <value> } }
  --    Multiple fields in same section merge via jsonb || (last-write-wins per key).
  for v_question in
    select distinct on (cf.fact_key) cf.fact_key, cf.value
    from context_facts cf
    where cf.workspace_id = p_workspace_id
      and cf.business_id = p_business_id
      and cf.verification_status in ('user_verified', 'verified')
      and cf.valid_to is null
      and cf.value is not null
    order by cf.fact_key, cf.confidence desc
  loop
    v_dot_pos := position('.' in v_question.fact_key);
    if v_dot_pos > 0 then
      v_section := substr(v_question.fact_key, 1, v_dot_pos - 1);
      v_field   := substr(v_question.fact_key, v_dot_pos + 1);
      v_profile := jsonb_set(
        v_profile,
        array[v_section],
        COALESCE(v_profile -> v_section, '{}'::jsonb) || jsonb_build_object(v_field, v_question.value)
      );
    else
      v_profile := v_profile || jsonb_build_object(v_question.fact_key, v_question.value);
    end if;
  end loop;

  -- 9. Validate required sections
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

  -- 10. Supersede current version if one exists
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

  -- 11. Create new current profile version
  insert into business_profile_versions (
    workspace_id, business_id, version, profile, profile_markdown,
    status, change_summary, created_by, approved_by, approved_at
  ) values (
    p_workspace_id, p_business_id, v_next_version, v_profile, null,
    'current', 'Initial approved profile', p_approver_id, p_approver_id, now()
  )
  returning id into v_new_id;

  -- 12. Set session approved
  update onboarding_sessions
  set status = 'approved', completed_at = now()
  where id = v_session.id;

  -- 13. Audit: profile version approved
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_approver_id, 'user', 'profile_version_approved',
    'business_profile_version', v_new_id,
    v_before,
    jsonb_build_object('version', v_next_version, 'status', 'current')
  );

  -- 14. Audit: onboarding session approved
  insert into context_audit_log (
    workspace_id, business_id, actor_id, actor_type, event_type,
    entity_type, entity_id, before, after
  ) values (
    p_workspace_id, p_business_id, p_approver_id, 'user', 'onboarding_session_approved',
    'onboarding_session', v_session.id,
    jsonb_build_object('status', v_session.status),
    jsonb_build_object('status', 'approved')
  );

  -- 15. Return created version
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
