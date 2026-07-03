# UI Contract: Dashboard Revised IA

## Route

`/dashboard`

## Page Structure

The page renders in this order:

1. `Dashboard` title
2. Time range selector
3. Metric cards
4. Performance trend
5. AI performance summary
6. Insight / Action cards
7. Recent Changes

The page does not render a large marketing-style header, campaign table controls, saved view controls, reporting controls, scheduled report controls, or a Campaigns table clone.

## Time Range Selector

Required options:
- Today
- Yesterday
- Last 7 days
- This week
- Last week
- Month to date
- Custom

Default:
- Last 7 days

Behavior:
- Supported ranges filter existing frontend time-series data.
- Unsupported ranges are disabled or keep selection frontend-only without changing unavailable data.
- No range selection may invent data.

## Metric Cards

Preferred active metrics when supported:
- Spend
- Revenue
- ROAS
- CTR
- Impressions
- Clicks

Unavailable PRD-preferred metrics:
- CPA / CPL
- Purchases / Leads
- Pacing
- CVR
- Frequency
- Reach

Behavior:
- Render up to six primary cards.
- Omit unsupported metric cards.
- Hide previous-period comparison when comparison data is unavailable.
- Metric cards may link to `/campaigns` where appropriate.

## Performance Trend

Supported trend values:
- Spend over time
- Revenue over time
- Clicks over time, if chosen
- Impressions over time, if chosen

Behavior:
- Use existing chart components or lightweight existing chart style.
- No advanced chart controls.
- Show `No performance data available` when no time-series data exists for the selected range.

## AI Performance Summary

Required structure:
- Headline
- Two to four bullets
- Suggested next step

Behavior:
- Static or rule-based frontend summary only.
- Reference only available metrics.
- No real AI integration.

## Insight / Action Cards

Card fields:
- Title
- Category
- Severity
- Affected object
- What happened
- Why it matters
- Evidence
- Recommended next step
- CTA

Categories:
- Performance
- Budget
- Creative
- Tracking
- Setup
- Scaling

Severity values:
- Critical
- Warning
- Opportunity
- Informational

CTA behavior:
- Deep Dive routes to `/campaigns/[id]` only with an existing campaign id.
- Review opens a frontend-only drawer/modal.
- Dismiss hides the card locally for the current session.

Unsupported CTAs:
- Approve
- Apply
- Execute
- Pause campaign
- Increase budget
- Launch campaign

## Recent Changes

Supported change types:
- Budget change
- Status change
- New campaign
- New ad
- Paused campaign
- Paused ad
- Tracking issue
- UTM issue
- Manual change
- Nova-generated change

Behavior:
- Use existing data only.
- Link to `/campaigns/[id]` only when an existing campaign id is available.
- If no supported recent change data is available, show `No recent changes for this period.`

## States

The page must show distinct states for:
- Loading dashboard data
- No performance data available
- No insights for this period
- No recent changes for this period
- Failed to load dashboard data
