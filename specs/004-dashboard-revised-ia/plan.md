# Implementation Plan: Dashboard Revised IA

**Branch**: `[004-dashboard-revised-ia]` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-dashboard-revised-ia/spec.md`

## Summary

Update `/dashboard` into the revised post-login Dashboard IA while keeping the feature frontend-only. The implementation should reuse current `adClient.analytics` and `adClient.campaigns` data, remove fake comparison text from the existing dashboard cards, add a required time range selector, render supported metrics and trends only, add a rule-based AI-style summary, add local insight review/dismiss behavior, and show a Recent Changes section with an empty state when true change data is unavailable.

## Technical Context

**Language/Version**: TypeScript 5 with React 19 and Next.js 16 App Router

**Primary Dependencies**: Next.js, React, TanStack Query, Radix/shadcn-style UI primitives, Lucide icons, Tailwind CSS utilities, existing Recharts dependency if reused for charts

**Storage**: Existing in-memory mock data only via `adClient.analytics` and `adClient.campaigns`; local React state or session-scoped browser state for dismissed insights

**Testing**: Existing project exposes `npm run lint`; implementation should at minimum pass lint and manual quickstart checks

**Target Platform**: Web application running in the existing Next.js app

**Project Type**: Frontend web app feature

**Performance Goals**: `/dashboard` remains responsive for current mock analytics and campaign volumes; time range changes, insight dismissals, and drawer opening complete instantly for current in-memory data

**Constraints**: Dashboard frontend only; no `adClient`, `campaignStore`, mock data model, backend endpoint, real AI call, recommendation execution, global navigation, `/campaigns`, `/settings`, campaign table clone, saved views, or scheduled reports

**Scale/Scope**: One route, `src/app/dashboard/page.tsx`, with likely local Dashboard presentation components under `src/components/dashboard/`

## Constitution Check

The repository constitution is still placeholder text and defines no enforceable gates. PRD constraints are treated as the operative gates:

- PASS: Frontend-only scope.
- PASS: Existing data surfaces remain unchanged.
- PASS: No fake metric values, fake deltas, random values, or invented change history.
- PASS: Route remains `/dashboard` and title remains `Dashboard`.
- PASS: Existing Campaigns and Settings routes remain unchanged.

Post-design check: No gate violation expected because the design limits changes to Dashboard UI and local presentation/helpers.

## Project Structure

### Documentation (this feature)

```text
specs/004-dashboard-revised-ia/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── dashboard/
│       └── page.tsx
├── components/
│   └── dashboard/
│       ├── DashboardTimeRangeSelector.tsx
│       ├── DashboardMetricGrid.tsx
│       ├── DashboardMetricCard.tsx
│       ├── DashboardTrendSection.tsx
│       ├── DashboardAISummaryCard.tsx
│       ├── DashboardInsightCard.tsx
│       ├── DashboardInsightList.tsx
│       ├── DashboardInsightDrawer.tsx
│       ├── RecentChangesList.tsx
│       └── RecentChangeItem.tsx
└── components/
    └── dashboard/
        ├── dashboard-types.ts
        └── dashboard-utils.ts
```

**Structure Decision**: Keep data fetching and section orchestration in `src/app/dashboard/page.tsx`; place Dashboard-only display components and pure derivation helpers in `src/components/dashboard/`. Do not modify current backend shims, shared campaign table components, or data contracts.

## Complexity Tracking

No constitution violations.
