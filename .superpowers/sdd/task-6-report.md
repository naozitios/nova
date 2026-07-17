# Task 6 RED Phase A — Regression Test Report

## Files Modified
- `tests/unit/business-context/service.test.ts` — added `createBusiness` website job `stageTimeoutSeconds=30` assertion
- `src/infrastructure/business-context/job-runner/handlers/source-processing.handler.test.ts` — changed `blocked_needs_user_action` handler terminalStatus assertion from `failed_permanent` to `blocked_needs_user_action`

## Expected RED Failures

### 1. `source-processing.handler.test.ts` — blocked handler terminalStatus mismatch
- **Test:** `returns blocked_needs_user_action terminalStatus when source is blocked`
- **Location:** line 145
- **Expected:** `'blocked_needs_user_action'`
- **Actual:** `'failed_permanent'`
- **Root cause:** `source-processing.handler.ts:84` returns `terminalStatus: 'failed_permanent'` for blocked sources
- **Fix:** Change handler to return `terminalStatus: 'blocked_needs_user_action'` when `result.data.status === 'blocked_needs_user_action'`

### 2. `source-processing.handler.test.ts` — duplicate blocked handler terminalStatus mismatch
- **Test:** `returns blocked_needs_user_action terminalStatus when source is blocked for user action`
- **Location:** line 161
- **Expected:** `'blocked_needs_user_action'`
- **Actual:** `'failed_permanent'`
- **Root cause:** Same as #1 — handler hardcodes `failed_permanent`

### 3. `service.test.ts` — website job stageTimeoutSeconds (ALREADY PASSING)
- **Test:** `creates website job with stageTimeoutSeconds=30 when websiteUrl provided`
- **Status:** PASS — implementation already has `stageTimeoutSeconds: 30` at `onboarding.service.ts:91`
- **Note:** No RED gap for this assertion

## Test Results Summary
```
Test Files  1 failed | 1 passed (2)
      Tests  3 failed | 43 passed (46)
```

## Gaps Exposed
1. Handler maps `blocked_needs_user_action` source status → `failed_permanent` job terminalStatus (wrong)
2. Handler should propagate the source's terminal status as the job's terminal status
