# Quickstart: Business Context Supabase Backend

## 1. Install Dependencies

Local Supabase CLI runs through Docker. It does not use hosted Supabase project resources until the repo is explicitly linked with `npx supabase link`.

```bash
npm install
```

After implementation adds dependencies, install updates with:

```bash
npm install @supabase/supabase-js vitest @vitest/coverage-v8
```

Supabase CLI can be run through `npx`; a global install is optional:

```bash
npx supabase --version
```

Python worker dependencies are installed separately:

```bash
python3 -m venv workers/paddleocr/.venv
workers/paddleocr/.venv/bin/pip install -r workers/paddleocr/requirements.txt
```

## 2. Configure Environment

Create local environment variables outside source control:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
SUPABASE_STORAGE_SOURCE_BUCKET=business-context-sources
SUPABASE_STORAGE_ARCHIVE_BUCKET=business-context-archives
FIRECRAWL_API_KEY=<server-side-firecrawl-key>
BUSINESS_CONTEXT_MAX_WEBSITE_PAGES=30
BUSINESS_CONTEXT_MAX_NORMALIZED_TEXT_MB=5
BUSINESS_CONTEXT_MAX_UPLOAD_MB=50
BUSINESS_CONTEXT_CREDIT_CEILING=admin-configured-local-value
PADDLEOCR_WORKER_MODE=cpu
PADDLEOCR_VL_ENABLED=false
```

No `SUPABASE_SERVICE_ROLE_KEY` value may use a `NEXT_PUBLIC_` prefix.

## 3. Start Supabase Locally

### Prerequisites

Docker must be running. The Supabase CLI orchestrates a Docker Compose stack — no hosted Supabase project is involved at this stage.

```bash
docker --version   # verify Docker is installed and running
```

### Local URLs

| Service         | URL                                              |
|-----------------|--------------------------------------------------|
| Project URL     | `http://127.0.0.1:54321`                         |
| REST (PostgREST)| `http://127.0.0.1:54321/rest/v1`                |
| GraphQL         | `http://127.0.0.1:54321/graphql/v1`             |
| Edge Functions  | `http://127.0.0.1:54321/functions/v1`           |
| Studio          | `http://127.0.0.1:54323`                         |
| Mailpit (email) | `http://127.0.0.1:54324`                         |
| DB direct       | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

### Anon Key and Service-Role Key

After `npx supabase start`, the CLI prints the local **Publishable** (anon) key and **Secret** (service_role) key. Copy these into your `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste-local-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<paste-local-secret-key>
```

**Rule:** `SUPABASE_SERVICE_ROLE_KEY` must never use a `NEXT_PUBLIC_` prefix. The service-role key bypasses RLS and must never be exposed to the browser.

### Start and Reset

```bash
npx supabase init
npx supabase start
npx supabase db reset
```

`supabase start` launches the following local services:

- **PostgreSQL 17** (port 54322) — primary database
- **PostgREST** (port 54321) — RESTful API for the database
- **GoTrue** — authentication and user management
- **Realtime** — WebSocket subscriptions for database changes
- **Storage** (S3-compatible) — file uploads and management
- **Supabase Studio** (port 54323) — web dashboard
- **Edge Runtime** — serverless edge functions
- **Mailpit** (port 54324) — local email testing (catches emails instead of sending)
- **Analytics** (port 54327) — local analytics
- **Imgproxy** — on-the-fly image transformations
- **Vector** — log aggregation

`supabase db reset` drops and recreates the database, runs all migrations, then runs `seed.sql`.

Expected result: the readiness migration (`202607140000_supabase_readiness.sql`) creates `workspaces`, `workspace_members`, and `check_readiness()`. The seed inserts two workspaces with members for RLS testing.

This local stack is the MVP database. Do not point Business Context endpoints at SQLite, libSQL, or an in-memory store.

## 3A. Later Hosted Supabase Migration

Only after local migrations and RLS tests pass, link to hosted Supabase:

```bash
npx supabase login          # authenticate with Supabase (browser OAuth flow)
npx supabase link           # link local project to hosted project (requires project ref)
npx supabase db push --dry-run  # preview SQL that would run on hosted DB
npx supabase db push        # apply pending migrations to hosted DB
```

`supabase link` prompts for a project ref (found in the hosted dashboard under Project Settings > API). The link is saved in `.supabase/.temp/project-ref`.

`supabase db push --dry-run` shows the migration diff without applying it. Review this output before running `db push` against production.

The commands above migrate schema only. **Production data, auth users, Storage files, and secrets require a separate migration runbook.** Specifically:

- **Data**: Use `pg_dump`/`pg_restore` or application-level migration scripts
- **Auth users**: Export from GoTrue and re-create via the Management API
- **Storage files**: Use the Storage API or S3-compatible tooling to migrate objects
- **Secrets**: Set via `npx supabase secrets set` in the hosted dashboard

## 4. Run Verification

```bash
npm run lint
npm run test            # vitest run
npm run test:watch      # vitest watch
npm run test:coverage   # vitest run --coverage
npm run build
npm run supabase:start  # npx supabase start
npm run supabase:stop   # npx supabase stop
npm run supabase:reset  # npx supabase db reset
npm run supabase:status # npx supabase status
workers/paddleocr/.venv/bin/pytest workers/paddleocr/tests
```

Expected result: lint, TypeScript tests, production build, and worker contract tests pass.

## 5. Manual API Smoke Test

1. Sign in locally and create or seed a workspace membership.
2. `POST /api/businesses` with business name, primary market, objective, business outcome, budget, and at least one evidence source.
3. `POST /api/businesses/:id/onboarding` to create a session.
4. `POST /api/businesses/:id/context/sources` to register a manual or website source.
5. `POST /api/businesses/:id/context/sources/:sourceId/process` to queue source processing.
6. `GET /api/context-jobs/:id` until the job succeeds.
7. `GET /api/businesses/:id/context/processing-runs?sourceId=:sourceId` and verify stage durations, attempts, provider request IDs, credits, warning counts, facts extracted, and quality gate summaries are visible.
8. `POST /api/businesses/:id/context/reconcile` to generate gaps/conflicts.
9. `GET /api/businesses/:id/onboarding/questions` and answer required questions.
10. `POST /api/businesses/:id/onboarding/compile` to create a draft.
11. `POST /api/businesses/:id/onboarding/approve` as owner/admin.
12. `GET /api/businesses/:id/context` and verify one `current` profile version is returned.

## 6. RLS Smoke Test

1. Seed two workspaces with different users.
2. Authenticate as user A and attempt to read user B's business by ID.
3. Expected result: API returns 404 or 403 and direct Supabase read under user A returns no rows.

## 7. Rollback Safety Check

1. Approve v1.
2. Add a correction and approve v2.
3. Restore v1.
4. Expected result: v3 is current, v1 and v2 remain queryable, and audit log records restore.

## 8. Operational Recovery Smoke Test

1. Seed a `running` job with an expired `heartbeat_at` and retryable `error_class`.
2. Run the job recovery sweep.
3. Expected result: the job records a `stalled` event, transitions to `retry_waiting`, sets `next_run_at` using exponential backoff with jitter, and does not duplicate source documents or facts.
4. Exhaust the same job's attempts and run the recovery sweep again.
5. Expected result: the job transitions to `dead_lettered`, the source outcome becomes `failed_permanent` or `blocked_needs_user_action` depending on error class, and the processing run remains inspectable.

## 9. Circuit Breaker Smoke Test

1. Record provider failures until the Firecrawl breaker threshold is crossed.
2. Queue a new website processing job.
3. Expected result: dispatch is blocked while the breaker is `open`, no Firecrawl credits are consumed, and the job waits with a provider-circuit error class.
4. Advance to `half_open_after` and run one probe.
5. Expected result: a successful probe closes the breaker; a failed probe reopens it.
