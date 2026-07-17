## Task 5 — RED Phase Report

**Date:** 2026-07-17
**File modified:** `tests/integration/business-context/approve-onboarding-atomic.test.ts`
**SQL/production files touched:** None

### What was added

5 integration test cases that prove the v2 `approve_onboarding_v1` RPC does NOT enforce readiness blockers. Each test seeds a valid session (`ready_for_approval`) with complete answered questions (so SQL's section/conflict checks pass), then adds a condition that `onboarding-readiness.ts` blocker logic would reject. Because the v2 SQL function has no readiness enforcement, all 5 tests see the RPC succeed when it should fail.

### Test cases

| # | Test name | Blocker code | Seed condition |
|---|-----------|-------------|----------------|
| 1 | rejects when no evidence source exists | `EVIDENCE_SOURCE_REQUIRED` | No `context_sources` rows |
| 2 | rejects when evidence source is not yet processed | `SOURCE_NOT_PROCESSED` | Source with `status=registered` (non-terminal) |
| 3 | rejects when required fact is not user-verified | `MISSING_REQUIRED_FACT` | Fact with `verification_status=extracted` |
| 4 | rejects when disallowed key is null | `REQUIRED_KEY_UNKNOWN` | Fact `business.name` with `value=null` |
| 5 | rejects when blocking quality gate exists | `QUALITY_GATE_BLOCKING` | Quality gate with `status=failed_blocking` |

### RED failures (5 of 11 tests fail)

All 5 fail on the first post-assertion — `countCurrentVersions()` returns 1 when 0 is expected — proving the v2 RPC created a version despite the readiness violation:

```
FAIL > rejects when no evidence source exists — EVIDENCE_SOURCE_REQUIRED
  expect(await countCurrentVersions()).toBe(0)
  received: 1

FAIL > rejects when evidence source is not yet processed — SOURCE_NOT_PROCESSED
  expect(await countCurrentVersions()).toBe(0)
  received: 1

FAIL > rejects when required fact is not user-verified — MISSING_REQUIRED_FACT
  expect(await countCurrentVersions()).toBe(0)
  received: 1

FAIL > rejects when disallowed key is null — REQUIRED_KEY_UNKNOWN
  expect(await countCurrentVersions()).toBe(0)
  received: 1

FAIL > rejects when blocking quality gate exists — QUALITY_GATE_BLOCKING
  expect(await countCurrentVersions()).toBe(0)
  received: 1
```

### Existing tests (6 pass)

All pre-existing tests (approve, supersede, session-not-ready, profile-incomplete, open-conflicts, duplicate-approval) continue passing. Failures are exclusively about missing readiness enforcement, not fixture or setup issues.

### Seed helpers added

- `seedSource(overrides)` — insert into `context_sources`
- `seedFact(sourceId, overrides)` — insert into `context_facts`
- `seedQualityGate(overrides)` — insert into `context_quality_gate_results`
- `countAuditEvents()` — count approval audit rows

### Cleanup

`afterAll` and `beforeEach` updated to delete from all seeded tables in FK-safe order.
