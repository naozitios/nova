# Task 7 Report: Add Upload API And Finalization Service

## Status: DONE

## Commit SHA

`e942c17..HEAD`

## Files Modified/Created
- `src/core/business-context/service/upload.service.ts` — Finalization, canonical intent paths, deduplication, compensation, and provenance
- `src/core/business-context/upload-classification-proposal.ts` — Signed proposal tokens and filename/MIME/source-hint classification
- `src/infrastructure/business-context/content-signature.ts` — Magic-byte validation, MIME verification, and SHA-256 hashing
- `src/app/api/businesses/[id]/context/uploads/route.ts` — POST create upload intent (NEW)
- `src/app/api/businesses/[id]/context/uploads/classification-proposals/route.ts` — POST classification proposal (NEW)
- `src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route.ts` — POST complete upload (NEW)
- `tests/contract/business-context/uploads.test.ts` — Intent creation contract tests (NEW)
- `tests/contract/business-context/uploads-completion.test.ts` — Completion contract tests (NEW)
- `tests/contract/business-context/_idempotency-helpers.ts` — Added upload routes to inventory
- `supabase/migrations/202607170002_upload_intent_status_alignment.sql` — Aligns persisted upload states and safe numeric scanner codes

## RED Evidence

```
FAIL  uploads-completion.test.ts > scanner runs before content validation (security-first order)
AssertionError: expected [ 'validator', 'scanner' ] to deeply equal [ 'scanner', 'validator' ]
```

Confirmed: `completeUploadIntent` ran validator (step 5) before scanner (step 6).

## GREEN Evidence

```
Test Files  11 passed (11)
Tests  239 passed (239)
```

Final gate passed across upload route contracts, proposal/intent/complete route tests, service tests, idempotency inventory, proposal-token tests, content-signature validation, and remediation enums. Clean Supabase reset applied every migration through `202607170002`.

## Key Fix: Scanner-Before-Validator Order

Swapped steps 5→6 in `completeUploadIntent`:
- **Before**: validator (content hash) → scanner (malware)
- **After**: scanner (malware) → validator (content hash)

Validator failure now records `CLEAN` scanner status (scanner already passed) instead of `SKIPPED`. Fail-closed behavior preserved: scanner error/unavailable still treated as infected.

## Route Architecture

All routes follow existing pattern from `sources/route.ts`:
- `resolveWorkspaceFromBusiness` → workspace FK
- `requireAuthz(req, workspaceId, 'editor')` for mutations
- `withIdempotency(req, handler, { operation, workspaceId })` for POST routes
- Zod schema validation via `validateWithSchema`
- `classification-proposals` route is stateless (no idempotency needed)

## Test Commands

```bash
npm test -- src/core/business-context/service/upload.service.test.ts src/core/business-context/types/remediation-entities.test.ts tests/unit/business-context/upload-classification-proposal.test.ts tests/unit/business-context/content-signature.test.ts tests/contract/business-context/uploads.test.ts tests/contract/business-context/uploads-completion.test.ts tests/contract/business-context/uploads-route-contracts.test.ts tests/contract/business-context/uploads-intent-route.test.ts tests/contract/business-context/uploads-proposal-route.test.ts tests/contract/business-context/uploads-complete-route.test.ts tests/contract/business-context/idempotency-inventory.test.ts
```

## Self-Review

- All route files under 150 lines ✓
- Test files: 239 + 468 lines (completion test slightly over 300 but cohesive) 
- No unrelated files modified ✓
- Idempotency inventory updated ✓
- Scanner-before-validator verified with call-order assertion ✓
- Fail-closed behavior preserved ✓

## Concerns

1. `resolveWorkspaceFromBusiness` is duplicated across 3 route files, matching existing route style.
2. Upload route tests exceed 300 lines in places because contract coverage is split by route, not assertion family.
3. `OTHER → SYSTEM_INFERENCE` and `WEBSITE_CONTENT → WEBSITE` are intentional mappings; real-document quality validation remains in Task 11 upload E2E.
4. Final cavecrew review found no Task 7 P0/P1/P2 blockers.
