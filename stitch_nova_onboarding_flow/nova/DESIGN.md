---
name: NOVA
colors:
  surface: '#fff8f6'
  surface-dim: '#edd5d0'
  surface-bright: '#fff8f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fff0ed'
  surface-container: '#ffe9e5'
  surface-container-high: '#fce3dd'
  surface-container-highest: '#f6ddd8'
  on-surface: '#251816'
  on-surface-variant: '#59413c'
  inverse-surface: '#3c2d2a'
  inverse-on-surface: '#ffede9'
  outline: '#8d716b'
  outline-variant: '#e1bfb8'
  surface-tint: '#ad3218'
  primary: '#aa3016'
  on-primary: '#ffffff'
  primary-container: '#cc482c'
  on-primary-container: '#fffbff'
  inverse-primary: '#ffb4a4'
  secondary: '#645d58'
  on-secondary: '#ffffff'
  secondary-container: '#eae1da'
  on-secondary-container: '#6a635e'
  tertiary: '#006577'
  on-tertiary: '#ffffff'
  tertiary-container: '#008096'
  on-tertiary-container: '#f9fdff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad3'
  primary-fixed-dim: '#ffb4a4'
  on-primary-fixed: '#3d0600'
  on-primary-fixed-variant: '#8b1a01'
  secondary-fixed: '#eae1da'
  secondary-fixed-dim: '#cec5bf'
  on-secondary-fixed: '#1f1b17'
  on-secondary-fixed-variant: '#4b4641'
  tertiary-fixed: '#acedff'
  tertiary-fixed-dim: '#69d5ef'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#fff8f6'
  on-background: '#251816'
  surface-variant: '#f6ddd8'
  page-bg: '#FAFAF9'
  accent-hover: '#D14A2E'
  accent-soft: '#FEF3E2'
  accent-soft-alt: '#FFDAB9'
  ai-purple: '#A855F7'
  success-green: '#22C55E'
  warning-amber: '#F59E0B'
  error-red: '#EF4444'
  info-blue: '#3B82F6'
typography:
  headline-lg:
    fontFamily: Geist Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Geist Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Geist Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  metric-display:
    fontFamily: Geist Sans
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: tabular-nums
  body-default:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-lg:
    fontFamily: Geist Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  support-text:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  metadata:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  table-header:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-label:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  page-gutter-desktop: 6rem
  page-gutter-tablet: 3rem
  page-gutter-mobile: 1.5rem
  section-gap: 2.5rem
  grid-gap: 1.5rem
  card-padding: 1.5rem
  card-padding-focus: 2rem
  control-gap: 0.75rem
---

# NOVA Design System

## Purpose

This document defines the visual and interaction rules for NOVA. New screens should feel like part of the existing product, reuse shared primitives, and remain easy to scan for media buyers.

NOVA is an operational advertising workspace. The interface should feel calm, credible, lightweight, and action-oriented—not like a dense clone of Meta Ads Manager.

## Product principles

1. **Clarity before decoration** — performance, evidence, and recommended actions must be easy to scan.
2. **Progressive disclosure** — show the decision first; reveal supporting detail on demand.
3. **Human approval** — recommendations and AI-generated changes must show their impact before execution.
4. **Consistent hierarchy** — every screen uses the same page shell, headings, spacing, controls, and states.
5. **Data without noise** — prefer a small set of meaningful metrics over maximum information density.

## Existing foundation

- Next.js 16 and React 19
- Tailwind CSS 4
- shadcn/ui, New York style
- Radix UI primitives
- Geist Sans and Geist Mono
- Lucide icons
- Framer Motion
- Recharts for data visualisation
- CSS variables in `src/app/globals.css`

Use existing components from `src/components/ui` before creating new primitives.

## Visual direction

NOVA uses warm neutrals, white surfaces, soft borders, generous spacing, rounded geometry, and a restrained coral accent.

### Colour

| Role | Current value | Usage |
| --- | --- | --- |
| Page background | `stone-50` | Authenticated product pages |
| Primary surface | `white` | Cards, tables, forms, navigation |
| Primary text | `stone-900` | Titles, values, important labels |
| Secondary text | `stone-500` | Descriptions and metadata |
| Tertiary text | `stone-400` | Hints, timestamps, secondary labels |
| Border | `stone-100` / `stone-200` | Cards, tables, inputs, dividers |
| NOVA accent | `#E55A3C` | Primary actions, active steps, key highlights |
| Accent hover | `#D14A2E` | Hover state for coral actions |
| Accent soft | `#FEF3E2` → `#FFDAB9` | Icon tiles and quiet emphasis |
| Selection | `stone-900` | Active filters and neutral selected states |

Semantic colours:

- Green: success, healthy state, positive outcome
- Amber: warning, paused state, review required
- Red: destructive action, failure, critical issue
- Blue: informational state or platform identity
- Purple: AI-specific surfaces only

Do not use semantic colours decoratively. Coral is the product accent; purple should not become a competing general-purpose brand colour.

### Typography

Use Geist Sans for all interface text and Geist Mono only for identifiers, codes, or compact technical labels.

| Element | Recommended style |
| --- | --- |
| Page title | `text-3xl font-bold text-stone-900` |
| Section title | `text-xl font-semibold text-stone-900` |
| Card title | `text-lg font-semibold text-stone-900` |
| Primary metric | `text-3xl font-semibold tabular-nums` |
| Body | `text-sm/text-base text-stone-600` |
| Supporting text | `text-sm text-stone-500` |
| Metadata | `text-xs text-stone-400` |
| Table heading | `text-xs font-semibold uppercase tracking-wider` |

Use sentence case. Avoid all caps except short table headings and technical identifiers.

### Spacing and layout

Authenticated pages use:

```tsx
<div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
  <div className="max-w-7xl mx-auto">{/* content */}</div>
</div>
```

- Standard page content: `max-w-7xl`
- Focused forms and settings: `max-w-3xl`
- Page section gap: 32–40px
- Card padding: 24px; use 32px for focused forms
- Grid gap: 24px
- Control gap: 8–12px
- Keep primary content left-aligned

### Radius and elevation

| Element | Radius |
| --- | --- |
| Main cards | `rounded-3xl` |
| Secondary cards and panels | `rounded-2xl` |
| Icon containers | `rounded-xl` |
| Tables | `rounded-lg` |
| Primary CTA and search | `rounded-full` |
| Standard shadcn controls | Keep component default unless the page pattern requires otherwise |

Use `shadow-sm` with a light border for elevated surfaces. Avoid strong or layered shadows inside the application.

## Page anatomy

A normal authenticated page contains:

1. Global navigation
2. Page heading
3. Optional one-line description
4. Primary action or toolbar
5. Main data or workflow surface
6. Empty, loading, error, and success states

Do not add decorative page headers. The title should describe the current workspace directly: “Dashboard,” “Campaigns,” “Business Context,” or “Audit.”

## Core components

### Buttons

- Coral filled button: primary creation or continuation action
- Stone filled button: selected neutral state or high-confidence utility action
- Outline button: secondary action
- Ghost button: low-priority navigation or dismissal
- Red destructive button: irreversible action
- Green button: final publish/confirm action only when the outcome is genuinely successful or final

Use one primary button per surface. Pair icons with labels unless the icon is universally understood and has an accessible label.

### Cards

Default application card:

```
bg-white rounded-3xl p-6 shadow-sm border border-stone-100
```

Cards should represent one clear unit: metric, insight, account, rule, recommendation, or form step. Do not nest multiple heavily styled cards.

### Forms

- Labels sit above controls
- Standard input height: `h-11`
- Use helper text only when the expected format is unclear
- Group related fields into two-column grids on desktop and one column on mobile
- Validate inline and preserve entered values
- Disable continuation until required inputs are valid
- Review consequential changes before submission

### Tables

- White surface with a light stone border
- Sticky `stone-50` header
- Compact rows with tabular numerals
- Entire row may open details
- Keep campaign identity visible when horizontally scrolling
- Use status badges and small platform indicators
- Provide a purposeful empty state
- Do not show fake metrics or substitute unavailable values

### Status badges

Badges must use both text and colour. Never communicate status through colour alone.

- Active / healthy: green
- Paused / warning: amber
- Draft / neutral: stone
- Completed / informational: blue
- Failed / critical: red

### Insight and audit cards

Use a consistent information order:

1. Title
2. Category and severity
3. Affected object
4. What happened
5. Why it matters
6. Evidence
7. Recommended action
8. CTA

Lead with the finding and action. Supporting evidence should be visible or expandable, not buried in a separate evidence screen.

### AI recommendations and actions

Every executable AI recommendation must display:

- Proposed change
- Affected campaign, ad set, or ad
- Current value
- Proposed value
- Reason and evidence
- Expected effect
- Risk or confidence
- Approval control

No external account change occurs without explicit user confirmation. Show progress, partial failure, and a durable result after execution.

## Data visualisation

- Use charts only when they reveal a trend, comparison, or composition faster than numbers
- Label the metric, period, units, and comparison basis
- Use coral as the main series and neutral stone for comparison
- Reserve semantic colours for performance meaning
- Provide tooltips and accessible summaries
- Avoid gradients when they make exact values harder to read
- Prefer real chart components over hand-built decorative bars

Metrics must state their comparison window, for example “vs previous 7 days,” rather than vague text such as “vs yesterday” unless that is the selected period.

## Interaction states

Every data-driven component must define:

- Loading: skeleton matching the final layout
- Empty: explain why it is empty and provide the next action
- Filtered empty: explain that filters produced no matches
- Error: plain-language failure with retry
- Success: confirm exactly what changed
- Disabled: explain unmet requirements when not obvious
- Partial success: identify successful and failed items separately

Never render a blank region when data is missing.

## Motion

- Page/card entrance: subtle fade and 20px vertical movement
- Step transition: short horizontal movement
- Hover: colour, border, or small icon translation
- Duration: approximately 150–300ms for controls; up to 600ms for marketing-page entrances
- Respect `prefers-reduced-motion`
- Do not animate live metrics in a way that obscures their final value

## Responsive behaviour

- Mobile-first
- Collapse multi-column grids to one column
- Let tables scroll horizontally
- Replace desktop navigation with the existing mobile menu
- Keep key actions reachable without precision tapping
- Minimum touch target: 44×44px
- Avoid hiding essential context only to make a layout fit

## Accessibility

- Meet WCAG AA contrast
- Use semantic HTML and existing Radix primitives
- Maintain visible keyboard focus
- Provide labels for every input and icon-only control
- Do not use colour as the only signal
- Announce async results and validation errors
- Keep heading order logical
- Decorative emoji or icons must not replace product labels

## Content style

NOVA copy is direct and operational.

- Prefer “ROAS dropped 18% over 7 days” over “Your campaign may need attention”
- Prefer “Review recommendation” over “Fix now”
- Use domain terms that media buyers understand
- Explain unfamiliar technical terms inline
- Avoid hype, vague AI language, and emotional severity
- Button labels should describe the result: “Create campaign,” “Approve change,” “Reconnect Meta”

## Implementation rules

1. Use semantic CSS variables instead of adding more repeated hex colours.
2. Consolidate the existing coral values into tokens such as `--nova`, `--nova-hover`, and `--nova-soft`.
3. Prefer shared page, card, status, metric, and insight components over copied Tailwind strings.
4. Extend shadcn variants with CVA when a pattern repeats.
5. Use Lucide icons consistently; avoid inline SVG when a Lucide equivalent exists.
6. New screens must include responsive, loading, empty, error, and keyboard states.
7. Do not introduce another font, icon set, or general-purpose accent colour without updating this document.

## Current inconsistencies to resolve

- Hard-coded coral values should become semantic tokens.
- Product pages use both `gray` and `stone`; authenticated surfaces should standardise on `stone`.
- Card radii vary between shadcn defaults, `rounded-2xl`, and `rounded-3xl`; use the hierarchy defined above.
- Purple is prominent in the AI page; contain it to AI identity and keep coral as NOVA’s primary accent.
- Some platform colours conflict with semantic error colours; always include a platform label or logo.
- The hand-built performance bars should eventually use the shared chart library.
- Dark-mode variables exist, but the application has not established complete dark-mode behaviour. Do not claim dark-mode support until every main screen is verified.
- The current logo emoji is provisional. Treat it as a placeholder, not a reusable brand asset.
