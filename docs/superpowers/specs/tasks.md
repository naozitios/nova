# Dashboard Compact Metrics, Fixed Charts, Custom Date - Implementation Tasks

## Phase 1: Setup

- [ ] T001 [P] Install vitest + @testing-library/react + jsdom, add test scripts to package.json
- [ ] T002 [P] Create vitest.config.ts for unit tests
- [ ] T003 [P] Verify agent-browser installed globally, add e2e script using agent-browser

## Phase 2: TDD - Chart Derivation Unit Tests (RED)

- [ ] T004 [US2] Write failing tests for deriveDashboardChartPoints() in dashboard-utils.test.ts
  - test: returns daily sorted points with roas, cpm, ctr fields
  - test: roas = revenue/spend when spend > 0, else 0
  - test: cpm = (spend/impressions)*1000 when impressions > 0, else 0
  - test: ctr = (clicks/impressions)*100 when impressions > 0, else 0
  - test: handles empty snapshots array
  - test: aggregates same-date snapshots before deriving

## Phase 3: TDD - Custom Date Range Unit Tests (RED)

- [ ] T005 [US3] Write failing tests for filterAnalyticsByCustomDateRange() in dashboard-utils.test.ts
  - test: filters snapshots inclusively by start/end date keys
  - test: returns empty array when no snapshots match
  - test: handles reversed from/to (swaps dates)
  - test: handles same-day range (single day)

## Phase 4: Implement Chart Helpers (GREEN)

- [ ] T006 [US2] Implement deriveDashboardChartPoints() in dashboard-utils.ts
- [ ] T007 [US2] Add DashboardChartPoint type to dashboard-types.ts

## Phase 5: Implement Custom Date Filtering (GREEN)

- [ ] T008 [US3] Implement filterAnalyticsByCustomDateRange() in dashboard-utils.ts
- [ ] T009 [US3] Update getDashboardRangeWindow() to accept custom date keys
- [ ] T010 [US3] Mark custom as supported in DASHBOARD_TIME_RANGES

## Phase 6: Compact Metric Cards

- [ ] T011 [US1] Shrink DashboardMetricCard padding, icon, text sizes via class changes
- [ ] T012 [US1] Update DashboardMetricGrid skeleton height to match compact cards

## Phase 7: Reusable Chart Card

- [ ] T013 [US2] Create DashboardLineChartCard.tsx using ChartContainer + Recharts LineChart
- [ ] T014 [US2] Support dual Y axes, custom formatters, chart config via props

## Phase 8: Chart Grid

- [ ] T015 [US2] Create DashboardChartGrid.tsx with 3 fixed chart cards
- [ ] T016 [US2] Wire Revenue vs ROAS, Spend vs CPM, Impressions vs CTR charts

## Phase 9: Custom Date Range UI

- [ ] T017 [US3] Update DashboardTimeRangeSelector to open Calendar popover on Custom
- [ ] T018 [US3] Add customDateRange state to dashboard page, pass to filtering

## Phase 10: Dashboard Page Integration

- [ ] T019 [US2] Replace DashboardTrendSection with DashboardChartGrid on page.tsx
- [ ] T020 [US2] Keep page.tsx as orchestration only - no inline Recharts

## Phase 11: E2E Tests

- [ ] T021 [P] Create Playwright test: dashboard loads with 6 compact metric cards
- [ ] T022 [P] Create Playwright test: 3 chart cards render with data
- [ ] T023 [P] Create Playwright test: charts side by side on desktop, stacked on mobile
- [ ] T024 [P] Create Playwright test: custom date range selection filters all sections
- [ ] T025 [P] Create Playwright test: incomplete custom date keeps previous range

## Phase 12: Final Verification

- [ ] T026 Run npm run lint, npm run build
- [ ] T027 Run all unit tests (vitest)
- [ ] T028 Run all E2E tests (playwright)
- [ ] T029 Review git diff - confirm frontend-only, no backend changes
