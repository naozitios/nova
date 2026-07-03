# Feature Specification: Dashboard Revised IA

**Feature Branch**: `[004-dashboard-revised-ia]`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Use PRD/004_dashboard_revisedIA_prd.md to update only the Dashboard page frontend. Keep `/dashboard`, keep the page title `Dashboard`, use existing frontend/mock data only, and do not change backend, adClient, campaignStore, mock data models, global navigation, or unrelated pages."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Scan current dashboard performance (Priority: P1)

A media buyer opens Dashboard and quickly sees the selected time range, primary metrics, and a lightweight performance trend using only existing analytics data.

**Why this priority**: This is the core dashboard IA and the minimum useful replacement for the current overview.

**Independent Test**: Open `/dashboard` and confirm the page title, time range selector, metric cards, and trend section render without fake values or fake comparison deltas.

**Acceptance Scenarios**:

1. **Given** analytics metrics are available, **When** the user opens `/dashboard`, **Then** they see `Dashboard`, a time range selector defaulted to `Last 7 days`, up to six metric cards, and a trend section.
2. **Given** a metric is unavailable in current frontend data, **When** metric cards render, **Then** the unavailable metric is omitted rather than populated with placeholder or random values.
3. **Given** previous-period comparison data is unavailable, **When** metric cards render, **Then** comparison text is hidden instead of showing invented deltas.
4. **Given** time-series analytics are available, **When** the trend section renders, **Then** it uses existing time-series values for spend, revenue, or other supported metrics.

---

### User Story 2 - Understand performance implications (Priority: P2)

A media buyer reads an AI-style performance summary that explains current performance in plain English without requiring real AI.

**Why this priority**: The dashboard must convert raw metrics into an operational summary, but this can be rule-based and frontend-only.

**Independent Test**: Open `/dashboard` with analytics data and confirm the summary includes a headline, two to four bullets, and a suggested next step that references only available metrics.

**Acceptance Scenarios**:

1. **Given** spend, revenue, ROAS, CTR, impressions, or clicks are available, **When** the summary renders, **Then** it references only those available metrics.
2. **Given** no usable analytics metrics are available, **When** the summary area renders, **Then** it shows an explicit empty state instead of invented analysis.
3. **Given** the summary is generated without AI, **When** the user reads it, **Then** it is presented as dashboard guidance and does not imply a real AI integration or backend recommendation engine.

---

### User Story 3 - Review and dismiss dashboard insights (Priority: P3)

A media buyer reviews one to three dashboard-level insight or action cards, opens a frontend detail drawer, follows campaign links when a real campaign id exists, and dismisses cards for the current session.

**Why this priority**: Insight cards create actionability while preserving the PRD constraint that dashboard actions must not execute platform changes.

**Independent Test**: Open `/dashboard`, review insight cards, open a card detail drawer, dismiss a card, and confirm any Deep Dive link points to `/campaigns/[id]` only when backed by an existing campaign id.

**Acceptance Scenarios**:

1. **Given** supported insight data can be derived from existing analytics or campaign data, **When** insights render, **Then** the page shows one to three cards with category, severity, affected object, evidence, and next step.
2. **Given** an insight has an existing campaign id, **When** the user selects Deep Dive, **Then** the app routes to `/campaigns/[id]`.
3. **Given** an insight has no existing campaign id, **When** the card renders, **Then** Deep Dive is disabled, hidden, or replaced by Review.
4. **Given** the user selects Review, **When** the card has details, **Then** a frontend-only drawer or modal opens.
5. **Given** the user selects Dismiss, **When** the card is dismissed, **Then** it is hidden locally for the current browser session only.
6. **Given** no supported insights exist, **When** the insight section renders, **Then** it shows `No insights for this period.`

---

### User Story 4 - Check recent changes (Priority: P4)

A media buyer sees recent dashboard changes when existing data supports them, or a clear empty state when it does not.

**Why this priority**: Recent changes are required by the revised IA, but the current data source may not contain a true change history.

**Independent Test**: Open `/dashboard` and confirm Recent Changes renders either supported current-data items or the exact empty state `No recent changes for this period.`

**Acceptance Scenarios**:

1. **Given** existing frontend data has updated campaign timestamps or other supported change-like fields, **When** Recent Changes renders, **Then** each item uses existing campaign ids, descriptions, timestamps, and sources where available.
2. **Given** no recent change history is available, **When** Recent Changes renders, **Then** it shows `No recent changes for this period.`
3. **Given** a recent change item has an existing campaign id, **When** the user opens it, **Then** the app routes to `/campaigns/[id]`.

### Edge Cases

- Loading metrics and time-series data should show dashboard-shaped loading states.
- Failed metrics or time-series loading should show `Failed to load dashboard data`.
- No analytics data should show `No performance data available`.
- Time range options unsupported by current data should remain frontend-only or be disabled; they must not trigger fake data.
- The current dashboard's hardcoded comparison deltas must be removed unless real comparison data exists.
- The dashboard must not duplicate the Campaigns page table.
- Insight CTAs must never execute platform actions such as approve, apply, pause, increase budget, or launch.
- Empty states must be explicit and must not be filled with placeholder values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Dashboard page MUST keep the route `/dashboard`.
- **FR-002**: The Dashboard page MUST keep the page title `Dashboard`.
- **FR-003**: The feature MUST remain frontend-only.
- **FR-004**: The feature MUST NOT change `adClient`, `campaignStore`, mock data structures, backend endpoints, real AI integration, recommendation execution, global navigation, `/campaigns`, `/settings`, or unrelated pages.
- **FR-005**: The Dashboard page MUST use existing frontend/mock data only.
- **FR-006**: The Dashboard page MUST include a time range selector with `Today`, `Yesterday`, `Last 7 days`, `This week`, `Last week`, `Month to date`, and `Custom`.
- **FR-007**: The default time range MUST be `Last 7 days`.
- **FR-008**: Unsupported time range behavior MUST not invent data; unsupported options may be disabled or keep selection local without changing unavailable data.
- **FR-009**: The Dashboard page MUST display up to six primary metric cards using supported current values only.
- **FR-010**: Preferred metric cards SHOULD include Spend, Revenue, ROAS, CPA/CPL, Purchases/Leads, and Pacing when supported by current data.
- **FR-011**: Optional metrics MAY include CTR, CVR, Frequency, Impressions, or Reach only when supported by current data.
- **FR-012**: Metric cards MUST omit unavailable values.
- **FR-013**: Metric cards MUST hide previous-period comparison text when comparison data is unavailable.
- **FR-014**: The Dashboard page MUST include a lightweight performance trend section using existing time-series data when available.
- **FR-015**: The Dashboard page MUST show a trend empty state when time-series data is unavailable.
- **FR-016**: The Dashboard page MUST include an AI-style performance summary with headline, two to four bullets, and suggested next step.
- **FR-017**: The AI-style summary MUST be static, rule-based, or based on existing mock data only; it MUST NOT call a real AI service.
- **FR-018**: The AI-style summary MUST reference only available metrics.
- **FR-019**: The Dashboard page MUST include one to three Insight / Action cards when supported data can produce them.
- **FR-020**: Insight cards MUST support title, category, severity, affected object, what happened, why it matters, evidence, recommended next step, and CTA.
- **FR-021**: Insight categories MUST be limited to Performance, Budget, Creative, Tracking, Setup, and Scaling.
- **FR-022**: Insight severities MUST be limited to Critical, Warning, Opportunity, and Informational.
- **FR-023**: Insight CTAs MUST be limited to Deep Dive, Review, and Dismiss.
- **FR-024**: Deep Dive MUST route to `/campaigns/[id]` only when an existing campaign id is available.
- **FR-025**: Review MUST open a frontend-only drawer or modal with card details.
- **FR-026**: Dismiss MUST hide the insight locally for the current session.
- **FR-027**: The Dashboard page MUST include a Recent Changes section.
- **FR-028**: Recent Changes MUST show `No recent changes for this period.` when no supported recent change data is available.
- **FR-029**: Metric cards SHOULD link to `/campaigns` where that handoff is useful and supported.
- **FR-030**: Insight cards and recent change items SHOULD link to `/campaigns/[id]` where an existing campaign id is available.
- **FR-031**: The Dashboard page MUST preserve or add explicit loading, empty, and error states for dashboard data.
- **FR-032**: The Dashboard page MUST NOT include campaign table controls, saved views, reporting controls, scheduled reports, or a Campaigns table clone.

### Key Entities *(include if feature involves data)*

- **Dashboard Time Range**: The selected display period and support state for each available option.
- **Dashboard Metric Card**: A supported metric value, label, optional status indicator, optional supported comparison, and optional route handoff.
- **Performance Trend Series**: Time-series points derived from existing `AnalyticsSnapshot` records.
- **AI Summary**: A frontend-generated summary with headline, bullets, and suggested next step based only on available metrics.
- **Dashboard Insight**: A frontend-derived callout with category, severity, evidence, next step, supported CTAs, and optional campaign id.
- **Recent Change Item**: A frontend display item derived only from existing change-like fields, or omitted when unavailable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open `/dashboard` and see the revised IA sections in the PRD order within 5 seconds.
- **SC-002**: 100% of displayed metric values and trend values are backed by existing frontend/mock data.
- **SC-003**: 0 hardcoded fake metric deltas, placeholder metric values, random generated dashboard values, or invented recent changes appear in the Dashboard UI.
- **SC-004**: A user can switch the time range selector to each required option without causing unsupported data fabrication.
- **SC-005**: A user can review and dismiss an insight card in under 30 seconds.
- **SC-006**: A user can open an insight detail drawer/modal in under 30 seconds.
- **SC-007**: Existing `/campaigns` and `/campaigns/[id]` navigation remains available and unchanged.
- **SC-008**: The dashboard shows explicit loading, no data, no insights, no recent changes, and failed load states.

## Assumptions

- Current `AggregatedMetrics` supports spend, impressions, clicks, revenue, CTR, ROAS, and platform breakdown values.
- Current `AnalyticsSnapshot` supports spend, impressions, clicks, revenue, campaign id, campaign name, platform, and date.
- Current `Campaign` data can provide campaign ids and updated timestamps, but it does not provide a true audit/change history.
- CPA/CPL, purchases/leads, pacing, CVR, frequency, reach, and previous-period comparisons are omitted unless real existing data supports them.
- Time range filtering can be implemented against existing time-series dates; if a selected range has no data, show an empty state rather than fabricating values.
- Insight generation can be deterministic and frontend-only, using simple rules over existing metrics, time-series, and campaigns.
