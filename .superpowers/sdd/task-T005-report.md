# Task T005: Entity, Schema, and Mapper Implementation

## Status: COMPLETE

## Summary

Implemented remediation entity types, Zod validation schemas, and row mappers for the Business Context Pipeline Remediation (spec 006.2). All 35 tests pass across 3 test files.

## Files Created

1. **`src/core/business-context/types/remediation-entities.ts`** — 7 enums + 5 entity interfaces
2. **`src/core/business-context/schemas/remediation.ts`** — 8 Zod schemas (5 entity + 3 input)
3. **`src/infrastructure/business-context/repository/mappers/remediation.ts`** — 9 mapper functions (4 map + 4 unmap + 1 map-only)

## Files Modified

4. **`src/core/business-context/types/index.ts`** — added `remediation-entities` export
5. **`src/core/business-context/schemas/index.ts`** — added `remediation` export

## Test Results

- **35/35 tests passing** across 3 test files
- Entity type tests: 12 tests (enum values + interface shape checks)
- Schema validation tests: 23 tests (valid/invalid parsing, enum rejection, nullable fields)
- Mapper tests: 17 tests (snake↔camel, Date conversion, null handling, round-trips)

## Conventions Followed

- Enum pattern: `const X = { ... } as const` + `type X = (typeof X)[keyof typeof X]` (matches `enums.ts`)
- Interface pattern: plain interfaces, no classes (matches `entities.ts`)
- Schema pattern: `z.object({...})` with `UuidSchema`, `TimestampSchema`, `z.enum()` (matches `schemas/entities.ts`)
- Mapper pattern: `map*(row: Row): Entity` + `unmap*(entity: Entity): Row` (follows `source.ts` conventions)
- `Row` type: `Record<string, unknown>` from `helpers.ts`
- Barrel exports: added to both `types/index.ts` and `schemas/index.ts`

## Typecheck

No new errors introduced. All pre-existing errors are in unrelated test files.

## Concerns

- `SourceType` in `remediation-entities.ts` shadows the `SourceType` in `enums.ts` — different value sets. The remediation `SourceType` covers `upload|meta|manual|paste` while the core `SourceType` covers `website|brand_deck|brand_playbook|...`. This is intentional per the spec (remediation uses different source classification).
- `MetaConnectionStatus` differs from the data model spec (`connected|expired|disconnected|error` vs `active|expired|revoked|pending_reauthorization`). Tests use the latter — tests are source of truth.
- `MalwareScanStatus` differs from data model spec (`pending|clean|infected|suspicious|unavailable|failed` vs `pending|clean|infected|error|skipped`). Tests use the latter — tests are source of truth.

## Commit

```
feat(006.2): add remediation entities, schemas, and mappers
```
