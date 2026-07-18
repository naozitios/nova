# NOVA Onboarding Frontend Direction

Date: 2026-07-18
Status: Draft for user review

## Purpose

Build NOVA onboarding frontend as a polished product experience before backend wiring. The current Stitch HTML mockups are rough visual references, not implementation source. The first implementation phase should replace wireframe-quality screens with a coherent 8-step onboarding flow using mock data shaped like the real backend.

Backend integration comes after the frontend experience, component system, step model, and mock data contracts are stable.

## Approved Direction

- Keep an 8-step frontend onboarding flow.
- Recount steps from product logic, not from current wireframe labels.
- Hide the normal app navbar during onboarding.
- Treat Meta connection as optional.
- Do not allow non-admin users to complete final approval for now.
- Match business fields to what the backend currently provides.
- Build with mock data first, but keep mock data shaped like backend responses.
- Use current app stack and primitives instead of copying standalone HTML, Tailwind CDN config, Material Symbols, or inline scripts from the mockups.

## Non-Goals

- Do not wire real backend calls in the first frontend polish pass.
- Do not change backend permissions in this pass.
- Do not change onboarding approval rules in this pass.
- Do not add a new icon-font dependency for Material Symbols.
- Do not port the Stitch mockup files directly into React.
- Do not redesign unrelated app areas.

## Product Flow

The onboarding flow has 8 visible frontend steps:

1. Business Basics
2. Primary Objective
3. Add Business Sources
4. Connect Meta Optional
5. Processing
6. Review Business Context
7. Select Ad Account
8. Setup Complete

The frontend step model is the user-facing journey. Later backend wiring can map these 8 steps onto the backend readiness stages: `business`, `sources`, `review`, `context`, and `complete`.

## Architecture

### Route Shape

Create onboarding as a dedicated frontend area with its own shell. The shell must suppress the global navbar so users see only onboarding navigation: NOVA identity, back/close controls, progress, content, and footer actions.

Likely route shape:

- `/onboarding/[businessId]`

The exact route can be adjusted during implementation if existing business/workspace routing requires it, but onboarding must remain isolated from the global app navbar.

### State Model

The mock frontend should use a local onboarding state object that mirrors future backend data:

- `business`
- `onboardingSession`
- `selectedObjective`
- `sources`
- `processing`
- `compiledProfile`
- `questions`
- `metaConnection`
- `adAccounts`
- `selectedAdAccountId`
- `permissions`
- `completion`

This state can live in a local mock-data module during phase 1. Later, each slice can be replaced by React Query calls and mutations.

### Component Strategy

Build reusable onboarding components from existing app primitives. Use shadcn/Radix-style components, Tailwind v4 tokens, lucide icons, and existing app conventions.

Do not make each step a standalone page with duplicate markup. Shared layout and components are required so the experience feels consistent.

## Visual System Direction

The current wireframes are too rough to use directly. The target visual direction should keep the warm NOVA feel while making the screens product-quality:

- Warm off-white page background.
- Deep NOVA red primary action color.
- Soft peach/warm surface cards.
- Clear typography hierarchy using existing Geist font setup.
- Large rounded cards, but with consistent radius and spacing.
- Polished step progress indicator.
- Strong empty, skipped, loading, success, and blocked states.
- Lucide icons or inline brand SVGs instead of Material Symbols.
- No standalone CDN Tailwind config inside components.

Design tokens should be centralized before final backend wiring. In the first pass, use consistent classes and variables; avoid copying inconsistent per-mockup color values.

## Step 1: Business Basics

### User Purpose

Confirm the user is setting up the correct business.

### UI Requirements

- Show business name.
- Show website URL.
- Show business or workspace status if available.
- Show simple confirmation copy.
- Provide primary action: Continue.
- Provide secondary action: Exit onboarding.
- Provide safe empty state if business name or website is missing.
- Do not overload this step with source upload or Meta connection.

### Mock Data

Use backend-aligned fields:

- `business.id`
- `business.workspaceId`
- `business.name`
- `business.websiteUrl`
- `business.status`

### Specific Tasks

- Create business confirmation card.
- Create missing-website fallback copy.
- Add continue behavior to advance to step 2.
- Add close/exit control in shell.
- Verify mobile layout keeps business identity readable.

## Step 2: Primary Objective

### User Purpose

Tell NOVA what kind of help matters first.

### UI Requirements

- Present objective cards with concise labels and explanations.
- Allow one selected objective.
- Disable Continue until one objective is selected.
- Explain that this choice helps NOVA prioritize context.
- Keep choices aligned with backend context compile purposes where possible.

### Recommended Objective Options

- Campaign setup
- Performance analysis
- Optimization
- Creative brief
- Tracking audit

### Mock Data

- `selectedObjective`
- `objectiveOptions[]`

### Specific Tasks

- Build `ObjectiveCard` component.
- Build selected, hover, and disabled states.
- Store chosen objective in local onboarding state.
- Add continue button disabled state.
- Add short helper copy explaining why objective matters.

## Step 3: Add Business Sources

### User Purpose

Give NOVA material to learn from: website, files, decks, PDFs, and manual notes.

### UI Requirements

- Show website source area.
- Show polished upload dropzone.
- Show active sources list.
- Show manual brand notes field.
- Show supported file guidance.
- Show max file size guidance.
- Show source statuses: added, uploading, processing, complete, failed.
- Provide primary action: Let NOVA learn.
- Provide secondary action: Skip for now if allowed.

### Mock Data

Use backend-aligned source fields:

- `sources[].id`
- `sources[].sourceType`
- `sources[].sourceName`
- `sources[].externalReference`
- `sources[].status`
- `sources[].currentStage`
- `sources[].progress`
- `sources[].error`

### Specific Tasks

- Build `UploadDropzone` component with drag-over visual state.
- Build `SourceStatusCard` component.
- Build source list empty state.
- Build upload guidance copy.
- Build manual notes textarea with character counter.
- Add mock upload state transitions.
- Add failed-source visual state and retry affordance.
- Add primary action that advances to processing.

## Step 4: Connect Meta Optional

### User Purpose

Offer Meta connection while making clear it is optional.

### UI Requirements

- Explain what NOVA can use from Meta.
- Explain user can skip and connect later.
- Provide primary action: Connect Meta.
- Provide secondary action: Skip for now.
- Show connected state.
- Show skipped state.
- Show failed state with retry.
- Do not block onboarding if user skips.

### Mock Data

- `metaConnection.status`: `not_connected`, `connected`, `skipped`, or `failed`
- `metaConnection.connectionId`
- `metaConnection.connectedAt`
- `metaConnection.error`

### Specific Tasks

- Build `MetaConnectPanel` component.
- Build permission explanation cards.
- Build optional/skipped messaging.
- Store skipped state in mock onboarding state.
- Store connected state in mock onboarding state.
- Add retry path for failed mock state.
- Continue to processing whether connected or skipped.

## Step 5: Processing

### User Purpose

See NOVA analyzing submitted sources and know when enough information is ready.

### UI Requirements

- Show overall processing status.
- Show source-by-source progress.
- Show current processing message.
- Show completed sources.
- Show failed sources.
- Show blockers if available.
- Provide retry action for failed source.
- Allow continue only when mock readiness says review is ready.
- Avoid hard-coded time promises unless backed by real data later.

### Mock Data

- `processing.overallStatus`: `idle`, `processing`, `ready`, `blocked`, or `failed`
- `processing.currentMessage`
- `processing.sources[]`
- `processing.blockers[]`
- `processing.canContinue`

### Specific Tasks

- Build `ProcessingTimeline` component.
- Build progress state for each source.
- Build ready state.
- Build blocked state.
- Build failed state.
- Add mock transition controls for frontend testing.
- Gate Continue button behind `processing.canContinue`.

## Step 6: Review Business Context

### User Purpose

Review and correct what NOVA learned before it becomes approved business context.

### UI Requirements

- Show compiled business summary.
- Show offerings.
- Show value propositions.
- Show target audiences.
- Show funnel goals.
- Show backend-provided questions.
- Allow editing fields that backend provides.
- Save edits into local mock answer state.
- Explain approval requirement.
- Admin sees approval-oriented action.
- Non-admin sees ready-for-admin-approval action.

### Mock Data

- `compiledProfile`
- `questions[].factKey`
- `questions[].questionType`
- `questions[].question`
- `questions[].options`
- `questions[].answer`
- `permissions.canApprove`

### Specific Tasks

- Build `BusinessContextReview` component.
- Build editable summary card.
- Build offerings section.
- Build value propositions section.
- Build audience chips/list section.
- Build funnel goals section.
- Build backend-question renderer.
- Build local save-draft behavior.
- Build admin approval state.
- Build non-admin blocked approval state.

## Step 7: Select Ad Account

### User Purpose

Choose the Meta ad account NOVA should use, if Meta was connected.

### UI Requirements

- If Meta connected, show account selector.
- If Meta skipped, show skipped completion state for this step.
- If Meta failed, offer retry or continue without Meta.
- Show account name.
- Show account ID.
- Show currency.
- Show timezone if available.
- Show connection health if available.
- Provide refresh accounts action.
- Disable Continue until account selected when Meta is connected.

### Mock Data

- `adAccounts[].id`
- `adAccounts[].name`
- `adAccounts[].currency`
- `adAccounts[].timezone`
- `adAccounts[].status`
- `selectedAdAccountId`
- `metaConnection.status`

### Specific Tasks

- Build `AdAccountSelector` component.
- Build radio-card selected state.
- Build skipped-Meta state.
- Build failed-Meta state.
- Build empty accounts state.
- Build refresh action mock state.
- Gate Continue based on Meta/account state.

## Step 8: Setup Complete

### User Purpose

Understand setup result and move to the dashboard or next setup area.

### UI Requirements

- Show business context status.
- Show sources summary.
- Show Meta status: connected, skipped, failed, or pending.
- Show approval status.
- Admin state: setup complete.
- Non-admin state: setup ready for admin approval.
- Provide primary action to dashboard.
- Provide secondary action to settings or source management.

### Mock Data

- `completion.business`
- `completion.sources`
- `completion.meta`
- `completion.approval`
- `permissions.canApprove`

### Specific Tasks

- Build `CompletionSummary` component.
- Build admin completion state.
- Build non-admin pending-approval state.
- Build Meta skipped summary state.
- Build source summary list.
- Add dashboard CTA.
- Add secondary management CTA.

## Shared Component Task List

Build these before or alongside step screens:

- `OnboardingShell`: isolated page shell with hidden global navbar.
- `OnboardingProgress`: 8-step progress display with current, complete, skipped, and blocked states.
- `OnboardingActionFooter`: sticky/fixed footer action area.
- `OnboardingCard`: consistent card surface for onboarding content.
- `ObjectiveCard`: selectable objective choice.
- `UploadDropzone`: drag/drop upload area with mock state.
- `SourceStatusCard`: source status row/card.
- `MetaConnectPanel`: Meta optional connection UI.
- `ProcessingTimeline`: source processing and readiness UI.
- `BusinessContextReview`: profile review and editable fields.
- `AdAccountSelector`: Meta ad account radio-card selector.
- `CompletionSummary`: final setup summary.

## Mock Data Contract

Use one mock data module so every screen reads from the same backend-shaped source.

Required mock entities:

```ts
type MockOnboardingState = {
  business: MockBusiness;
  onboardingSession: MockOnboardingSession;
  selectedObjective: string | null;
  sources: MockSource[];
  processing: MockProcessingState;
  compiledProfile: MockCompiledProfile;
  questions: MockQuestion[];
  metaConnection: MockMetaConnection;
  adAccounts: MockAdAccount[];
  selectedAdAccountId: string | null;
  permissions: MockPermissions;
  completion: MockCompletion;
};
```

The exact TypeScript names can change during implementation, but the mock state must keep the same conceptual slices.

## Later Backend Wiring Plan

Backend wiring should replace mock slices one at a time:

1. Business data from existing business API or route loader.
2. Onboarding session from `GET/POST /api/businesses/{id}/onboarding`.
3. Source registration from `POST /api/businesses/{id}/context/sources`.
4. Upload intent from `POST /api/businesses/{id}/context/uploads`.
5. Upload complete from `POST /api/businesses/{id}/context/uploads/{uploadId}/complete`.
6. Scan queue from `POST /api/businesses/{id}/onboarding/scan`.
7. Processing/readiness from a frontend-friendly readiness endpoint exposing existing readiness logic.
8. Profile draft from `POST /api/businesses/{id}/onboarding/compile`.
9. Questions from `GET /api/businesses/{id}/onboarding/questions`.
10. Answers from `POST /api/businesses/{id}/onboarding/answers`.
11. Approval from `POST /api/businesses/{id}/onboarding/approve`.
12. Meta OAuth from `POST /api/meta/oauth/start` with onboarding `return_path`.
13. Ad accounts from `GET /api/meta/ad-accounts?workspace_id=...`.
14. Account selection from `POST /api/meta/connections/select-account`.
15. Final dashboard transition after completion or admin-approval-ready state.

## Product Decisions

These are intentionally resolved for phase 1:

- Frontend uses 8 visible steps.
- Meta is optional.
- Non-admin users cannot complete final approval.
- Business fields match backend-provided profile/facts.
- Frontend polish and mock data come before backend wiring.

Open decisions for later backend wiring:

- Exact fact-key mapping for editable review fields.
- Exact readiness API response shape.
- Exact onboarding return path after Meta OAuth.
- Exact destination for non-admin users after submitting for admin approval.

## Acceptance Criteria

- Onboarding has a polished 8-step frontend flow using mock data.
- Global navbar is hidden during onboarding.
- User can navigate through all 8 steps locally.
- Meta can be connected, skipped, or failed in mock state.
- Step 7 handles connected, skipped, failed, and empty-account states.
- Step 8 differentiates admin complete and non-admin pending-approval states.
- Components look consistent across every step.
- Mock data is backend-shaped and centralized.
- No backend API wiring is required for phase 1.
- No standalone mockup HTML, Tailwind CDN setup, Material Symbols dependency, or inline browser scripts are copied into app code.

## Self-Review

- Placeholder scan: no unresolved placeholders remain.
- Consistency check: frontend-first mock build is separated from later backend wiring.
- Scope check: phase 1 is limited to polished onboarding frontend with mock data.
- Ambiguity check: known future backend decisions are listed separately from approved phase 1 decisions.
