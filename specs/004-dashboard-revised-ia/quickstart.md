# Quickstart: Dashboard Revised IA Validation

## Prerequisites

- Dependencies installed with the existing project workflow.
- Run from repository root.

## Commands

```bash
npm run lint
npm run dev
```

## Manual Validation

1. Open `/dashboard`.
2. Confirm the route remains `/dashboard`.
3. Confirm the page title is exactly `Dashboard`.
4. Confirm there is no large marketing-style header or explanatory subtitle added for this feature.
5. Confirm the time range selector appears with Today, Yesterday, Last 7 days, This week, Last week, Month to date, and Custom.
6. Confirm Last 7 days is selected by default.
7. Select each time range and confirm unsupported data is not invented.
8. Confirm up to six metric cards render using only existing available values.
9. Confirm metric cards do not show hardcoded previous-period deltas unless real comparison data exists.
10. Confirm unsupported metrics such as CPA/CPL, purchases/leads, pacing, CVR, frequency, and reach are omitted when unavailable.
11. Confirm the trend section uses existing time-series data or shows `No performance data available`.
12. Confirm the AI-style summary has a headline, two to four bullets, and a suggested next step.
13. Confirm the summary references only metrics visible or available from current data.
14. Confirm one to three insight cards render when supported, or `No insights for this period.` appears.
15. Click Review on an insight and confirm a frontend-only drawer or modal opens.
16. Click Dismiss on an insight and confirm it hides locally for the current session.
17. Click Deep Dive on an insight with a campaign id and confirm it routes to `/campaigns/[id]`.
18. Confirm Deep Dive is unavailable for insights without an existing campaign id.
19. Confirm Recent Changes renders supported current-data items or `No recent changes for this period.`
20. Confirm recent change items link to `/campaigns/[id]` only with an existing campaign id.
21. Confirm there is no campaign table clone, saved views, scheduled reports, or real action execution.

## Expected Result

The Dashboard page is vertically scannable, follows the revised IA, and never displays fake metric values, fake deltas, fake recent changes, or unsupported action behavior.
