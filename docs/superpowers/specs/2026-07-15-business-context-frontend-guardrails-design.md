# Business Context Frontend and Spec Kit Guardrails Design

**Date**: 2026-07-15
**Status**: Approved for planning

## Objective

Make PRD 007 and its future Spec Kit feature implementation-ready without duplicating PRD 006.2 backend work. Close remaining frontend-facing contract gaps in the 006.2 documentation, define how the frontend reuses NOVA's current design system, and strengthen Spec Kit so later frontend features receive the same coverage automatically.

## Scope

### Included

- Correct frontend-facing gaps in `specs/006.2-business-context-remediation/` documentation and OpenAPI contract.
- Strengthen `PRD/007_business_context_frontend_prd.md` with design-system, responsive-web, accessibility, state, and browser-verification requirements.
- Create `specs/007-business-context-frontend/spec.md` from PRD 007 and declare the 006.2 readiness gate as a dependency.
- Strengthen Spec Kit templates, OpenCode commands, analysis rules, and workflow scope propagation for frontend work.

### Excluded

- Production implementation of PRD 006.2 or PRD 007.
- React, CSS, navigation, API route, database, migration, worker, or test implementation changes.
- Migration of existing hardcoded product colors into new CSS variables.
- Refactoring existing Dashboard, Campaigns, AI Assistant, Optimization, Settings, or landing pages.
- Changing shadcn primitive implementations under `src/components/ui/`.

## Dependency Boundary

PRD 006.2 owns backend ingestion, upload security, source processing, evidence, question generation, readiness, profile versions, approval, authorization, and API contracts. PRD 007 owns browser interaction and presentation over those contracts.

Frontend implementation cannot begin until the PRD 006.2 readiness gate passes. Frontend specification and planning may proceed against the finalized 006.2 contract, but must not duplicate backend lifecycle, readiness, conflict, extraction, or approval rules.

`specs/006.2-business-context-remediation/` remains the active Spec Kit feature until its implementation completes. Creating `specs/007-business-context-frontend/spec.md` must not change `.specify/feature.json`.

## 006.2 Contract Corrections

Apply only documentation and contract corrections needed by PRD 007:

1. Add authenticated `GET /api/businesses` so the frontend can discover accessible businesses and resumable onboarding state after reload without Business Context data in local storage.
2. Remove client-supplied `storage_path` and checksum from upload completion. The server derives the private path from the upload intent and computes trusted checksum data.
3. Add sanitized `connection_id` to `MetaConnectionStatus` because Meta source registration requires it.
4. Require non-empty evidence excerpts for material facts and require the backend-authored user-facing `confidence_state`.
5. Require `added_at` on source summaries used by source-management views.
6. Describe request `workspace_id` values as workspace selectors only. Verified server session identity and membership remain authorization authority.

Update 006.2 specification requirements, OpenAPI schemas, tasks, and contract/E2E coverage consistently. Do not add production code.

## PRD 007 UX Requirements

### Existing Design System

PRD 007 must require reuse of:

- shadcn/ui New York primitives from `src/components/ui/`
- Tailwind v4 semantic CSS variables from `src/app/globals.css`
- NOVA's existing stone neutral palette and orange/peach product accents
- Lucide icons
- current rounded-card and responsive spacing language
- TanStack Query for server state
- React Hook Form and Zod for new forms
- Sonner for user-facing asynchronous feedback

The PRD states product behavior and continuity. Exact primitive selection and file mapping belong in the frontend implementation plan. No duplicate Button, Dialog, Drawer, Form, Progress, Skeleton, Tabs, Table, Alert, Badge, or Toast primitive may be created when an existing primitive satisfies the interaction.

### Responsive Web

Support desktop, tablet, and mobile web. Mobile-native applications remain excluded. Every route must preserve task completion at narrow widths, avoid horizontal page overflow, keep primary actions reachable, and transform wide evidence/diff/table views into readable stacked or scroll-contained presentations.

### Required UI States

Every relevant screen or component must define:

- initial loading
- background refresh
- empty
- partial success
- retryable failure
- permanent failure
- blocked user action
- unauthorized/forbidden
- stale version
- offline or temporary network failure
- success

Source UX must distinguish `OCR_REQUIRED`, `LEGACY_FORMAT_UNSUPPORTED`, malware rejection, scanner unavailable, unsupported content, retryable provider failure, permanent failure, and archived state. Retry controls appear only when backend `retryable` is true. Recommended actions come from backend data.

### Accessibility and Motion

- Status cannot rely on color alone.
- All controls are keyboard operable with visible focus.
- Dialogs and drawers manage and restore focus.
- Dynamic job updates use non-disruptive live regions.
- Evidence, conflict, and diff views have semantic labels and keyboard navigation.
- Motion respects reduced-motion preferences and never gates task completion.
- Touch targets and form errors remain usable on mobile web.

### Browser Verification

Each frontend user story needs browser verification for desktop and mobile-web viewports. Verification covers happy paths, empty/loading/error/blocked states, keyboard navigation, focus behavior, responsive overflow, and critical authorization boundaries. Browser tasks use `agent-browser`; automated E2E uses project-approved browser tooling when added during planning.

## Frontend Feature Specification

Create `specs/007-business-context-frontend/spec.md` as a technology-aware project specification derived from PRD 007 and current repository constraints. It must include independently testable stories for:

1. Business discovery, initial setup, resume, and onboarding shell.
2. Website, upload, document classification, Meta connection, and independent source processing.
3. Dynamic questions, explicit unknown answers, readiness, evidence review, edits, and initial approval.
4. Permanent Business Context overview, source management, conflicts, and draft changes.
5. Version list/detail/compare/restore and stale-version recovery.
6. Responsive, accessible, secure, and failure-resilient operation.

The spec must reference the 006.2 OpenAPI contract as backend authority and prohibit frontend reconstruction of readiness, retryability, question generation, conflict resolution, or approval rules.

## Spec Kit Guardrails

### Specification

For frontend or full-stack scope, require user journeys plus interaction flow, route/screen inventory, loading/empty/error/partial/blocked states, responsive behavior, accessibility, design-system continuity, and browser-verifiable acceptance criteria. Keep product requirements implementation-neutral.

### Planning

Require an inventory of existing primitives, tokens, application shell, data-fetching patterns, form stack, feedback stack, and representative pages before selecting components. Plans must identify reuse versus genuinely new feature components and map each UI state to backend contract data.

### Tasks

Frontend stories require tests, implementation tasks, automated E2E, and `agent-browser` verification. Tests cannot remain optional for security, permissions, persistence, migrations, APIs, workers, or user-visible frontend journeys.

### Analysis

Flag missing state coverage, responsive behavior, accessibility, design-system reuse, frontend browser verification, backend-contract mapping, and constitution conflicts. Treat missing core frontend behavior or browser coverage as high severity; direct constitution violations remain critical.

### Workflow

Pass `scope` into specify, plan, tasks, and implementation command input. `frontend-only`, `backend-only`, and `full` must influence artifact requirements instead of being unused metadata.

## Validation

- No placeholders or unresolved clarification markers in modified specs.
- 006.2 requirements, OpenAPI, tasks, and PRD 007 use consistent fields and lifecycle names.
- OpenAPI parses and every added operation has typed success and error responses.
- PRD 007 acceptance criteria cover responsive web, accessibility, design-system reuse, blocked source states, resume, Meta handoff, and browser verification.
- Frontend feature spec contains independent stories and explicit 006.2 dependency.
- Spec Kit templates and commands agree on frontend requirements.
- Workflow YAML parses and propagates all scope values.
- `.specify/feature.json` still points to `specs/006.2-business-context-remediation`.

## Delivery Order

1. Correct 006.2 documentation contracts.
2. Patch PRD 007.
3. Create frontend feature spec without changing active feature pointer.
4. Patch Spec Kit templates, commands, analysis, and workflow.
5. Run cross-artifact and syntax validation.
