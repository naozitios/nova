## Task 5 — RED Phase Report

**Date:** 2026-07-17
**File modified:** `tests/integration/business-context/approve-onboarding-atomic.test.ts`

### What was added

5 integration rejection cases against real Supabase, exercising the `approve_onboarding_v1` RPC. Each case seeds a valid session (`ready_for_approval`), complete answered questions (passes section/conflict checks), then asserts the RPC returns an exact error code and leaves version count, session status, and audit count unchanged.

| Test case | Expected error code | Assertion that fails (RED) |
|-----------|-------------------|---------------------------|
| No qualifying processed evidence source | `EVIDENCE_SOURCE_REQUIRED` | `data.ok === false` |
| Required source still processing | `SOURCE_NOT_PROCESSED` | `data.ok === false` |
| Required fact not user-verified | `MISSING_REQUIRED_FACT` | `data.ok === false` |
| business.name explicit unknown (null) | `REQUIRED_KEY_UNKNOWN` | `data.ok === false` |
| Blocking quality gate failure | `QUALITY_GATE_BLOCKING` | `data.ok === false` |

### RED confirmation

```
Tests  5 failed | 6 passed (11)
```

All 5 new cases fail at `expect(data.ok).toBe(false)` — v2 RPC returns `ok: true` because it has no readiness enforcement for evidence sources, fact verification, unknown disallowed keys, source processing status, or quality gate results.

The 6 pre-existing tests pass unchanged. RED cause is missing RPC checks, not setup issues.

### Helpers added

- `seedSource(overrides)` — inserts into `context_sources`
- `seedFact(sourceId, overrides)` — inserts into `context_facts`
- `seedQualityGate(overrides)` — inserts into `context_quality_gate_results`
- `countAuditEvents()` — counts audit rows for the workspace+business
- `beforeEach` / `afterAll` cleanup extended to cover `context_sources`, `context_facts`, `context_jobs`, `context_quality_gate_results`

### Next step (GREEN)

Task 5 Step 3: implement `approve_onboarding_v3` SQL function that rechecks readiness inside the transaction lock before version writes. The v3 RPC must enforce all 5 blockers above and return the exact error codes asserted here.

---

## Task 5 — GREEN Phase Report

**Date:** 2026-07-17
**File created:** `supabase/migrations/202607170000_approve_onboarding_v3_readiness.sql`
**File modified:** `tests/integration/business-context/approve-onboarding-atomic.test.ts`

### What was implemented

v3 `approve_onboarding_v1` SQL function replaces v2. Same signature `(uuid, uuid, uuid)`, same atomic structure, adds full readiness enforcement inside the transaction lock before any version writes.

**Readiness checks added (in order):**

1. **EVIDENCE_SOURCE_REQUIRED** — at least one source with `status in ('processed','processed_with_warnings')` AND `source_type in ('website','brand_deck','brand_playbook','product_document','campaign_brief','research_document','meta')`
2. **SOURCE_NOT_PROCESSED** — no evidence source type left in non-terminal status
3. **QUALITY_GATE_BLOCKING** — no `failed_blocking` quality gate results
4. **MISSING_REQUIRED_FACT** — all 5 required keys (`business.name`, `market.primary`, `advertising.primary_objective`, `business.primary_outcome`, `economics.monthly_meta_budget`) must have active facts (`verification_status in ('user_verified','verified')`, `valid_to is null`)
5. **REQUIRED_KEY_UNKNOWN** — `business.name` cannot have null/`'null'::jsonb` value
6. **OPEN_CONFLICTS** — no open conflicts (preserved from v2)

Profile compiled from active facts (not questions): `distinct on (fact_key) ... order by confidence desc`.

**Preserved from v2:** session lock `for update`, business lock, session status gate, section validation, conflict check, supersede current → insert sole current, session approved, two audit rows, service_role-only execute.

### Test changes

- Added `seedReadyEvidence()` helper: seeds terminal evidence source + all 5 required verified facts
- Updated existing tests (`approves session`, `supersedes`, `open conflicts`, `duplicate approval`) to call `seedReadyEvidence()` so readiness checks pass for their specific scenario
- `SOURCE_NOT_PROCESSED` test: seeds one terminal source (passes EVIDENCE_SOURCE_REQUIRED) + one non-terminal source (triggers SOURCE_NOT_PROCESSED)
- `REQUIRED_KEY_UNKNOWN` test: seeds all 5 required facts with user_verified status, business.name uses `'null'::jsonb` via raw psql (NOT NULL constraint prevents PostgREST JSON null)
- `seedFact` helper: changed `value: overrides.value ?? "Acme"` to `value: "value" in overrides ? overrides.value : "Acme"` so explicit `null` passes through

### GREEN confirmation

```
Test Files  2 passed (2)
     Tests  12 passed (12)
```

11 atomic tests + 1 profile-versions test all pass. All 5 new readiness rejection cases return exact error codes with no state changes.
