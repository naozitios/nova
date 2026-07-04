# PRD: Campaigns Page Frontend — Meta Ads Manager-Style Table

## 1. Objective

Update Nova’s **Campaigns** page frontend so it behaves like a Meta Ads Manager-style campaign table.

This PRD only covers the Campaigns page frontend.

The page should allow users to:

```txt id="c61uv3"
View campaigns
Filter campaigns
Customise visible columns
Export the current table
Create a campaign using the plus button
Open campaign detail
```

Do not change:

```txt id="70aqa3"
adClient
campaignStore
mock backend structure
mock data model
real platform API logic
create campaign logic
campaign detail logic
global navigation
```

---

## 2. Product Direction

The Campaigns page should feel like:

```txt id="km8qbj"
Meta Ads Manager campaign table
```

Not:

```txt id="fnfx3p"
A generic SaaS campaign dashboard
```

It should be dense, table-first, and operational.

---

## 3. Scope

### In Scope

```txt id="8wtmz9"
Campaigns page frontend only
Meta-style campaign table
Meta-style column library
Column customisation UI
Filters
Export current table
Existing plus button for campaign creation
Existing campaign detail linking
```

### Out of Scope

```txt id="y1nfyz"
No backend changes
No mock data changes
No campaignStore changes
No adClient changes
No fake metric generation
No closest-field mapping
No saved views
No schedule report
No Create Campaign redesign
No Campaign Detail redesign
No global navigation cleanup
No removing Dashboard, AI, Optimization, Demo, or Settings
```

---

## 4. Page Layout

The page should be simple:

```txt id="lff1l2"
Campaigns
[Controls row]
[Filters row]
[Campaigns table]
```

Do not add:

```txt id="jtxg0y"
Large page header
Subtitle
Marketing explanation
Dashboard-style summary cards
```

The only page label needed is:

```txt id="fbyo8i"
Campaigns
```

---

## 5. Create Campaign Entry Point

The primary create action should remain as the existing **plus button**.

### Requirement

```txt id="hazocf"
Plus button → /campaigns/new
```

Do not replace it with a large CTA button or banner.

---

## 6. Campaign Table Principle

The Campaigns table should follow a Meta-style column model.

There are two types of columns:

```txt id="91lkma"
1. Object/setup columns
Examples: campaign name, status, objective, budget, start/end date

2. Performance/insight columns
Examples: impressions, reach, spend, CPM, CPC, CTR, purchases, ROAS
```

The frontend should define a proper Meta-style column registry.

However, the active table must not invent data.

If a column is not supported by the current frontend data source:

```txt id="otdw89"
Do not show fake values
Do not derive fake values
Do not map to a vaguely similar field
Do not fill with random placeholders
```

Unsupported columns should remain unavailable/disabled until the data exists.

---

# 7. Default Table Columns

The default Campaigns table should use a practical Meta Ads Manager-style campaign view:

```txt id="w4u19d"
Campaign name
Delivery / status
Bid strategy
Budget
Attribution setting
Results
Reach
Impressions
Cost per result
Amount spent
Ends
```

If the current data source does not support a default column, that column should be disabled or omitted for now.

Do not fake it.

---

# 8. Meta-Style Column Library

The column customiser should be built around a Meta-style metric library.

## 8.1 Setup / Identity

```txt id="z7saeb"
Campaign name
Campaign ID
Ad set name
Ad set ID
Ad name
Ad ID
Objective
Buying type
Status
Delivery
Created time
Updated time
Start time
End time
```

## 8.2 Budget / Bidding / Schedule

```txt id="55zsb3"
Budget
Campaign budget
Ad set budget
Daily budget
Lifetime budget
Amount spent
Spend cap
Bid strategy
Bid amount
Cost control
Schedule
Starts
Ends
```

## 8.3 Delivery / Reach

```txt id="j685ll"
Reach
Impressions
Frequency
CPM
Estimated ad recall lift
Estimated ad recall rate
Cost per estimated ad recall lift
```

## 8.4 Clicks / Traffic

```txt id="ka81rp"
Clicks all
Link clicks
Outbound clicks
Landing page views
CTR all
Link CTR
Outbound CTR
CPC all
CPC link click
Cost per outbound click
Cost per landing page view
```

## 8.5 Engagement

```txt id="ic8g7v"
Post engagements
Page engagements
Post reactions
Post comments
Post shares
Post saves
Photo views
Video plays
ThruPlays
Cost per ThruPlay
```

## 8.6 Video

```txt id="d93x52"
Video plays
3-second video plays
Video plays at 25%
Video plays at 50%
Video plays at 75%
Video plays at 95%
Video plays at 100%
Average video play time
Video play actions
```

## 8.7 Leads / Conversion Actions

```txt id="vhgms6"
Results
Leads
Meta leads
Website leads
Registrations
Searches
Adds to cart
Initiated checkouts
Purchases
Custom conversions
Conversion value
```

## 8.8 Cost Per Action

```txt id="b9vk4h"
Cost per result
Cost per lead
Cost per website lead
Cost per registration
Cost per add to cart
Cost per checkout initiated
Cost per purchase
Cost per custom conversion
Cost per landing page view
```

## 8.9 Revenue / ROAS

```txt id="iwypz1"
Purchase conversion value
Website purchase conversion value
Total conversion value
ROAS
Website ROAS
Mobile app ROAS
Purchase ROAS
```

## 8.10 Quality / Diagnostics

```txt id="967q4n"
Quality ranking
Engagement rate ranking
Conversion rate ranking
Relevance diagnostics
Learning phase status
Tracking health
Recommendation status
```

## 8.11 Attribution / Reporting

```txt id="a3k765"
Attribution setting
Reporting starts
Reporting ends
Date created
Date last edited
Last significant edit
```

## 8.12 Breakdown-Ready Dimensions

These should be treated as future breakdown dimensions, not necessarily normal table columns.

```txt id="x7z67o"
Platform
Placement
Device
Age
Gender
Country
Region
DMA
Publisher platform
Impression device
Conversion device
Hour
Day
Week
Month
```

---

# 9. Column Customisation

Users should be able to:

```txt id="kc13b8"
Open column customisation
Search columns
Browse column categories
Toggle columns on/off
Reorder selected columns if simple
Apply selected columns
Reset to default columns
```

Important rule:

```txt id="avgy73"
Only selectable columns with real current data should appear in the active table.
Unsupported columns should be disabled, hidden, or marked unavailable in the column picker.
```

Do not show unsupported columns with fake values.

---

# 10. Filters

The Campaigns page should support Meta-style filtering.

## Required Filter UI

```txt id="ijfbkk"
Search
Status / delivery
Objective
Date range
Platform
Market / country
Budget type
Buying type
Has recommendations
Has tracking issues
```

Only apply filters where the current frontend data supports the field.

Unsupported filters should be disabled.

Do not invent filtering logic based on fake fields.

---

# 11. Export Current Table

The Campaigns page should support exporting the current table.

## Required Flow

```txt id="vwbjlz"
User configures columns and filters
User clicks Export
Export modal opens
User chooses format
User confirms
System shows success state
```

## Export Formats

```txt id="pckio6"
CSV
Excel
PDF later / disabled
```

Frontend-only CSV export is acceptable.

Do not build backend export infrastructure.

---

# 12. Row Behaviour

Each campaign row should allow the user to open Campaign Detail.

## Required Behaviour

```txt id="i95hi1"
Click campaign name → /campaigns/[id]
Open row action → /campaigns/[id]
```

No Campaign Detail redesign is required in this PRD.

---

# 13. Empty / Loading / Error States

Required states:

```txt id="u2uxed"
Loading campaigns
No campaigns
No campaigns match current filters
Failed to load campaigns
Export unavailable
```

Do not use fake metrics to fill empty states.

---

# 14. Acceptance Criteria

The Campaigns page is complete when:

```txt id="d3yglw"
The page still loads at /campaigns.
Only the simple “Campaigns” title appears at the top.
There is no large page header.
There is no subtitle.
The existing plus button remains the create campaign action.
The plus button routes to /campaigns/new.
The campaign table feels like Meta Ads Manager.
The default table uses Meta-style campaign columns.
The column customiser groups columns into Meta-style metric categories.
Unsupported metrics are not shown with fake values.
No fake metric generation is added.
No closest-field mapping is used.
Users can filter campaigns using available fields.
Users can customise visible columns.
Users can export the current table.
Users can open Campaign Detail from a campaign row.
No saved views are added.
No schedule report feature is added.
No mock backend changes are required.
No adClient changes are required.
No campaignStore changes are required.
No unrelated pages are removed.
```

---

# 15. Implementation Notes

Inspect these files first:

```txt id="1hz0da"
src/app/campaigns/page.tsx
src/app/campaigns/new/page.tsx
src/app/campaigns/[id]/page.tsx
src/api/adClient.ts
src/types/advertising.ts
```

Likely components:

```txt id="24ac6s"
CampaignsTable
CampaignsToolbar
CampaignFilters
ColumnCustomizer
ExportViewModal
```

Do not overbuild.

The goal is to make the Campaigns page feel like a Meta-style ads table while staying frontend-only.
