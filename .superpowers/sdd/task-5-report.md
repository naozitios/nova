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
