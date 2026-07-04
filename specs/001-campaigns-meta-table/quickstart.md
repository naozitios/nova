# Quickstart: Campaigns Meta Table Validation

## Prerequisites

- Dependencies installed with the existing project workflow.
- Run from repository root.

## Commands

```bash
npm run lint
npm run dev
```

## Manual Validation

1. Open `/campaigns`.
2. Confirm only `Campaigns` appears as the page title.
3. Confirm there is no subtitle, summary card area, or large marketing header.
4. Confirm the plus create action routes to `/campaigns/new`.
5. Confirm campaigns render in a dense table, not cards.
6. Confirm default active columns show only supported data.
7. Open the column customizer.
8. Confirm Meta-style categories exist.
9. Confirm unsupported metrics are disabled, unavailable, or hidden.
10. Toggle supported columns and apply.
11. Reset to default columns.
12. Filter by search, status, objective, platform, date range, and country.
13. Confirm unsupported filters are disabled or unavailable.
14. Click a campaign name and confirm route `/campaigns/[id]`.
15. Open row actions and confirm detail navigation exists.
16. Export CSV and confirm exported columns and rows match the current table.
17. Confirm PDF export is disabled.

## Expected Result

The Campaigns page feels like an operational Ads Manager table and never displays fake unsupported metrics.
