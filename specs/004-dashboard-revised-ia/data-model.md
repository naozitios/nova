# Data Model: Dashboard Revised IA

## DashboardTimeRange

Represents the selected dashboard period.

Fields:
- `id`: stable option id
- `label`: user-facing label
- `supported`: whether current frontend data can be filtered for this option
- `dateWindow`: optional calculated start and end dates for filtering existing time-series records
- `isCustom`: whether the option requires a custom date choice

Validation rules:
- Default selected option is `Last 7 days`.
- Required options are Today, Yesterday, Last 7 days, This week, Last week, Month to date, and Custom.
- Unsupported options cannot produce fabricated values.

## DashboardMetric

Represents one visible metric card.

Fields:
- `id`: stable metric id
- `label`: metric label
- `value`: formatted supported value
- `rawValue`: numeric source value when applicable
- `status`: optional status indicator if supported
- `comparison`: optional previous-period comparison only when real comparison data exists
- `href`: optional handoff route, usually `/campaigns`

Validation rules:
- Metrics must be derived from existing `AggregatedMetrics` or filtered `AnalyticsSnapshot` values.
- Unsupported metrics are omitted.
- Comparison is omitted unless real previous-period data exists.
- Default grid renders up to six cards.

## PerformanceTrendPoint

Represents one chart point in the trend section.

Fields:
- `date`: source snapshot date
- `spend`: supported spend value
- `revenue`: supported revenue value
- `clicks`: supported clicks value if used
- `impressions`: supported impressions value if used

Validation rules:
- Points must be aggregated from existing `AnalyticsSnapshot` records.
- Empty source data renders a trend empty state.
- Trend controls remain lightweight; no analytics builder or advanced chart controls.

## DashboardAISummary

Represents the AI-style summary card content.

Fields:
- `headline`: plain-English summary headline
- `bullets`: two to four metric-backed bullet statements
- `nextStep`: suggested next step
- `availableMetricIds`: metrics referenced by the summary

Validation rules:
- No real AI call.
- No reference to unavailable metrics.
- Empty or insufficient data renders a summary empty state.

## DashboardInsight

Represents one dashboard-level insight/action card.

Fields:
- `id`: stable local id
- `title`: card title
- `category`: Performance, Budget, Creative, Tracking, Setup, or Scaling
- `severity`: Critical, Warning, Opportunity, or Informational
- `affectedObject`: campaign, account, platform, or dashboard-level object label
- `campaignId`: optional existing campaign id for Deep Dive
- `whatHappened`: metric-backed explanation
- `whyItMatters`: impact statement
- `evidence`: list of metric-backed evidence strings
- `recommendedNextStep`: suggested review step
- `cta`: supported local CTA state
- `dismissed`: local session-only hidden state

Validation rules:
- Render one to three visible insights at most.
- Deep Dive is available only when `campaignId` exists.
- Review opens a frontend-only drawer/modal.
- Dismiss hides the card locally for the current session.
- No CTA may execute real platform changes.

## RecentChangeItem

Represents one recent change display item when existing data supports it.

Fields:
- `id`: stable local id
- `changeType`: supported PRD change type
- `affectedObject`: campaign or other supported object label
- `description`: data-backed description
- `timestamp`: optional existing timestamp
- `source`: optional existing source
- `campaignId`: optional existing campaign id for detail handoff

Validation rules:
- Items must use existing data only.
- If no supported recent change data is available, render `No recent changes for this period.`
- Items with `campaignId` may link to `/campaigns/[id]`.
