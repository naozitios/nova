# Quickstart: Business Context Pipeline Remediation

## Setup

T000 constitution amendment is approved in constitution v1.3.0. Local Docker/Compose must provide Supabase and private ClamAV 1.4.3 pinned by immutable image digest; required NextAuth, Supabase, encryption, scanner, and provider environment variables must pass strict startup validation.

```bash
npm install
npm run supabase:start
npm run supabase:reset
npm run malware-scanner:start
```

After implementation, development processes run separately:

```bash
npm run dev
npm run worker:business-context
```

## Verification

### Focused During-Wave

Unit tests run after each slice within a bounded wave. Use these while implementing individual modules:

```bash
npm run test -- src/core/business-context/
npm run test -- src/infrastructure/business-context/
npm run test -- src/di/container.test.ts
```

### Subsystem Gate

Integration and contract tests run after all slices in a wave assemble. Run these before moving to the next wave:

```bash
npm run test -- tests/integration/business-context/
npm run test -- tests/contract/business-context/
```

### User-Story E2E Gate

One E2E pass per completed user story (US1–US6). The E2E harness owns the entire app/worker lifecycle — it starts and stops the Next.js server and the business-context worker itself. Do not pre-start `npm run dev` or `npm run worker:business-context` before running E2E; the harness manages both. If stale test-owned processes remain after a prior failed run, use the harness cleanup path first; kill only confirmed test-owned processes rather than assuming they are on a specific localhost port. The harness creates real NextAuth sessions for HTTP checks and separate Supabase Auth users/JWTs for direct RLS checks. It also starts ClamAV and fails if scanner health or EICAR rejection cannot be proven.

```bash
npm run test:business-context:e2e
```

### Release Gate

Full suite, lint, build, quickstart smoke, and PRD 007 readiness audit. Run once after all waves complete:

```bash
npm run lint
npm run build
npm run test
npm run test:business-context:e2e
```

Credentialed benchmark (reports explicit `skipped` until release credentials exist):

```bash
BUSINESS_CONTEXT_RUN_PROVIDER_TESTS=1 npm run test:business-context:providers
```

Required CI workflow: `.github/workflows/business-context-provider-verification.yml`. It fails on skipped requested tests and uploads benchmark report.

## Expected Blocked Files

Scanned PDF/image:

```json
{"terminal_outcome":"blocked_needs_user_action","failure":{"code":"OCR_REQUIRED","retryable":false,"recommended_action":"PROVIDE_MANUAL_TEXT"}}
```

Legacy DOC/PPT/XLS:

```json
{"terminal_outcome":"blocked_needs_user_action","failure":{"code":"LEGACY_FORMAT_UNSUPPORTED","retryable":false}}
```

Originals remain private for manual supplementation or future reprocessing.

## PRD 007 Readiness Gate

1. Clean Supabase reset plus E2E passes.
2. Real user-JWT RLS matrix passes.
3. Corpus thresholds pass with excerpts.
4. Full required-operation contract inventory passes.
5. Durable idempotency inventory covers every mutation.
6. Meta worker credentials are workspace-scoped/encrypted.
7. Upload malware scanning passes clean/EICAR/unavailable fail-closed checks.
8. OCR/legacy states are actionable and honest.
