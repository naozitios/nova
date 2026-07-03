# Feature Specification: Campaigns Meta Table

**Feature Branch**: `[001-campaigns-meta-table]`

**Created**: 2026-07-03

**Status**: Draft

**Input**: User description: "Use PRD/003_revisedIA_prd.md to update only the Campaigns page frontend into a Meta Ads Manager-style campaign table. Do not change backend, mock data, campaign creation, campaign detail, global navigation, adClient, or campaignStore."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View campaigns in an operational table (Priority: P1)

A media buyer opens Campaigns and sees a dense Meta Ads Manager-style table instead of large dashboard cards, with the existing campaigns represented through columns backed by real current data.

**Why this priority**: This is the core IA change and the minimum useful outcome.

**Independent Test**: Open `/campaigns` and confirm the page has only the `Campaigns` title, a toolbar, filters, and a campaign table with supported columns only.

**Acceptance Scenarios**:

1. **Given** campaigns are available, **When** the user opens `/campaigns`, **Then** they see a dense table with campaign rows and no summary cards, subtitle, or large marketing header.
2. **Given** a default Meta-style column is unsupported by current data, **When** the table renders, **Then** unsupported data is omitted from the active table rather than filled with fake or mapped values.
3. **Given** a campaign row is visible, **When** the user clicks the campaign name or row action to open details, **Then** the app routes to `/campaigns/[id]`.

---

### User Story 2 - Filter campaigns using supported fields (Priority: P2)

A media buyer narrows the campaign table with available filters such as search, status, objective, platform, date range, and market/country.

**Why this priority**: Filtering makes the dense table operational and scannable.

**Independent Test**: Apply each enabled filter on `/campaigns` and verify rows update using only fields present in the current campaign data.

**Acceptance Scenarios**:

1. **Given** campaigns with different statuses and objectives, **When** the user filters by status or objective, **Then** only matching campaigns remain visible.
2. **Given** campaigns with platform and targeting country data, **When** the user filters by platform or market/country, **Then** only matching campaigns remain visible.
3. **Given** unsupported filters such as buying type or tracking issues, **When** the user opens filters, **Then** those filters are disabled or unavailable.

---

### User Story 3 - Customize visible columns (Priority: P3)

A media buyer opens a Meta-style column customizer, searches or browses column categories, toggles supported columns, and resets to defaults.

**Why this priority**: Column control is required for Ads Manager-style workflows, but the default table can ship first.

**Independent Test**: Open column customization, select supported columns, apply changes, and confirm the table updates without showing unsupported fake metrics.

**Acceptance Scenarios**:

1. **Given** the column customizer is open, **When** the user searches or browses categories, **Then** Meta-style metric categories are visible.
2. **Given** a column is backed by current data, **When** the user toggles it on, **Then** it appears in the table.
3. **Given** a column is unsupported by current data, **When** the user views it in the customizer, **Then** it is disabled, hidden, or marked unavailable and cannot produce fake table values.
4. **Given** custom columns are active, **When** the user resets columns, **Then** the table returns to the supported default set.

---

### User Story 4 - Export the current table (Priority: P4)

A media buyer exports the currently filtered and visible table through a simple export modal.

**Why this priority**: Export is useful after table and column behavior are correct.

**Independent Test**: Configure filters and visible columns, export CSV, and verify exported rows and columns match the current table.

**Acceptance Scenarios**:

1. **Given** a filtered table, **When** the user exports CSV, **Then** the generated file includes only visible columns and matching rows.
2. **Given** Excel is selected, **When** the current implementation only supports frontend export, **Then** Excel is available only if implemented without backend infrastructure; otherwise it is disabled.
3. **Given** PDF is not supported, **When** export options are shown, **Then** PDF is disabled or marked later.

---

### Edge Cases

- Loading campaigns should show a table-shaped loading state.
- No campaigns should show a clear empty state.
- Filters producing zero matches should show a distinct "No campaigns match current filters" state.
- Failed campaign loading should show a failure state with no fake rows.
- Export should be unavailable when there are no exportable rows or columns.
- Unsupported metrics must never be generated, guessed, randomly filled, or mapped from loosely related fields.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Campaigns page MUST keep the route `/campaigns` and remain frontend-only for this feature.
- **FR-002**: The Campaigns page MUST display only a simple `Campaigns` title above the controls.
- **FR-003**: The Campaigns page MUST remove the current subtitle, large page header treatment, and card-list layout.
- **FR-004**: The existing plus create action MUST remain available and route to `/campaigns/new`.
- **FR-005**: The active campaign view MUST render as a dense Meta Ads Manager-style table.
- **FR-006**: Default active columns MUST include only current real data fields from the existing campaign sources.
- **FR-007**: The column registry MUST include Meta-style setup, budget, delivery, clicks, engagement, video, conversion, cost, revenue, diagnostics, attribution, and breakdown-ready categories.
- **FR-008**: Unsupported columns MUST be disabled, hidden, or marked unavailable and MUST NOT appear with fake values in the active table.
- **FR-009**: Users MUST be able to search campaigns by supported text fields.
- **FR-010**: Users MUST be able to filter campaigns by supported status, objective, date range, platform, and market/country fields.
- **FR-011**: Unsupported filters such as buying type, recommendations, or tracking issues MUST be disabled or unavailable until real data exists.
- **FR-012**: Users MUST be able to open column customization, search columns, browse categories, toggle supported columns, apply changes, and reset to defaults.
- **FR-013**: Users MUST be able to export the current filtered table as CSV using visible columns only.
- **FR-014**: The export flow MUST include an export modal, format choice, confirmation, and success state.
- **FR-015**: Campaign name and row action MUST route to `/campaigns/[id]`.
- **FR-016**: The feature MUST NOT change `adClient`, `campaignStore`, mock backend structure, mock data model, campaign creation logic, campaign detail logic, or global navigation.

### Key Entities *(include if feature involves data)*

- **Campaign Table Row**: A display row derived from existing campaign data, including campaign identity, setup fields, schedule, platform, budget, status, and available nested ad set fields.
- **Column Definition**: A registry item with id, label, category, support status, optional disabled reason, and value formatter.
- **Filter State**: The active filters applied to the campaign table using only supported fields.
- **Export Request**: The current visible rows, visible columns, selected format, and confirmation state used to produce a frontend export.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can open `/campaigns` and identify the table as Ads Manager-style within 5 seconds.
- **SC-002**: 100% of active table cells use values backed by current frontend data; unsupported metrics show no fake values.
- **SC-003**: A user can filter campaigns by at least search, status, objective, platform, and country in under 30 seconds.
- **SC-004**: A user can customize visible supported columns and reset to default columns in under 60 seconds.
- **SC-005**: A user can export the currently visible table as CSV in under 30 seconds.
- **SC-006**: Existing create and detail navigation flows remain unchanged and reachable from the Campaigns page.

## Assumptions

- Existing mock campaign data and campaign store data remain the only data sources for this feature.
- The active table may omit PRD default columns that are unsupported by current data.
- Frontend-only CSV export is sufficient for initial delivery.
- Excel may be implemented only if it can be done without backend infrastructure; otherwise it remains disabled.
- PDF export remains disabled for later.
- Campaign detail and campaign creation pages are intentionally out of scope.
