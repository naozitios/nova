# Research: Campaigns Meta Table

## Decision: Keep existing data sources unchanged

**Rationale**: The PRD explicitly forbids changes to `adClient`, `campaignStore`, mock backend structure, mock data model, real platform API logic, create campaign logic, and detail logic.

**Alternatives considered**: Adding mock metrics or extending mock data was rejected because the PRD forbids fake data and backend/model changes.

## Decision: Active table uses only supported real fields

**Rationale**: Current campaign data supports identity, status, objective, platform, budget, schedule, created/updated timestamps, and nested ad set targeting/bid fields. These can power the default table without inventing metrics.

**Alternatives considered**: Mapping spend/reach/results to similar fields was rejected because the PRD forbids closest-field mapping and fake values.

## Decision: Meta-style column registry includes unsupported columns as unavailable

**Rationale**: The user needs a Meta-style column library, but unsupported metrics must not enter the active table. A registry with support state lets the picker show the shape of the future system while protecting table integrity.

**Alternatives considered**: Hiding all unsupported columns was considered simpler, but it weakens the Meta-style customizer. Showing disabled unavailable columns better communicates future IA without lying in the table.

## Decision: Use frontend-only CSV export for first implementation

**Rationale**: CSV can be generated from current visible rows and columns without backend infrastructure. PDF is explicitly later/disabled. Excel can remain disabled unless implemented as CSV-compatible export without extra backend.

**Alternatives considered**: Backend export jobs and scheduled reports were rejected as out of scope.

## Decision: Keep page-level orchestration local to `/campaigns`

**Rationale**: This feature is route-specific. Local campaign table components reduce the size of `page.tsx` without broad architecture changes.

**Alternatives considered**: Shared generic data-table infrastructure was rejected as overbuild for one scoped PRD.
