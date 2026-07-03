# Implementation Plan: Campaigns Meta Table

**Branch**: `[001-campaigns-meta-table]` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-campaigns-meta-table/spec.md`

## Summary

Replace the current Campaigns card list with a dense Meta Ads Manager-style table while keeping the feature frontend-only. The implementation keeps existing data sources and navigation intact, adds a typed column registry, supported-only filters, a column customizer, and a frontend CSV export modal. Unsupported Meta-style metrics stay disabled or unavailable until real data exists.

## Technical Context

**Language/Version**: TypeScript 5 with React 19 and Next.js 16 App Router

**Primary Dependencies**: Next.js, React, TanStack Query, Radix/shadcn-style UI primitives, Lucide icons, Tailwind CSS utilities

**Storage**: Existing in-memory mock data only via `adClient` and `campaignStore`; no new persistence

**Testing**: Existing project exposes `npm run lint`; implementation should at minimum pass lint and manual quickstart checks

**Target Platform**: Web application running in the existing Next.js app

**Project Type**: Frontend web app feature

**Performance Goals**: `/campaigns` remains responsive for current mock campaign volumes; filtering, column toggles, and export complete instantly for current in-memory data

**Constraints**: Campaigns page frontend only; no `adClient`, `campaignStore`, mock data model, campaign creation, campaign detail, or navigation changes; no fake metrics or loose field mapping

**Scale/Scope**: One route, `src/app/campaigns/page.tsx`, with likely local components under `src/components/campaigns/`

## Constitution Check

The repository constitution is still placeholder text and defines no enforceable gates. PRD constraints are treated as the operative gates:

- PASS: Frontend-only scope.
- PASS: Existing data surfaces remain unchanged.
- PASS: Unsupported metrics must not appear with fake values.
- PASS: Create and detail routes remain unchanged.

Post-design check: No gate violation expected because the design limits changes to Campaigns page UI and optional local presentation components.

## Project Structure

### Documentation (this feature)

```text
specs/001-campaigns-meta-table/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── campaigns-table-ui.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── app/
│   └── campaigns/
│       └── page.tsx
├── components/
│   └── campaigns/
│       ├── CampaignsToolbar.tsx
│       ├── CampaignFilters.tsx
│       ├── CampaignsTable.tsx
│       ├── ColumnCustomizer.tsx
│       └── ExportViewModal.tsx
└── types/
    └── advertising.ts
```

**Structure Decision**: Keep data loading and orchestration in `src/app/campaigns/page.tsx`; place reusable Campaigns-page-only presentation pieces in `src/components/campaigns/`. Do not modify current backend shims or shared campaign engine.

## Complexity Tracking

No constitution violations.
