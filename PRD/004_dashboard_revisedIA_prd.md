# PRD: Dashboard Page Frontend Update

## 1. Objective

Update the existing `/dashboard` page to match the post-login information architecture requirements for the Dashboard section.

The Dashboard should display:

1. Time range selector
2. Main metric cards
3. Performance trend chart
4. AI-style performance summary
5. Insight / Action cards
6. Recent changes

This is a frontend-only task.

---

## 2. Scope

### In Scope

* Update `/dashboard` frontend layout
* Reuse existing mock data from current frontend data sources
* Add or refine time range selector
* Add focused metric card grid
* Add performance trend area
* Add AI-style summary component
* Add Insight / Action card component
* Add Recent Changes component
* Add local UI behaviour for dismissing insight cards
* Add frontend-only detail drawer/modal for insight cards if needed
* Link relevant insight cards to campaign detail pages where an existing campaign ID is available

### Out of Scope

* No backend changes
* No mock data model changes
* No `adClient` changes
* No `campaignStore` changes
* No real AI integration
* No real recommendation execution
* No budget/action approval workflow
* No campaign table clone
* No saved views
* No report scheduling
* No global navigation changes
* No changes to `/campaigns`
* No changes to `/settings`
* No removal of existing pages

---

## 3. Existing Route

The page must remain available at:

* `/dashboard`

The page title should remain:

* `Dashboard`

Do not rename the route to `/overview`.

---

## 4. Data Rules

The Dashboard must use existing available frontend/mock data only.

Requirements:

* Do not create fake metric values.
* Do not generate random values.
* Do not add placeholder numbers.
* Do not create backend data requirements.
* Do not modify existing mock data structures.
* If a metric is unavailable, omit the component or show an empty state.
* If comparison data is unavailable, hide comparison text instead of inventing it.
* If recent change data is unavailable, show an empty state.

---

## 5. Page Layout

The Dashboard page should use this structure:

1. Dashboard
2. Time Range Selector
3. Metric Cards
4. Performance Trend
5. AI Performance Summary
6. Insight / Action Cards
7. Recent Changes

Layout requirements:

* Keep the page vertically scannable.
* Do not add a large marketing-style header.
* Do not add explanatory subtitle copy unless already present.
* Do not include campaign table controls.
* Do not include saved view/reporting controls.
* Do not duplicate the Campaigns page table.

---

## 6. Time Range Selector

### Required Options

* Today
* Yesterday
* Last 7 days
* This week
* Last week
* Month to date
* Custom

### Default

* Last 7 days

### Behaviour

* Selecting a time range should update visible dashboard data where current frontend data supports it.
* If current mock data does not support a selected range, the UI should either disable that option or keep the selection frontend-only without changing unavailable data.
* Do not invent new data for unsupported ranges.

---

## 7. Metric Cards

### Default Metrics

Show up to 6 primary metric cards.

Preferred metrics:

* Spend
* Revenue
* ROAS
* CPA / CPL
* Purchases / Leads
* Pacing

Optional metrics if already supported:

* CTR
* CVR
* Frequency
* Impressions
* Reach

### Card Fields

Each card should support:

* Metric label
* Metric value
* Previous-period change, if available
* Status indicator, if available

### Behaviour

* If a metric value does not exist, omit the card.
* If previous-period data does not exist, hide the comparison line.
* Do not show fake deltas.

---

## 8. Performance Trend

### Requirement

Add a lightweight trend section using existing time-series data if available.

Possible trend options:

* Spend over time
* Results over time
* Revenue over time
* CPA / ROAS over time

### Behaviour

* Use existing chart components if available.
* Do not build a custom analytics builder.
* Do not add advanced chart controls.
* If time-series data is unavailable, show an empty state.

---

## 9. AI Performance Summary

### Requirement

Add a summary card that displays a plain-English performance summary.

This does not require real AI.

The component can use:

* Static summary copy
* Rule-based summary copy
* Existing mock summary data, if available

### Required Structure

* Headline
* 2–4 summary bullets
* Suggested next step

### Example Structure

Headline: Performance efficiency declined this period.

Bullets:

* Spend increased compared with the previous period.
* Results did not increase at the same rate.
* CPA increased over the selected period.

Suggested next step:

* Review campaigns with rising CPA.

### Data Rule

Only reference metrics that are available in the current frontend data.

Do not write summaries that mention unavailable metrics.

---

## 10. Insight / Action Cards

### Requirement

Add 1–3 Insight / Action cards.

These cards should surface dashboard-level callouts.

### Card Fields

Each card should support:

* Title
* Category
* Severity
* Affected object
* What happened
* Why it matters
* Evidence
* Recommended next step
* CTA

### Categories

* Performance
* Budget
* Creative
* Tracking
* Setup
* Scaling

### Severity Values

* Critical
* Warning
* Opportunity
* Informational

### CTA Options

Supported frontend-only CTAs:

* Deep Dive
* Review
* Dismiss

### CTA Behaviour

| CTA       | Behaviour                                                             |
| --------- | --------------------------------------------------------------------- |
| Deep Dive | Navigate to `/campaigns/[id]` if an existing campaign ID is available |
| Review    | Open a frontend-only drawer/modal with card details                   |
| Dismiss   | Hide the card locally for the current session                         |

### Out-of-Scope CTA Behaviour

Do not add real execution actions such as:

* Approve
* Apply
* Execute
* Pause campaign
* Increase budget
* Launch campaign

Dashboard insights should not execute platform changes in this PRD.

---

## 11. Recent Changes

### Requirement

Add a Recent Changes section.

### Supported Change Types

* Budget change
* Status change
* New campaign
* New ad
* Paused campaign
* Paused ad
* Tracking issue
* UTM issue
* Manual change
* Nova-generated change

### Item Fields

Each item should support:

* Change type
* Affected object
* Description
* Timestamp, if available
* Source, if available

### Empty State

If recent change data is unavailable, show:

No recent changes for this period.

Do not invent change history.

---

## 12. Dashboard to Campaigns Handoff

The Dashboard should provide routes into deeper investigation.

### Required Links

Where data supports it:

* Insight card → Campaign Detail
* Metric card → Campaigns page
* Recent change item → Campaign Detail

### Route Behaviour

Campaign Detail links should use the existing route:

* `/campaigns/[id]`

Campaigns page links should use:

* `/campaigns`

---

## 13. Loading, Empty, and Error States

Add or preserve the following states:

* Loading dashboard data
* No performance data available
* No insights for this period
* No recent changes for this period
* Failed to load dashboard data

Empty states should be explicit.

Do not fill empty states with fake data.

---

## 14. Suggested Component Plan

Potential components:

* DashboardTimeRangeSelector
* DashboardMetricGrid
* DashboardMetricCard
* DashboardTrendSection
* DashboardAISummaryCard
* DashboardInsightCard
* DashboardInsightList
* DashboardInsightDrawer
* RecentChangesList
* RecentChangeItem

Reuse existing components where possible.

Do not create unnecessary abstractions if current page-level components are simpler.

---

## 15. Files to Inspect

Inspect these files before writing the implementation spec:

* `src/app/dashboard/page.tsx`
* `src/api/adClient.ts`
* `src/types/advertising.ts`
* Existing card components
* Existing chart components
* Existing button/modal/drawer components

Do not modify backend/mock data files unless required for type imports only.

---

## 16. Acceptance Criteria

The implementation is complete when:

* `/dashboard` still loads successfully.
* The page title remains `Dashboard`.
* The Dashboard includes a time range selector.
* The Dashboard includes up to 6 primary metric cards.
* Metric cards do not display fake values.
* Previous-period comparisons are hidden when unavailable.
* The Dashboard includes a lightweight performance trend section.
* The Dashboard includes an AI-style performance summary.
* The AI-style summary does not require real AI integration.
* The Dashboard includes 1–3 Insight / Action cards.
* Insight cards support `Deep Dive`, `Review`, and `Dismiss`.
* `Dismiss` works using frontend/local session state.
* `Review` opens a frontend-only detail drawer/modal.
* `Deep Dive` links to `/campaigns/[id]` where campaign ID is available.
* The Dashboard includes a Recent Changes section.
* Recent Changes shows an empty state if no data is available.
* The Dashboard does not add a campaign table.
* The Dashboard does not add saved views.
* The Dashboard does not add scheduled reports.
* No backend changes are required.
* No `adClient` changes are required.
* No `campaignStore` changes are required.
* No unrelated pages are removed or modified.

---

## 17. Implementation Constraint

This task is a frontend layout and interaction update only.

Do not introduce new data contracts, new backend endpoints, real AI calls, or real action execution.
