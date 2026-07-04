# Tasks: Campaigns Meta Table

**Input**: Design documents from `specs/001-campaigns-meta-table/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/campaigns-table-ui.md`, `quickstart.md`

**Tests**: No test-first requirement in spec. Use `npm run lint` plus manual quickstart validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create local Campaigns page component structure without touching backend or unrelated routes.

- [ ] T001 Create `src/components/campaigns/` directory for Campaigns-page-only UI components
- [ ] T002 [P] Add `src/components/campaigns/campaign-column-registry.ts` with supported and unsupported Meta-style column definitions
- [ ] T003 [P] Add `src/components/campaigns/campaign-table-types.ts` with `CampaignTableRow`, `ColumnDefinition`, `FilterState`, and `ExportRequest` types
- [ ] T004 [P] Add `src/components/campaigns/campaign-table-utils.ts` for row mapping, formatting, filtering, and CSV serialization helpers

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build shared row/column logic that all stories depend on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [ ] T005 Implement campaign-to-table-row mapping in `src/components/campaigns/campaign-table-utils.ts` using only current `Campaign` fields
- [ ] T006 Implement default supported column selection in `src/components/campaigns/campaign-column-registry.ts`
- [ ] T007 Implement unsupported column metadata and disabled reasons in `src/components/campaigns/campaign-column-registry.ts`
- [ ] T008 Implement stable formatting for status, platform, objective, dates, currency, and list values in `src/components/campaigns/campaign-table-utils.ts`

**Checkpoint**: Campaign rows and supported columns can be rendered without fake values.

---

## Phase 3: User Story 1 - View campaigns in an operational table (Priority: P1) MVP

**Goal**: Replace current Campaigns card list with a dense Ads Manager-style table.

**Independent Test**: Open `/campaigns` and confirm title, toolbar, filters placeholder, and table render with supported data only.

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create `src/components/campaigns/CampaignsToolbar.tsx` with compact plus, columns, and export controls
- [ ] T010 [P] [US1] Create `src/components/campaigns/CampaignsTable.tsx` with dense table layout, sticky-style header treatment, and row action slot
- [ ] T011 [US1] Replace card-list layout in `src/app/campaigns/page.tsx` with simple title, `CampaignsToolbar`, and `CampaignsTable`
- [ ] T012 [US1] Keep plus action routing to `/campaigns/new` in `src/components/campaigns/CampaignsToolbar.tsx`
- [ ] T013 [US1] Add campaign-name detail link and row action detail link to `/campaigns/[id]` in `src/components/campaigns/CampaignsTable.tsx`
- [ ] T014 [US1] Replace loading cards with table-shaped loading state in `src/components/campaigns/CampaignsTable.tsx`
- [ ] T015 [US1] Add no-campaigns empty state in `src/components/campaigns/CampaignsTable.tsx`

**Checkpoint**: MVP table view works independently and preserves create/detail navigation.

---

## Phase 4: User Story 2 - Filter campaigns using supported fields (Priority: P2)

**Goal**: Let users narrow the table using supported Campaign fields only.

**Independent Test**: Apply search, status, objective, platform, date range, and country filters and confirm row results update correctly.

### Implementation for User Story 2

- [ ] T016 [P] [US2] Create `src/components/campaigns/CampaignFilters.tsx` with search, status, objective, platform, date range, and country controls
- [ ] T017 [US2] Implement filter state ownership in `src/app/campaigns/page.tsx`
- [ ] T018 [US2] Implement supported filtering logic in `src/components/campaigns/campaign-table-utils.ts`
- [ ] T019 [US2] Add unsupported filter affordances for budget type, buying type, recommendations, and tracking issues in `src/components/campaigns/CampaignFilters.tsx`
- [ ] T020 [US2] Add no-filter-matches state in `src/components/campaigns/CampaignsTable.tsx`

**Checkpoint**: Filters work without inventing unsupported data.

---

## Phase 5: User Story 3 - Customize visible columns (Priority: P3)

**Goal**: Let users browse Meta-style column categories and toggle supported visible columns.

**Independent Test**: Open customizer, search columns, toggle supported columns, apply, then reset defaults.

### Implementation for User Story 3

- [ ] T021 [P] [US3] Create `src/components/campaigns/ColumnCustomizer.tsx` with search, categories, supported toggles, disabled unsupported columns, apply, and reset
- [ ] T022 [US3] Wire column customizer open/close state in `src/app/campaigns/page.tsx`
- [ ] T023 [US3] Apply selected supported columns to `src/components/campaigns/CampaignsTable.tsx`
- [ ] T024 [US3] Prevent unsupported columns from entering active visible columns in `src/components/campaigns/campaign-table-utils.ts`
- [ ] T025 [US3] Add reset-to-default behavior using `src/components/campaigns/campaign-column-registry.ts`

**Checkpoint**: Visible columns can change, but unsupported metrics never show fake values.

---

## Phase 6: User Story 4 - Export the current table (Priority: P4)

**Goal**: Export current filtered rows and visible columns through a frontend modal.

**Independent Test**: Filter table, choose CSV export, confirm file values match current visible table.

### Implementation for User Story 4

- [ ] T026 [P] [US4] Create `src/components/campaigns/ExportViewModal.tsx` with format choice, confirmation, disabled PDF, and success state
- [ ] T027 [US4] Wire export modal state in `src/app/campaigns/page.tsx`
- [ ] T028 [US4] Implement CSV generation for visible columns and filtered rows in `src/components/campaigns/campaign-table-utils.ts`
- [ ] T029 [US4] Disable export when no exportable rows or columns exist in `src/components/campaigns/ExportViewModal.tsx`
- [ ] T030 [US4] Add export success feedback in `src/components/campaigns/ExportViewModal.tsx`

**Checkpoint**: Export reflects current table view and uses no backend infrastructure.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate PRD acceptance criteria and keep the page polished.

- [ ] T031 Ensure `src/app/campaigns/page.tsx` does not modify `adClient`, `campaignStore`, create flow, detail flow, or global navigation
- [ ] T032 Verify active default columns omit unsupported PRD defaults in `src/components/campaigns/campaign-column-registry.ts`
- [ ] T033 Run `npm run lint` from repository root
- [ ] T034 Complete manual validation from `specs/001-campaigns-meta-table/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **US1 Table View (Phase 3)**: Depends on Phase 2 and is the MVP.
- **US2 Filters (Phase 4)**: Depends on Phase 2; can start after US1 table interface is stable.
- **US3 Columns (Phase 5)**: Depends on Phase 2; integrates with US1 table.
- **US4 Export (Phase 6)**: Depends on US1 and benefits from US2/US3 state.
- **Polish (Phase 7)**: Depends on selected story phases.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundation.
- **US2 (P2)**: Depends on table row model; can be validated independently through row count changes.
- **US3 (P3)**: Depends on column registry; can be validated independently through visible column changes.
- **US4 (P4)**: Depends on visible table state; best after US2 and US3.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel.
- T009 and T010 can run in parallel.
- T016 can run while T018 is implemented.
- T021 can run while page state wiring is prepared.
- T026 can run while CSV serialization is implemented.

## Parallel Example: User Story 1

```bash
Task: "Create src/components/campaigns/CampaignsToolbar.tsx with compact plus, columns, and export controls"
Task: "Create src/components/campaigns/CampaignsTable.tsx with dense table layout, sticky-style header treatment, and row action slot"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 only.
3. Validate `/campaigns` renders as a dense table with no fake values.
4. Stop for review before filters, column customization, and export if desired.

### Incremental Delivery

1. Add table MVP.
2. Add filters.
3. Add column customizer.
4. Add export.
5. Run lint and quickstart validation.

## Notes

- All active table values must come from existing current data.
- Unsupported metrics belong in disabled/unavailable column picker state only.
- Do not edit `src/api/adClient.ts`, `src/lib/campaign-engine/store.ts`, `src/app/campaigns/new/page.tsx`, or `src/app/campaigns/[id]/page.tsx` for this feature.
