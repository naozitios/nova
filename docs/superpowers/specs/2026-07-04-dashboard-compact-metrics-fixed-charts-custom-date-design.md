# Dashboard Compact Metrics, Fixed Charts, and Custom Date Design

## Status

Approved for spec writing on 2026-07-04. Implementation not started in this spec step.

## Context

The active dashboard page is `src/app/dashboard/page.tsx`. It is a client component that fetches analytics and campaign data through existing TanStack Query hooks and `adClient`:

- `adClient.analytics.getLatest()`
- `adClient.analytics.getTimeSeries()`
- `adClient.campaigns.list()`

Current dashboard components live under `src/components/dashboard/`. Shared shadcn-style UI primitives already exist under `src/components/ui/`, including `chart.tsx`, `calendar.tsx`, `popover.tsx`, `select.tsx`, `sheet.tsx`, `button.tsx`, and `skeleton.tsx`.

The dashboard currently has one custom HTML bar-style trend section. It does not yet use the existing shadcn chart primitives, even though `src/components/ui/chart.tsx` is present and `recharts` is installed.

`Custom` date range is currently greyed out because `src/components/dashboard/dashboard-utils.ts` defines it as:

```ts
{ id: 'custom', label: 'Custom', supported: false, disabledReason: 'Custom dates are not available yet' }
```

`filterAnalyticsByTimeRange()` only accepts a predefined `DashboardTimeRangeId`; `getDashboardRangeWindow()` returns `null` for `custom`, so custom ranges cannot currently return data.

## Goals

1. Reduce the visual size of the six dashboard metric cards while keeping all six standardized.
2. Replace the single current trend chart with three fixed shadcn/Recharts line charts:
   - Revenue vs ROAS
   - Spend vs CPM
   - Impressions vs CTR
3. Show the three charts side by side on large screens, with responsive stacking on smaller screens.
4. Enable Custom date range selection using the existing calendar UI and keep filtering frontend-only.
5. Keep all work targeted, small, and reusable.

## Non-Goals

1. No backend/API/schema/database changes.
2. No chart customization drawer in this iteration.
3. No user-saved chart configuration.
4. No migration from TanStack Query to RTK Query or Redux Toolkit.
5. No unrelated dashboard redesign.
6. No campaign page changes.
7. No broad style-system changes outside the dashboard and directly reused UI primitives.

## Scope Guards

These constraints are mandatory for implementation:

- Frontend only. Use existing analytics time series data already available to the dashboard.
- Prefer smallest targeted edits over rewrites.
- Do not put chart derivation, chart rendering, custom date selection, and dashboard orchestration into one monolith file.
- Reuse existing components and functions first:
  - `DashboardMetricCard`
  - `DashboardMetricGrid`
  - `DashboardTimeRangeSelector`
  - `Calendar`
  - `Popover`
  - `ChartContainer`
  - `ChartTooltip`
  - `ChartTooltipContent`
  - `ChartLegend`
  - `ChartLegendContent`
  - existing dashboard utility format/filter patterns
- Add small focused helpers only when existing helpers cannot cleanly do the job.
- Keep public types narrow and dashboard-specific.
- Do not add new dependencies.
- Do not alter unrelated dirty worktree files.

## Proposed Architecture

Keep `src/app/dashboard/page.tsx` as orchestration only. It should own dashboard state, call queries, derive memoized dashboard data, and render dashboard sections. It should not contain chart SVG/Recharts markup or date-picker internals.

Dashboard-specific implementation should stay in `src/components/dashboard/`:

- `DashboardMetricCard.tsx`: small class changes only.
- `DashboardMetricGrid.tsx`: small grid/skeleton sizing changes only.
- `DashboardTimeRangeSelector.tsx`: extend to support a custom range popover while preserving current select behavior.
- New focused chart section/component files if needed, for example:
  - `DashboardChartGrid.tsx`: layout/loading/error/empty wrapper for the three charts.
  - `DashboardLineChartCard.tsx`: reusable shadcn/Recharts chart card for two-series line charts.
- `dashboard-types.ts`: add narrow chart/date types.
- `dashboard-utils.ts`: add narrow derivation helpers for custom date windows and chart points.

The exact file split can be adjusted during implementation, but no single component should grow into a mixed orchestration/rendering/derivation monolith.

## Metric Card Design

The existing six cards stay in place and keep the same metric order and data source. The goal is density, not redesign.

Target changes:

- Reduce card padding from large dashboard-card spacing to compact spacing.
- Reduce icon container and icon size.
- Reduce metric value text size one step.
- Reduce vertical gaps between label, value, and description.
- Keep all cards identical height/spacing.
- Update loading skeleton height to match compact cards.

Expected implementation shape:

- Edit `DashboardMetricCard.tsx` class names only.
- Edit `DashboardMetricGrid.tsx` grid gap and skeleton height only if needed.
- Do not change `DashboardMetric` data model unless necessary.

## Fixed Chart Design

The current `DashboardTrendSection` should be replaced or refactored into a three-chart section that uses shadcn chart primitives, per https://ui.shadcn.com/charts/line#charts#charts.

Each chart card should use:

```tsx
<ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
  <LineChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
    <CartesianGrid vertical={false} />
    <XAxis dataKey="label" />
    <YAxis />
    <ChartTooltip content={<ChartTooltipContent />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Line dataKey="..." stroke="var(--color-...)" strokeWidth={2} dot={false} />
  </LineChart>
</ChartContainer>
```

The implementation should adapt this pattern to this repository's existing `src/components/ui/chart.tsx` API.

### Chart 1: Revenue vs ROAS

Series:

- `revenue`: daily revenue sum.
- `roas`: daily revenue divided by daily spend.

Label:

- Title: `Revenue vs ROAS`
- Description: `Daily revenue and return on ad spend for the selected range.`

### Chart 2: Spend vs CPM

Series:

- `spend`: daily spend sum.
- `cpm`: daily spend divided by impressions, multiplied by 1000.

Label:

- Title: `Spend vs CPM`
- Description: `Daily spend and cost per thousand impressions for the selected range.`

### Chart 3: Impressions vs CTR

Series:

- `impressions`: daily impressions sum.
- `ctr`: daily clicks divided by impressions, multiplied by 100.

Label:

- Title: `Impressions vs CTR`
- Description: `Daily reach and click-through rate for the selected range.`

## Chart Data Derivation

Extend the existing daily grouping approach used by `derivePerformanceTrendPoints()`.

Input:

- `AnalyticsSnapshot[]` after selected date filtering.

Output:

- Daily sorted chart points, one point per date.

Required fields:

- `date`
- `label`
- `revenue`
- `spend`
- `impressions`
- `clicks`
- `roas`
- `cpm`
- `ctr`

Safe formulas:

- `roas = spend > 0 ? revenue / spend : 0`
- `cpm = impressions > 0 ? (spend / impressions) * 1000 : 0`
- `ctr = impressions > 0 ? (clicks / impressions) * 100 : 0`

This can replace `PerformanceTrendPoint` or extend it, whichever creates the smallest targeted diff. Avoid duplicate grouping logic if possible.

## Chart Layout

Large screens:

- Three chart cards side by side.
- Use a responsive grid such as `grid-cols-1 lg:grid-cols-3`.

Medium screens:

- Either two columns then one card, or single column if readability is better.

Mobile:

- Single column.
- Keep each chart full-width and touch-friendly.

Chart cards should share one reusable shell for title, description, loading, empty, and error states.

## Dual-Axis Consideration

The requested pairs mix large absolute values with ratio metrics. The chart component should support two Y axes where needed:

- Left axis for absolute values such as revenue, spend, impressions.
- Right axis for rate/ratio metrics such as ROAS, CPM, CTR.

If dual axes add too much visual clutter at implementation time, the fallback should still use one reusable chart card, but with value formatting in tooltips and clear legends. Implementation should choose the smallest readable approach.

## Tooltip and Formatting

Tooltips should be readable and metric-aware:

- Revenue/spend: currency.
- ROAS: `1.23x`.
- CPM: currency.
- Impressions/clicks: compact integer.
- CTR: percent with two decimals.

Prefer reusing or lightly extending existing formatter patterns in `dashboard-utils.ts` instead of defining disconnected formatters in every chart component.

## Custom Date Range Design

Custom date should become a supported option in `DASHBOARD_TIME_RANGES`.

User flow:

1. User opens time range selector.
2. User chooses `Custom`.
3. A popover opens with existing `Calendar` in range mode.
4. User selects start and end date.
5. Dashboard filters analytics to that inclusive date window.
6. Selector label communicates custom selection, for example `Custom: Jul 1 - Jul 4`.

Implementation constraints:

- Use existing `Calendar` from `src/components/ui/calendar.tsx`.
- Use existing `Popover` from `src/components/ui/popover.tsx` if a popover is needed.
- Do not add a new date picker dependency.
- Keep date math in UTC/date-key format to match existing analytics snapshot dates.
- If user selects `Custom` but range is incomplete, keep the previous completed range active. Do not apply an empty or partial custom filter.

State model:

- `selectedRange: DashboardTimeRangeId`
- `customDateRange: { from?: Date; to?: Date }` or a date-key equivalent
- `activeRange` should remain the last complete predefined or custom range used for filtering. Selecting `Custom` only changes `activeRange` after both start and end dates are present.

Filtering:

- Extend `filterAnalyticsByTimeRange()` or add a small adjacent helper to accept custom date keys.
- Extend recent changes filtering with the same effective date window.
- Do not change analytics API calls.

## Error, Loading, and Empty States

Reuse existing dashboard behavior:

- If analytics query is loading, show compact chart skeleton cards.
- If analytics query errors, show one consistent chart section error state or per-card error state.
- If filtered data is empty, show clear empty state in chart grid.
- Metric cards keep existing loading/error/empty behavior with compact dimensions.

## Accessibility

Charts must use Recharts `accessibilityLayer`.

Interactive date controls must preserve keyboard access through Radix Select/Popover and the existing DayPicker-based `Calendar`.

Each chart section/card should have visible text title and meaningful subtitle. Avoid relying on color only; keep legends visible.

## Testing and Verification

Minimum verification after implementation:

- `npm run lint`
- `npm run build` if lint passes and runtime build is feasible.
- AFT diagnostics on touched files.

Manual checks:

- Dashboard loads with default `Last 7 days`.
- Six metric cards are smaller and still standardized.
- Three chart cards render with current analytics data.
- Large viewport shows charts side by side.
- Mobile viewport stacks charts without overflow.
- Date selector still handles all existing ranges.
- `Custom` is no longer disabled.
- Choosing a complete custom date range filters metrics, charts, insights, and recent changes consistently.
- Incomplete custom date range does not crash and does not leave dashboard in a misleading state.

## Implementation Tasks

1. Compact metric card sizing.
   - Edit only `DashboardMetricCard.tsx` and `DashboardMetricGrid.tsx` unless a type issue requires otherwise.
   - Verify loading skeleton still matches card proportions.

2. Add chart point derivation helpers.
   - Update `dashboard-types.ts` and `dashboard-utils.ts` with narrow chart point/date-window support.
   - Reuse existing grouping/date label logic where possible.

3. Build reusable shadcn line chart card.
   - Add a focused component for two-series line charts using `ChartContainer` and Recharts.
   - Keep formatting/config passed in through props rather than hardcoding all chart cases into one large conditional.

4. Build fixed dashboard chart grid.
   - Render exactly three cards: Revenue vs ROAS, Spend vs CPM, Impressions vs CTR.
   - Handle loading/error/empty states in the section.

5. Replace current trend section on dashboard page.
   - Keep `page.tsx` as state/query/orchestration only.
   - Do not inline Recharts markup in `page.tsx`.

6. Enable custom date range UI.
   - Update `DashboardTimeRangeSelector.tsx` to support `Custom` with existing `Calendar` and `Popover`.
   - Update `dashboard-utils.ts` filtering to accept custom date windows.
   - Keep all date filtering frontend-only.

7. Verify targeted scope.
   - Run AFT diagnostics on dashboard files.
   - Run lint/build as appropriate.
   - Review git diff to confirm no backend or unrelated files changed.

## Risks and Mitigations

Risk: Charts become hard to read because paired metrics use different scales.
Mitigation: Use dual Y axes or clear legend/tooltip formatting. Keep chart height consistent.

Risk: Custom date selection introduces timezone bugs.
Mitigation: Continue using existing UTC date-key patterns from `dashboard-utils.ts` and compare `YYYY-MM-DD` keys inclusively.

Risk: Dashboard component becomes too large.
Mitigation: Keep Recharts markup and date-picker UI in focused dashboard components, not `page.tsx`.

Risk: Scope creep into customization or backend persistence.
Mitigation: Explicitly exclude customization drawer, saved layouts, APIs, and backend work from this iteration.

## Open Decisions

No blocking open decisions remain. During implementation, choose the smallest readable chart axis setup that satisfies the three requested charts and uses shadcn chart primitives.
