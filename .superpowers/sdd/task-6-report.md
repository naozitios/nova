# Task 6 — Reconciliation Ownership Gap (RED Proof)

## Test
`tests/integration/business-context/reconciliation-atomicity.test.ts`
> Cross-workspace reconciliation guard (B29) — reject mismatched business/workspace
> rejects cross-workspace RPC: business from workspace B called with workspace A (stable error, zero writes)

## RED Output (guard absent)

```
 FAIL  tests/integration/business-context/reconciliation-atomicity.test.ts > Cross-workspace reconciliation guard (B29) — reject mismatched business/workspace > rejects cross-workspace RPC: business from workspace B called with workspace A (stable error, zero writes)
AssertionError: expected { code: '23503', …(3) } to be null

- Expected:
null

+ Received:
{
  "code": "23503",
  "details": "Key (source_id)=(00000000-0000-0000-0000-000000000099) is not present in table \"context_sources\".",
  "hint": null,
  "message": "insert or update on table \"context_facts\" violates foreign key constraint \"context_facts_source_id_fkey\""
}

 ❯ tests/integration/business-context/reconciliation-atomicity.test.ts:243:21
    242|       // Stable error code — must not throw or return ok:true
    243|       expect(error).toBeNull();
    244|       expect(data).toBeDefined();

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed (2)
   Start at  04:35:18
   Duration  1.40s (test 0.95s, setup 31ms, transform 470ms, environment 405ms)
```

## Analysis

Without the ownership guard, the RPC attempts to insert a fact for `BIZ_B` (which belongs to `WS_B`) under `WS` (wrong workspace). The Postgres FK constraint `context_facts_source_id_fkey` fires first with code `23503`, before any stable application-level error is returned.

This proves:
1. No workspace/business ownership validation existed in the RPC
2. The only failure mode was an opaque FK violation (23503), not a stable error code
3. Callers could not distinguish "cross-workspace attack" from "missing source" or "any FK violation"

## Guard (restored)

The ownership check in `supabase/migrations/202607170001_reconciliation_workspace_guard.sql` adds a pre-write validation:

```sql
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
```

This runs before any writes, returning a stable error code that callers can match on.
