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

## Onboarding Flow Contract

PRD 007 remains source of product scope. Frontend specification and planning must preserve interaction model below.

### Interaction Model

Onboarding is a guided workspace, not an AI chat conversation. It combines short structured forms, independent source cards, a live processing workspace, adaptive question cards, a visual context canvas, and evidence-backed review. Conversational help may explain a question, but chat is not required to complete onboarding and never owns lifecycle state.

All onboarding routes use a dedicated shell containing NOVA identity, current brand, five-stage progress, save status, exit/resume action, and contextual help. Global Navbar is hidden only under `/onboarding/**`. Backend `route_stage` and blockers govern direct route access; frontend never calculates next valid stage itself.

### Entry and Resume

Authenticated app loads accessible businesses through `GET /api/businesses`.

- No business: open initial setup at `/onboarding/business`.
- Active initial/update session: resume backend `route_stage`.
- Approved business without active session: open `/business-context`.
- Explicit `Update Business Context` or `Run setup again`: start/resume update mode.

Selected business and current profile version live in server-backed state and query cache, not Business Context local storage. Refreshing or opening a resumable URL reconstructs state from backend.

### Stage 1: Brand

Route: `/onboarding/business`.

| User prompt | Control | Backend field | Behavior |
|---|---|---|---|
| Brand or business name | Required free text | `name` / `business.name` | Cannot be unknown |
| Industry or business type | Searchable combobox plus `Other` free text | `business_type` | Optional |
| Primary sales region | Searchable country/region combobox plus `Other` | `primary_market` / `market.primary` | Required; label avoids vague `market` wording |
| Advertising goal | Single-select cards or searchable select | `primary_advertising_objective` / `advertising.primary_objective` | Required; examples include sales, leads, awareness, traffic, app installs |
| Main business result | Single-select cards or searchable select | `primary_business_outcome` / `business.primary_outcome` | Required; examples include purchases, bookings, qualified leads, subscriptions, revenue |
| Website | URL input | `website_url` | Optional; valid URL queues website source immediately |

Every predefined choice supports an explicit `Other` path rather than forcing an inaccurate category. Monthly Meta budget is not asked here; backend may generate it later as a critical-gap question.

Submission creates business, provenance-backed initial facts, onboarding session, and optional website job. Initial mode creates; update mode reuses business and active update session.

### Stage 2: Sources

Route: `/onboarding/sources`. Sources use a dedicated page rather than sharing Stage 1.

Primary source actions:

- Website URL card, pre-populated when Stage 1 supplied one
- Meta connection card with connect, account selection, connected, expired, and disconnected states
- Multi-file drag-and-drop upload area with keyboard file picker
- `Add another source` action

Each file becomes an independent source card with filename, class, upload progress, processing stage, last activity, extracted-fact count, warnings, failure, and allowed action. User can choose document class or accept signed NOVA proposal before upload intent creation.

Cards distinguish successful, processing, warning, retryable failure, permanent failure, `OCR_REQUIRED`, `LEGACY_FORMAT_UNSUPPORTED`, malware rejection, scanner unavailable, and archived outcomes. Retry appears only when backend says retryable. Blocked OCR offers manual-text recovery. Legacy files explain retention and future reprocessing without pretending extraction succeeded.

Primary CTA is `Continue while NOVA learns`. User never waits for every source before leaving page.

### Background Learning Pipeline

User-facing explanation follows these steps:

1. Collect website, Meta, manual, or uploaded evidence.
2. Verify upload safety and turn supported files/pages into readable content.
3. Classify content and use AI to propose candidate business facts.
4. Validate each candidate and attach exact evidence.
5. Compare sources, detect disagreement, and preserve competing facts.
6. Find required gaps and create targeted questions.
7. Build draft Business Context and derive readiness.

AI proposes candidate facts; validation, evidence, user correction, conflict handling, and approval determine accepted profile. Partial extraction never appears as approved truth.

### Stage 3: Learning and Critical Gaps

Route: `/onboarding/review`. This is a live processing workspace, not a chat page.

Top area shows overall message such as `NOVA is learning about Acme`, source completion counts, readiness summary, and save/leave action. Main area contains:

- source progress cards
- `What NOVA has learned so far` section summary
- missing/conflicting summary
- emerging context preview
- adaptive questions when available

Question cards use backend `control_type`:

- radio cards for single choice
- checkboxes for multiple choice
- formatted currency/number input
- short or long text
- yes/no confirmation
- explicit `I don't know` when `allows_unknown` is true

Questions show plain-language reason and optional `Why is NOVA asking?` explanation. They do not expose model prompts or hidden reasoning. Unsent values survive polling and temporary network errors. New job updates cannot overwrite active user input.

CTA states:

- `Continue to review` when backend route/readiness permits
- `Save and return later` while required processing remains
- disabled action with backend blocker explanation when review cannot continue

### Notifications and Return Flow

When user leaves processing workspace:

- Business Context navigation may show count badge such as `3 questions ready`.
- In-app toast may announce processing completion or required input.
- Dashboard setup/readiness card shows setup, continue, processing, or review state.
- Email, SMS, and push notifications remain outside this feature unless separately approved.

### Stage 4: Context Review

Route: `/onboarding/context`. Two synchronized views present draft.

**Context canvas** provides visual relationship overview. Suggested first-level nodes are Brand, Offers, Customers, Conversion Journey, Economics and Targets, Brand Claims and Proof, Creative Capacity, and Measurement/Outcomes. Connections communicate relationships such as offer to customer, customer to journey, and journey to outcome. Nodes show ready, incomplete, uncertain, or conflicting status using color plus icon/text.

Canvas supports pan, zoom, fit-to-view, keyboard node traversal, and mobile-safe alternative. It is a projection, not source of truth. A structured section list provides equivalent content for accessibility, mobile, deep reading, and editing.

Selecting canvas node or section opens details containing important facts, readiness, missing values, conflicts, and edit actions. Selecting fact opens Evidence Drawer.

### Evidence and Explainability

Evidence Drawer shows:

- proposed/current value
- user-facing confidence state: Verified, Supported, Uncertain, or Conflicting
- source name and type
- exact excerpt
- URL, page, slide, sheet, or element locator when available
- source/effective date
- verification state and last update
- competing source values when conflict exists
- concise evidence summary such as `Two current sources support this value`

Do not expose chain-of-thought, hidden model reasoning, raw prompts, provider payloads, or sensitive operational logs. User sees evidence and short factual explanations. Separate processing timeline may show Uploaded, Text extracted, Facts identified, Evidence checked, Conflicts reviewed, and Ready for approval.

### Editing, Conflicts, and Approval

Edits create provenance-preserving correction facts and draft changes. Conflict cards show competing values and evidence, backend proposal when available, resolution question, and note. Resolving conflict changes draft only.

Review header summarizes ready sections, uncertain facts, unresolved conflicts, processed sources, and blockers. Approval control appears only for authorized roles and enables only when backend `approval_ready` is true.

Initial approval publishes v1. Update mode shows attributed before/after diff, preserves current approved profile until success, and handles stale base by refreshing draft/diff and requiring review again.

### Stage 5: Complete

Route: `/onboarding/complete`. Confirm published version, source count, Meta state, and any optional next action. Preserve selected business/version. Initial mode leads to Dashboard or Business Context; update mode returns to Business Context.

Repeat setup reuses this flow, resumes one active update session, keeps current approved context available to other features, and publishes only after diff review and expected-base approval.

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
