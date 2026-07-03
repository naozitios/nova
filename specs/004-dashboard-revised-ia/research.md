# Research: Dashboard Revised IA

## Decision: Keep existing data sources unchanged

**Rationale**: The PRD explicitly forbids backend changes, mock data model changes, `adClient` changes, `campaignStore` changes, real AI integration, and action execution. Current dashboard data already comes from `adClient.analytics.getLatest()` and `adClient.analytics.getTimeSeries()`. Campaign ids for handoff can come from existing analytics snapshots or `adClient.campaigns.list()`.

**Alternatives considered**: Extending mock analytics with CPA, purchases, pacing, recent changes, or comparison deltas was rejected because the PRD says not to create fake metric values, placeholder numbers, backend requirements, or mock data model changes.

## Decision: Remove current hardcoded comparison deltas

**Rationale**: The current Dashboard renders values such as `+12.3% vs yesterday`, `+8.1% vs yesterday`, and `+15.2% vs yesterday`. The available types do not expose previous-period comparison data, so these values violate the PRD's data rules.

**Alternatives considered**: Keeping the deltas as static UI copy was rejected because the PRD says previous-period comparisons must be hidden when unavailable.

## Decision: Time range selector filters existing time-series only

**Rationale**: `AnalyticsSnapshot` includes dated records. Supported time ranges can be represented as frontend filters over those records. If a range has no records, the dashboard can show an empty state. This keeps behavior local and data-backed.

**Alternatives considered**: Generating missing date buckets or extrapolating previous periods was rejected because it would invent data.

## Decision: Metric cards derive from current aggregates and filtered snapshots

**Rationale**: Current data supports spend, revenue, impressions, clicks, CTR, ROAS, and platform breakdown. Metric cards can show up to six supported values while omitting unsupported PRD-preferred metrics such as CPA/CPL, purchases/leads, pacing, CVR, frequency, and reach.

**Alternatives considered**: Showing disabled metric cards for unsupported values was rejected because the PRD says to omit cards when metric values do not exist.

## Decision: AI-style summary is deterministic and rule-based

**Rationale**: The PRD requires no real AI integration. A helper can generate a headline, two to four bullets, and next step from available metrics only. For example, it may reference spend, revenue, ROAS, CTR, clicks, impressions, or trend availability.

**Alternatives considered**: Calling an AI endpoint or adding mock recommendation data was rejected as out of scope.

## Decision: Insights are local, derived, and non-executing

**Rationale**: The PRD requires Insight / Action cards but forbids real execution actions. Cards can be derived from existing analytics and campaign data, support Review via a local drawer, Deep Dive only when an existing campaign id is present, and Dismiss through session-local state.

**Alternatives considered**: Adding approval/apply/pause/budget CTAs was rejected because the PRD explicitly forbids real platform changes from dashboard insights.

## Decision: Recent Changes defaults to empty state unless backed by existing fields

**Rationale**: Current types expose campaign `createdAt` and `updatedAt`, but there is no true change history with source and change type. The implementation can either show conservative supported items derived from real campaign timestamps or show the exact empty state. It must not invent change descriptions.

**Alternatives considered**: Fabricating a change log from static copy was rejected because the PRD requires an empty state when recent change data is unavailable.
