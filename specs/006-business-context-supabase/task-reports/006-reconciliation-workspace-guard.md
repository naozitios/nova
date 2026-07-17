# Task 6: Reconciliation Workspace Guard

**Status**: DONE
**Date**: 2026-07-17
**Files touched**:
- `tests/integration/business-context/reconciliation-atomicity.test.ts` — +84 lines (cross-workspace isolation test)
- `supabase/migrations/202607170001_reconciliation_workspace_guard.sql` — new (workspace ownership guard)

## What

Guard `persist_fact_reconciliation` RPC against cross-workspace writes. Business must belong to the calling workspace; mismatch returns stable `{ok:false, error:{code:'BUSINESS_WORKSPACE_MISMATCH', message:'Business does not belong to workspace'}}` with zero side effects.

## Why

Without guard, a compromised or misrouted RPC call could write facts to workspace A under business B that belongs to workspace C. Atomicity (B29) proved facts can't partially persist, but workspace isolation was not enforced at the RPC boundary.

## TDD evidence

| Phase | Result |
|-------|--------|
| RED | Cross-workspace test fails: RPC returns FK violation (no guard yet). Expected `BUSINESS_WORKSPACE_MISMATCH`. |
| GREEN | Both reconciliation-atomicity tests pass (atomicity + cross-workspace guard). Onboarding question persistence tests pass. Full integration suite: 217/220 pass; 3 pre-existing failures (OpenRouter API, mock setup, doc count expectation). |

## Guard implementation

- Added `exists(select 1 from businesses where id = p_business_id and workspace_id = p_workspace_id)` check BEFORE the three-phase loops.
- Returns stable error JSON on failure — no updates, no inserts, no conflicts.
- Preserves existing atomic logic: supersession loop → fact insert loop → conflict insert loop → result.
- Grants unchanged: `service_role` only.
