// ---------------------------------------------------------------------------
// T015 — Source processing worker tests (US1)
// Covers: claim race, lease, heartbeat, retry wait, shutdown, stale recovery,
// and duplicate prevention.
//
// Uses real Supabase database + real JobRunner instances.
// Seeding/inspection via service role. Workers via real JobRunner.
// Tests verify worker-level claim behavior, not just DB state transitions.
//
// Tests split into sibling files:
//   - source-processing-worker.claim-lease.test.ts
//   - source-processing-worker.heartbeat-retry.test.ts
//   - source-processing-worker.shutdown-recovery.test.ts
//   - source-processing-worker.duplicate-prevention.test.ts
//
// Shared setup/helpers in:
//   - source-processing-worker.helpers.ts
// ---------------------------------------------------------------------------
