# Testing Taxonomy

Lane rules, commands, naming, and environment gates for the Nova test suite.

## Commands

| Command                          | What runs                      | Requires Supabase |
| -------------------------------- | ------------------------------ | ----------------- |
| `npm test`                       | unit + contract (fast default) | No                |
| `npm run test:unit`              | unit only                      | No                |
| `npm run test:contract`          | contract only                  | No                |
| `npm run test:integration`       | integration only               | Yes               |
| `npm run test:rls`               | RLS only                       | Yes               |
| `npm run test:e2e`               | e2e only                       | Yes               |
| `npm run test:all`               | all Vitest lanes               | Yes               |
| `npm run test:coverage`          | all lanes with coverage        | Yes               |
| `pytest workers/document-processing/tests` | Python worker tests | No |

DB-backed lanes (integration, rls, e2e) run serially (`fileParallelism: false`).
Unit and contract lanes run in parallel (`fileParallelism: true`).

## Lanes

### Unit

Pure logic. No Supabase, no network, no real filesystem (tiny local parser fixtures excepted).

**Locations:**

- `src/**/*.test.ts` -- colocated pure core tests
- `tests/unit/**/*.test.ts` -- broader pure unit tests

**Rules:**

- Fakes behind ports are fine
- Fast and parallel-safe

### Contract

API/request/response/service shape validation. Fakes or in-memory doubles behind ports.

**Location:** `tests/contract/**/*.test.ts`

**Rules:**

- No real Supabase unless promoted to integration
- Validate: request shape, response shape, authorization branch behavior, idempotency semantics

### Integration

Real local Supabase. Repositories, migrations, persisted job state, storage, database-backed workflows.

**Location:** `tests/integration/**/*.test.ts`

**Rules:**

- Serial
- Requires Supabase env

### RLS

Tenant isolation and role-specific access. Real anon + service clients.

**Location:** `tests/rls/**/*.test.ts`

**Rules:**

- Uses shared auth/user/workspace fixtures
- Avoids testing business workflow already covered elsewhere
- Serial
- Requires Supabase env

### E2E

Full workflow smoke and resilience paths only. Few, high-value.

**Location:** `tests/e2e/**/*.e2e.test.ts`

**Rules:**

- Serial, opt-in for local runs
- Named by user-visible behavior

### Worker

Python worker tests owned by pytest.

**Location:** `workers/document-processing/tests/**/*.py`

**Rules:**

- Contract tests validate worker input/output shape
- Representative document tests may be marked benchmark/slow

## File Naming

Behavior-first names. Ticket IDs and wave labels do not drive filenames.

Pattern: `<behavior>.<lane>.test.ts` (TypeScript) or `<behavior>.py` (worker)

Examples:

```
job-runner-resilience.e2e.test.ts
workspace-isolation.rls.test.ts
context-jobs.integration.test.ts
business-profile-approval.contract.test.ts
```

Test names read like behavior specs:

```ts
it('denies cross-workspace context source reads', async () => {});
it('retries transient provider failures with backoff', async () => {});
it('creates one current profile version after approval', async () => {});
```

## Fixtures and Harness

Shared helpers live under `tests/harness/`. Keep them small and composable.

**Modules:**

- `supabase-env.ts` -- env resolution, service/anon clients, availability check
- `auth-fixtures.ts` -- create/delete users, issue JWTs, create authed clients
- `workspace-fixtures.ts` -- workspaces, businesses, memberships
- `job-fixtures.ts` -- context job CRUD with valid defaults
- `cleanup.ts` -- reverse-order cleanup tracker
- `builders.ts` -- domain object builders for valid defaults

**Rules:**

- Builders return valid defaults. Tests override only relevant fields.
- Cleanup is automatic and reverse-order. Tests never rely on prior test state.
- Shared seed rows may be idempotent. Mutable rows unique per test or cleaned after.

Good pattern:

```ts
const job = await createContextJob({ status: 'running', attempt_count: 1 });
```

## Environment Gates

| Lane        | Missing Supabase behavior              |
| ----------- | -------------------------------------- |
| unit        | Must not skip (no Supabase needed)     |
| contract    | Must not skip (no Supabase needed)     |
| integration | Skip with setup guidance if env absent |
| rls         | Skip with setup guidance if env absent |
| e2e         | Skip with setup guidance if env absent |

**DB lanes invoked explicitly with missing env:** fail fast with actionable message.

**Provider tests with external API keys:** separate from normal integration. Missing keys skip only provider-specific suites.

## Migration Reference

1. `docs/testing.md` -- this document
2. Vitest project split + package scripts (no test body changes)
3. Verify discovery counts per lane, no test lost
4. Extract shared Supabase env + cleanup helpers
5. Migrate integration job tests to shared job fixtures
6. Migrate RLS tests to shared auth/workspace fixtures
7. Rename ticket-coded files to behavior names
8. Move misplaced tests to correct lanes
9. CI lanes after local commands stable
