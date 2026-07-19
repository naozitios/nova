# Stitch-Mirrored Onboarding Mock Design

**Status:** Approved design, pending implementation

## Goal

Replace current generic eight-step onboarding with six-step, interactive mock UI that closely mirrors supplied Stitch HTML layouts. UI remains local browser state only. It must act as frontend scaffolding for later backend wiring, not fake network integration.

## Scope

### In scope

- Remove standalone Business Basics and Primary Objective steps.
- Merge primary objective into first source/context screen as dropdown.
- Use six-step flow and derive all progress labels/counts from flow metadata.
- Rebuild each screen around supplied HTML information architecture: card placement, grid structure, contextual sidebars, action placement, and visual hierarchy.
- Keep interactions local and visibly update each screen into credible user-completed states.
- Use project semantic tokens and shared primitives; eliminate onboarding hardcoded palette and duplicate card/button shells.
- Identify backend contracts already available and explicit gaps before API wiring begins.

### Out of scope

- Calling APIs, OAuth redirects, uploads, storage, polling, persistence, analytics, or real Meta data.
- Changing backend routes, database schema, or business-context domain logic.
- Building non-Stitch Business Basics screen.
- Reproducing generated HTML verbatim or keeping its incorrect hardcoded step counts.

## Canonical Flow

| Index | Key | Screen | Reference HTML | Continue rule in mock |
| --- | --- | --- | --- | --- |
| 1 | `add-business-sources` | Add Business Context | `onboarding_add_business_sources_updated_layout` | Any input, or explicit `Skip for now` |
| 2 | `connect-meta` | Connect Meta | `onboarding_connect_meta_actions_on_right` | Connect or `Do this later` |
| 3 | `processing` | Processing | `onboarding_processing_refined` | Mock processing reaches ready state |
| 4 | `review-business-context` | Review Business Context | `onboarding_business_context_infographic` | Confirm context |
| 5 | `select-ad-account` | Select Ad Account | `onboarding_select_account_refined` | Select account; omit only after Meta is skipped |
| 6 | `setup-complete` | Setup Complete | `onboarding_setup_complete_refined` | Dashboard CTA ends mock flow |

`business-basics` and `primary-objective` are removed from `OnboardingStepKey`, `ONBOARDING_STEPS`, page render cases, mock starting step, and flow tests. No screen may own a literal `Step N of M`; progress derives current index and total from six-step flow.

## Interaction Model

State lives only in page-owned `MockOnboardingState`, initialized through `structuredClone(mockOnboardingState)`. No `fetch`, TanStack Query, server action, router mutation, or persistence belongs in this phase.

Initial state must be believable but not block interaction. Controls always remain usable, and each action immediately produces rendered endstate for current screen.

| Screen | Local actions | Visible endstate |
| --- | --- | --- |
| Add Business Context | Choose objective from select; add mock file; edit brand notes; skip | Active Sources sidebar lists added source; notes/source cards show context collected |
| Connect Meta | Connect, retry failed connection, or defer | Sidebar and action area show connected/deferred state; selected connection exposes account step |
| Processing | Advance mock pipeline | Checklist completes, source progress completes, Next becomes enabled |
| Review Business Context | Edit identity, offerings, value propositions, audiences, goal, CPA; add source; save draft/confirm | Readiness score and editable infographics reflect state |
| Select Ad Account | Select mock account; refresh fixture list | Selected account card receives check state; CTA enabled |
| Setup Complete | Dashboard CTA | Completed connection summary and next actions use accumulated local state |

`Skip for now` on first screen advances without objective, source, or notes. `Do this later` on Meta advances to processing with deferred status. Meta-deferred path skips account selection when processing completes. These are explicit alternate paths, not validation failures.

### Primary Objective Mock Data

Keep Primary Objective in mock state until its backend persistence contract is defined. Replace generic business-objective fixtures with this simplified Meta campaign outcome list:

| Mock value | User-facing label |
| --- | --- |
| `awareness` | Awareness |
| `traffic` | Traffic |
| `engagement` | Engagement |
| `leads` | Leads |
| `app-promotion` | App Promotion |
| `sales` | Sales |

`Sales` is the current user-facing replacement for legacy “Conversions.” These values are presentation fixtures only; they are not yet Meta API request values and must not be persisted until product/backend defines their destination.

## Layout Requirements

### Shared frame

Create one onboarding frame capable of both reference modes:

- Contextual sidebar variant for source and Meta screens: heading, description, Active Sources card, optional Meta status card, tip card.
- Full-width processing variant: top bar, linear progress, no generic back affordance.
- Centered content variant for account selection and completion.
- Fixed action region whose layout matches each reference: labels, security/disclaimer copy, disabled state, and action grouping are per-screen rather than forced into one generic footer.

Shared progress receives step index/count from flow. Processing uses reference-style linear progress; completion uses filled step dots. Reference labels must show six-step numbering, never copied HTML values (`3 of 8`, `4 of 8`, etc.).

### Add Business Context

Mirror source reference: left contextual sidebar; right bento grid containing upload panel and Brand Specific Notes panel; security/footer action row. Add Primary Objective select inside right-side context collection area. Its options come from current mock objectives. `Skip for now` remains visible regardless of validation. Upload action adds local mock source only.

### Connect Meta

Mirror Meta reference: contextual sidebar with sources and Meta status; five access-permission cards; approval-based information banner; vertically grouped `Connect Meta` and `Do this later` controls. Connection action only changes mock connection state. No OAuth window or redirect in this phase.

### Processing

Mirror processing reference: top bar, linear progress, analysis heading, two-column bento layout. Left card is five-stage pipeline checklist. Right column uses source-status cards with progress. Footer contains active message/spinner and disabled/enabled Next action. Back is absent while processing.

### Review Business Context

Mirror infographic reference: readiness score sidebar plus editable grid. Include Core Identity with source attribution, offerings add/remove, editable value propositions, removable audience chips, funnel goal select and CPA input, add-source card, and Back/Save Draft/Confirm actions. All edits update mock compiled-profile state. Save Draft only communicates local saved state; it does not persist.

### Select Ad Account

Mirror account reference: centered heading, two-column account-card grid, account name/ID/currency/timezone, selection indicator, and dashed Refresh List card. Refresh replaces or reorders local fixture data only. Show continuation disclaimer below primary CTA. Do not render this step after Meta deferral.

### Setup Complete

Mirror completion reference: centered celebration, check treatment, lightweight local-only confetti effect, two-column connection summary, three next steps, and one full-width dashboard CTA. Remove secondary Settings CTA. Completion data derives from mock business, source, Meta, and account state.

## Design System Rules

- Use semantic Tailwind classes backed by `src/app/globals.css`: `bg-background`, `text-foreground`, `bg-card`, `text-card-foreground`, `border-border`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `text-destructive`, and input/ring tokens.
- Compose shared `Card`, `Button`, `Input`, and `Textarea` primitives where possible. Do not create parallel hardcoded card shells.
- Replace onboarding hex values (`#aa3016`, `#d14a2e`, `#251816`, `#645d58`, `#8d716b`, `#ead8d3`, `#fbf6f4`) with semantic tokens.
- Add narrowly scoped semantic tokens for success, warning, information, and onboarding accent surface only if existing global tokens cannot express needed state. Define both light and dark values.
- Status colors cannot use Tailwind named `red`, `emerald`, or `amber` directly. Use semantic tokens.
- Preserve Stitch layout hierarchy, but adapt colors, typography, focus states, hover states, and responsive behavior to project design system.

## Component Boundaries

`OnboardingShell` is no longer sole generic layout authority. Retain only shared navigation/progress mechanics or replace it with focused frame variants. Each screen owns content-specific layout and actions.

| Area | Responsibility |
| --- | --- |
| `flow.ts` | Six canonical step definitions, ordering, display metadata, local continuation policy |
| onboarding page | Own cloned mock state, transitions, conditional account-step omission, screen dispatch |
| frame/progress components | Shared responsive chrome and flow-derived progress only |
| source/Meta sidebar | Reusable contextual presentation of accumulated mock source/connection state |
| individual screen components | Screen-specific Stitch layout and local edit callbacks |
| mock data/types | Complete fixture data required by reference endstates, no transport concerns |

Remove `ObjectiveCard` if dropdown fully replaces it. Do not retain unused Business Basics components or flow cases.

## Backend Compatibility Audit

Backend already has substantial onboarding capability. Mock frontend intentionally does not call it yet.

| Future UI need | Existing backend support | Later wiring target |
| --- | --- | --- |
| Session lifecycle | `GET`/`POST /api/businesses/[id]/onboarding`, approval endpoint | Load/create session and send final approval |
| Sources | `GET`/`POST /api/businesses/[id]/context/sources` | Populate Active Sources sidebar; register manual/website sources |
| Upload | signed upload intent and completion endpoints | Replace mock upload action with signed-upload sequence |
| Meta | OAuth start/callback, account list, account selection | Connect CTA, connection status, account fixtures replacement |
| Processing | source processing service, job handlers, readiness computation | Poll or subscribe to job/readiness state |
| Business context | profile/version read, restore, approval endpoints | Load/edit/review compiled profile and approve draft |
| Questions | `GET /api/businesses/[id]/onboarding/questions` | Render unresolved questions where applicable |

### Confirmed gaps before real wiring

1. No onboarding-specific browser API client or TanStack Query layer exists. Create this before swapping any mock interaction for API calls.
2. Existing onboarding session route exposes session state only (`id`, `status`, `current_step`, lifecycle fields). It has no endpoint found for saving per-step progress or primary objective.
3. No persistence contract was found for new first-screen Primary Objective dropdown. Product/backend must define whether it is a business attribute, onboarding answer, or context-compilation purpose before integration.
4. Stitch review controls require field-level profile editing. Current audit confirms profile/version read and approval APIs, but an editable draft/update contract must be verified or added before connecting inputs.
5. Processing UI requires normalized stage/progress events. Existing jobs/processing entities exist, but frontend polling/subscription response shape and retry semantics need a dedicated contract.
6. Completion screen needs one aggregate view of business profile, source count, Meta connection, selected account, and readiness. Current routes are domain-specific; frontend must either compose requests or backend must provide an onboarding summary response.
7. Account selection is unavailable after Meta deferral by product flow. Backend integration must preserve this conditional path and avoid calling account APIs without a connection.

Do not infer backend support solely from HTML labels or mock shapes. Each integration begins with endpoint payload/authorization/error-state verification.

## Error and Empty States for Future Wiring

This mock release only renders local fixture branches. Future API release must add explicit loading, unauthorized, absent-session, upload validation, OAuth cancellation, processing failure/retry, no-account, stale-profile, and approval-conflict states. Current `metaRetry` mock behavior is not production error handling.

## Acceptance Criteria

1. Onboarding contains exactly six flow-defined steps; no obsolete key, component render case, or test expectation remains.
2. Each supplied Stitch HTML maps to one corresponding frontend screen with same major card placement and action hierarchy.
3. Each screen has visible, interactive local-state endstates; no network activity occurs.
4. First screen has objective dropdown and unconditional `Skip for now` path.
5. Meta-deferred path omits account selection; connected path requires account selection.
6. All progress/count labels are flow-derived and show six-step sequence.
7. Onboarding uses semantic color tokens and shared primitives; no listed hardcoded palette or named status colors remain.
8. Layout works on desktop and mobile without horizontal overflow; cards stack intentionally on narrow viewports.
9. Flow/unit tests cover direct, source-skip, Meta-defer, Meta-connected/account-selected, and processing-ready paths.
10. No API requests are introduced until separate backend-integration design is approved.

## Implementation Sequence

1. Reshape types, flow, mock state, and tests from eight steps to six.
2. Establish token-safe shared frame/sidebar/progress/action primitives.
3. Rebuild source and Meta screens against their Stitch references.
4. Rebuild processing, review, account, and completion screens.
5. Wire local transitions and alternate paths; remove obsolete components.
6. Verify responsive behavior, lint/typecheck/tests, and compare each route state to supplied HTML structure.
7. Start separate design for typed API client and endpoint contract closure only after mock UI approval.
