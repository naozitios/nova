-- Guard: reject cross-workspace reconciliation at RPC boundary.
-- Business must belong to the calling workspace; mismatch → stable error, zero writes.

create or replace function persist_fact_reconciliation(
  p_workspace_id uuid,
  p_business_id uuid,
  p_supersession_updates jsonb default '[]'::jsonb,
  p_fact_creations jsonb default '[]'::jsonb,
  p_conflicts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
as $$
declare
  v_item jsonb;
  v_superseded_ids uuid[] := '{}';
  v_created_ids uuid[] := '{}';
  v_conflict_ids uuid[] := '{}';
  v_new_id uuid;
begin
  -- Ownership guard: business must belong to workspace (before any writes)
  if not exists (
    select 1 from businesses
    where id = p_business_id
      and workspace_id = p_workspace_id
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'BUSINESS_WORKSPACE_MISMATCH',
        'message', 'Business does not belong to workspace'
      )
    );
  end if;

  -- Phase 1: apply supersession updates (set valid_to, verification_status)
  -- TS payload: { oldFactId, newFact: { verificationStatus, validTo } }
  for v_item in select jsonb_array_elements from jsonb_array_elements(p_supersession_updates)
  loop
    update context_facts
    set
      valid_to = coalesce(
        ((v_item -> 'newFact') ->> 'validTo')::timestamptz,
        now()
      ),
      verification_status = coalesce(
        (v_item -> 'newFact') ->> 'verificationStatus',
        'superseded'
      )
    where workspace_id = p_workspace_id
      and business_id = p_business_id
      and id = (v_item ->> 'oldFactId')::uuid;

    if found then
      v_superseded_ids := array_append(v_superseded_ids, (v_item ->> 'oldFactId')::uuid);
    end if;
  end loop;

  -- Phase 2: insert new facts (any constraint violation rolls back everything)
  for v_item in select jsonb_array_elements from jsonb_array_elements(p_fact_creations)
  loop
    -- TS payload keys: factKey, value, sourceId, sourceDocumentId,
    --   sourceExcerpt, evidenceLocator, confidence, verificationStatus,
    --   supersedesFactId, validFrom, validTo, createdBy
    insert into context_facts (
      workspace_id,
      business_id,
      fact_key,
      value,
      source_id,
      source_document_id,
      source_excerpt,
      evidence_locator,
      confidence,
      verification_status,
      supersedes_fact_id,
      valid_from,
      valid_to,
      created_by
    ) values (
      p_workspace_id,
      p_business_id,
      v_item ->> 'factKey',
      v_item -> 'value',
      (v_item ->> 'sourceId')::uuid,
      case when v_item ? 'sourceDocumentId'
        then (v_item ->> 'sourceDocumentId')::uuid
        else null
      end,
      v_item ->> 'sourceExcerpt',
      v_item -> 'evidenceLocator',
      (v_item ->> 'confidence')::numeric,
      coalesce(v_item ->> 'verificationStatus', 'extracted'),
      case when v_item ? 'supersedesFactId'
        then (v_item ->> 'supersedesFactId')::uuid
        else null
      end,
      coalesce(
        (v_item ->> 'validFrom')::timestamptz,
        now()
      ),
      case when v_item ? 'validTo'
        then (v_item ->> 'validTo')::timestamptz
        else null
      end,
      coalesce(v_item ->> 'createdBy', 'system')
    )
    returning id into v_new_id;

    v_created_ids := array_append(v_created_ids, v_new_id);
  end loop;

  -- Phase 3: insert open conflicts (skip duplicate business/key via partial unique index)
  for v_item in select jsonb_array_elements from jsonb_array_elements(p_conflicts)
  loop
    insert into context_conflicts (
      workspace_id,
      business_id,
      fact_key,
      fact_ids,
      status
    ) values (
      p_workspace_id,
      p_business_id,
      v_item ->> 'factKey',
      array(select jsonb_array_elements_text(v_item -> 'factIds'))::uuid[],
      'open'
    )
    on conflict (business_id, fact_key) where status = 'open'
    do nothing
    returning id into v_new_id;

    if v_new_id is not null then
      v_conflict_ids := array_append(v_conflict_ids, v_new_id);
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'superseded_fact_ids', to_jsonb(v_superseded_ids),
    'created_fact_ids', to_jsonb(v_created_ids),
    'conflict_ids', to_jsonb(v_conflict_ids)
  );
end;
$$;

-- Preserve invoker security: restrict execute to service_role only
revoke execute on function persist_fact_reconciliation(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function persist_fact_reconciliation(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
