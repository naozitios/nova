# Tasks: Dashboard Revised IA

**Input**: Design documents from `specs/004-dashboard-revised-ia/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/dashboard-ui.md`, `quickstart.md`

**Tests**: No test-first requirement in spec. Use `npm run lint` plus manual quickstart validation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create local Dashboard component and helper structure without touching backend, `adClient`, `campaignStore`, or unrelated routes.

- [X] T001 Create `src/components/dashboard/` directory for Dashboard-page-only UI components and helpers
- [X] T002 [P] Add `src/components/dashboard/dashboard-types.ts` with `DashboardTimeRange`, `DashboardMetric`, `PerformanceTrendPoint`, `DashboardAISummary`, `DashboardInsight`, and `RecentChangeItem` types
- [X] T003 [P] Add `src/components/dashboard/dashboard-utils.ts` with pure helpers for time range windows, analytics filtering, metric derivation, trend aggregation, summary derivation, insight derivation, and recent-change derivation
- [X] T004 [P] Add `src/components/dashboard/DashboardTimeRangeSelector.tsx` with required time range options and Last 7 days default support

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build supported-only data derivation that all Dashboard sections depend on.

**CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Implement required time range definitions in `src/components/dashboard/dashboard-utils.ts`, including Today, Yesterday, Last 7 days, This week, Last week, Month to date, and Custom
- [X] T006 Implement analytics filtering by selected range in `src/components/dashboard/dashboard-utils.ts` using existing `AnalyticsSnapshot.date` values only
- [X] T007 Implement metric derivation in `src/components/dashboard/dashboard-utils.ts` for supported Spend, Revenue, ROAS, CTR, Impressions, and Clicks values
- [X] T008 Ensure unsupported metrics such as CPA/CPL, Purchases/Leads, Pacing, CVR, Frequency, and Reach are omitted in `src/components/dashboard/dashboard-utils.ts`
- [X] T009 Implement trend point aggregation in `src/components/dashboard/dashboard-utils.ts` from existing `AnalyticsSnapshot` records
- [X] T010 Remove reliance on hardcoded dashboard comparison deltas from `src/app/dashboard/page.tsx`

**Checkpoint**: Dashboard data can be derived for the selected range without fake values, fake deltas, or data contract changes.

---

## Phase 3: User Story 1 - Scan current dashboard performance (Priority: P1) MVP

**Goal**: Render the revised top Dashboard IA with time range selector, supported metric cards, and a lightweight performance trend.

**Independent Test**: Open `/dashboard` and confirm the title, time range selector, supported metric cards, and trend render with no fake values or fake comparison text.

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `src/components/dashboard/DashboardMetricCard.tsx` for a single supported metric with optional comparison and optional `/campaigns` link
- [X] T012 [P] [US1] Create `src/components/dashboard/DashboardMetricGrid.tsx` for up to six supported metric cards with loading and no-metric states
- [X] T013 [P] [US1] Create `src/components/dashboard/DashboardTrendSection.tsx` using existing chart components or the current lightweight chart style
- [X] T014 [US1] Update `src/app/dashboard/page.tsx` to own selected time range state and render `DashboardTimeRangeSelector`
- [X] T015 [US1] Update `src/app/dashboard/page.tsx` to query existing `adClient.analytics.getLatest()` and `adClient.analytics.getTimeSeries()` without modifying `adClient`
- [X] T016 [US1] Update `src/app/dashboard/page.tsx` to render `DashboardMetricGrid` from derived supported metrics
- [X] T017 [US1] Update `src/app/dashboard/page.tsx` to render `DashboardTrendSection` from derived trend points
- [X] T018 [US1] Add dashboard-shaped loading, failed load, and `No performance data available` states in `src/app/dashboard/page.tsx` and Dashboard components
- [X] T019 [US1] Keep the page title exactly `Dashboard` and remove the current explanatory subtitle if it is not already required by the revised IA

**Checkpoint**: MVP dashboard top section works independently and satisfies route/title/data rules.

---

## Phase 4: User Story 2 - Understand performance implications (Priority: P2)

**Goal**: Add a frontend-only AI-style performance summary that references only available metrics.

**Independent Test**: Open `/dashboard` and confirm the summary has a headline, two to four bullets, and a suggested next step without mentioning unavailable metrics.

### Implementation for User Story 2

- [X] T020 [P] [US2] Create `src/components/dashboard/DashboardAISummaryCard.tsx` with headline, bullets, next step, loading, and empty states
- [X] T021 [US2] Implement rule-based summary derivation in `src/components/dashboard/dashboard-utils.ts` using only supported derived metrics
- [X] T022 [US2] Wire `DashboardAISummaryCard` into `src/app/dashboard/page.tsx` below the trend section
- [X] T023 [US2] Ensure summary copy does not imply a real AI integration or backend recommendation engine in `src/components/dashboard/DashboardAISummaryCard.tsx`

**Checkpoint**: AI-style summary works without real AI and without unsupported metric references.

---

## Phase 5: User Story 3 - Review and dismiss dashboard insights (Priority: P3)

**Goal**: Add one to three local Insight / Action cards with Review, Dismiss, and campaign-backed Deep Dive behavior.

**Independent Test**: Open `/dashboard`, review an insight, dismiss it, and follow Deep Dive only where an existing campaign id exists.

### Implementation for User Story 3

- [X] T024 [P] [US3] Create `src/components/dashboard/DashboardInsightCard.tsx` with category, severity, affected object, evidence preview, next step, Deep Dive, Review, and Dismiss controls
- [X] T025 [P] [US3] Create `src/components/dashboard/DashboardInsightDrawer.tsx` using existing drawer/sheet/dialog primitives for frontend-only details
- [X] T026 [P] [US3] Create `src/components/dashboard/DashboardInsightList.tsx` with one-to-three-card rendering and `No insights for this period.` empty state
- [X] T027 [US3] Implement deterministic insight derivation in `src/components/dashboard/dashboard-utils.ts` using existing analytics snapshots and existing campaign ids only
- [X] T028 [US3] Add existing `adClient.campaigns.list()` query to `src/app/dashboard/page.tsx` only for campaign-backed insight and handoff data
- [X] T029 [US3] Wire local dismissed insight state in `src/app/dashboard/page.tsx` so Dismiss hides cards for the current session
- [X] T030 [US3] Wire Review drawer open/close state in `src/app/dashboard/page.tsx`
- [X] T031 [US3] Ensure Deep Dive links route to `/campaigns/[id]` only when `campaignId` exists in `src/components/dashboard/DashboardInsightCard.tsx`
- [X] T032 [US3] Ensure no insight CTA executes approve, apply, pause, budget increase, launch, or other real platform action behavior

**Checkpoint**: Insight cards are actionable only through local review, local dismiss, and supported navigation.

---

## Phase 6: User Story 4 - Check recent changes (Priority: P4)

**Goal**: Add Recent Changes using existing data only, with an explicit empty state when real change history is unavailable.

**Independent Test**: Open `/dashboard` and confirm Recent Changes shows supported current-data items or exactly `No recent changes for this period.`

### Implementation for User Story 4

- [X] T033 [P] [US4] Create `src/components/dashboard/RecentChangeItem.tsx` for one recent change row with optional campaign detail link
- [X] T034 [P] [US4] Create `src/components/dashboard/RecentChangesList.tsx` with list rendering and `No recent changes for this period.` empty state
- [X] T035 [US4] Implement conservative recent-change derivation in `src/components/dashboard/dashboard-utils.ts` using only existing campaign created/updated timestamps or return an empty list
- [X] T036 [US4] Wire `RecentChangesList` into `src/app/dashboard/page.tsx` below insight cards
- [X] T037 [US4] Ensure recent change links route to `/campaigns/[id]` only when an existing campaign id is available
- [X] T038 [US4] Ensure no fake source, fake timestamp, fake description, or invented change type appears in Recent Changes

**Checkpoint**: Recent Changes satisfies the PRD whether supported current-data items exist or the empty state is required.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate PRD acceptance criteria and keep the Dashboard focused.

- [X] T039 Ensure `src/app/dashboard/page.tsx` does not modify `adClient`, `campaignStore`, mock data structures, global navigation, `/campaigns`, `/settings`, or unrelated pages
- [X] T040 Ensure the Dashboard does not add campaign table controls, saved views, scheduled reports, report scheduling, or a Campaigns table clone
- [X] T041 Ensure all visible metric, summary, insight, trend, and recent-change copy is backed by available current data
- [X] T042 Ensure empty states are explicit: `No performance data available`, `No insights for this period.`, and `No recent changes for this period.`
- [X] T043 Run `npm run lint` from repository root
- [ ] T044 Complete manual validation from `specs/004-dashboard-revised-ia/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Phase 1 and blocks all user stories.
- **US1 Dashboard Performance (Phase 3)**: Depends on Phase 2 and is the MVP.
- **US2 AI Summary (Phase 4)**: Depends on Phase 2 and can start after derived metric shape is stable.
- **US3 Insights (Phase 5)**: Depends on Phase 2 and campaign handoff data.
- **US4 Recent Changes (Phase 6)**: Depends on campaign data availability and can be validated independently through empty state.
- **Polish (Phase 7)**: Depends on selected story phases.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after foundation.
- **US2 (P2)**: Depends on supported metric derivation.
- **US3 (P3)**: Depends on analytics and optional campaign id data.
- **US4 (P4)**: Depends on existing campaign timestamps or explicit empty state behavior.

### Parallel Opportunities

- T002, T003, and T004 can run in parallel.
- T011, T012, and T013 can run in parallel.
- T020 can run while T021 is implemented.
- T024, T025, and T026 can run in parallel.
- T033 and T034 can run in parallel.

## Parallel Example: User Story 3

```bash
Task: "Create src/components/dashboard/DashboardInsightCard.tsx with category, severity, affected object, evidence preview, next step, Deep Dive, Review, and Dismiss controls"
Task: "Create src/components/dashboard/DashboardInsightDrawer.tsx using existing drawer/sheet/dialog primitives for frontend-only details"
Task: "Create src/components/dashboard/DashboardInsightList.tsx with one-to-three-card rendering and No insights for this period. empty state"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 only.
3. Validate `/dashboard` renders title, time range selector, metric cards, and trend with no fake values.
4. Stop for review before summary, insights, and recent changes if desired.

### Incremental Delivery

1. Add supported-only dashboard performance sections.
2. Add AI-style summary.
3. Add local insight cards and drawer.
4. Add Recent Changes or explicit empty state.
5. Run lint and quickstart validation.

## Notes

- The current dashboard hardcodes previous-period deltas; remove or hide them unless real comparison data is available.
- Current analytics data supports spend, revenue, impressions, clicks, CTR, ROAS, platform, campaign id, campaign name, and date.
- Do not edit `src/api/adClient.ts`, campaign store files, global navigation, `/campaigns`, or `/settings` for this feature.
