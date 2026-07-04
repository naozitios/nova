# UI Contract: Campaigns Table

## Route

`/campaigns`

## Page Structure

The page renders in this order:

1. `Campaigns` title
2. Controls row
3. Filters row
4. Campaigns table

The page does not render a subtitle, summary cards, a large marketing header, or a banner CTA.

## Controls

Required controls:
- Plus button routes to `/campaigns/new`
- Columns button opens column customizer
- Export button opens export modal

## Filters

Enabled filters:
- Search
- Status / delivery
- Objective
- Date range
- Platform
- Market / country

Unavailable filters:
- Budget type
- Buying type
- Has recommendations
- Has tracking issues

Unavailable filters must be disabled or absent.

## Default Active Columns

Supported default columns:
- Campaign name
- Delivery / status
- Objective
- Budget
- Platform
- Starts
- Ends
- Updated time

PRD default columns not currently supported must not render fake table values.

## Row Behavior

- Campaign name click routes to `/campaigns/[id]`
- Row action menu includes opening `/campaigns/[id]`
- Existing pause, resume, and delete actions may remain if backed by current page behavior

## Export Behavior

CSV:
- Enabled when at least one visible row and supported visible column exists
- Includes current filtered rows
- Includes current visible columns only

Excel:
- Disabled unless implemented without backend infrastructure

PDF:
- Disabled for later

## States

The page must show distinct states for:
- Loading campaigns
- No campaigns
- No campaigns match current filters
- Failed to load campaigns
- Export unavailable
