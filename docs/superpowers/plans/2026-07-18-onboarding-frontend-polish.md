# Onboarding Frontend Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished 8-step NOVA onboarding frontend with backend-shaped mock data, hidden global navbar, optional Meta path, admin/non-admin completion states, and browser-based QA.

**Architecture:** The first phase is frontend-only. A local onboarding state model powers a single client route, shared onboarding components, and all 8 screens. Backend wiring is intentionally deferred, but mock data uses backend-like field names so future React Query replacement is direct.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind v4 classes, shadcn/Radix primitives, lucide-react icons, framer-motion where already useful, Vitest unit tests for pure flow helpers, `agent-browser` for visual/interaction verification.

## Global Constraints

- Keep an 8-step frontend onboarding flow.
- Recount steps from product logic, not from current wireframe labels.
- Hide the normal app navbar during onboarding.
- Treat Meta connection as optional.
- Do not allow non-admin users to complete final approval for now.
- Match business fields to what the backend currently provides.
- Build with mock data first, but keep mock data shaped like backend responses.
- Do not wire real backend calls in this frontend polish pass.
- Do not copy standalone mockup HTML, Tailwind CDN setup, Material Symbols dependency, or inline browser scripts into app code.
- Use `agent-browser` for final local browser QA.

---

## File Structure

- Modify: `src/components/Navbar.tsx`
  - Responsibility: hide existing global navbar for `/onboarding` paths.
- Create: `src/lib/onboarding/types.ts`
  - Responsibility: shared frontend-only onboarding types.
- Create: `src/lib/onboarding/flow.ts`
  - Responsibility: 8-step definitions and pure navigation/status helpers.
- Create: `src/lib/onboarding/mock-data.ts`
  - Responsibility: backend-shaped mock state and objective/ad-account/source/profile fixtures.
- Create: `src/lib/onboarding/flow.test.ts`
  - Responsibility: Vitest coverage for step ordering, optional Meta behavior, account gating, and completion copy states.
- Create: `src/components/onboarding/OnboardingShell.tsx`
  - Responsibility: isolated onboarding page frame, header, progress, content width, footer slot.
- Create: `src/components/onboarding/OnboardingProgress.tsx`
  - Responsibility: 8-step progress display with current, complete, skipped, and blocked states.
- Create: `src/components/onboarding/OnboardingActionFooter.tsx`
  - Responsibility: sticky footer action area.
- Create: `src/components/onboarding/OnboardingCard.tsx`
  - Responsibility: shared warm card surface.
- Create: `src/components/onboarding/ObjectiveCard.tsx`
  - Responsibility: selectable objective cards.
- Create: `src/components/onboarding/UploadDropzone.tsx`
  - Responsibility: mock upload/drag-drop visual area.
- Create: `src/components/onboarding/SourceStatusCard.tsx`
  - Responsibility: source status row/card.
- Create: `src/components/onboarding/MetaConnectPanel.tsx`
  - Responsibility: optional Meta connection states.
- Create: `src/components/onboarding/ProcessingTimeline.tsx`
  - Responsibility: source processing and readiness display.
- Create: `src/components/onboarding/BusinessContextReview.tsx`
  - Responsibility: compiled profile review and backend-question renderer.
- Create: `src/components/onboarding/AdAccountSelector.tsx`
  - Responsibility: Meta ad account radio-card selector with skipped/failed states.
- Create: `src/components/onboarding/CompletionSummary.tsx`
  - Responsibility: admin complete and non-admin pending-approval final states.
- Create: `src/app/onboarding/[businessId]/page.tsx`
  - Responsibility: client route composing all 8 steps with local mock state.

---

### Task 1: Branch Baseline And Flow Model

**Files:**
- Create: `src/lib/onboarding/types.ts`
- Create: `src/lib/onboarding/flow.ts`
- Create: `src/lib/onboarding/mock-data.ts`
- Create: `src/lib/onboarding/flow.test.ts`

**Interfaces:**
- Produces: `ONBOARDING_STEPS: OnboardingStepDefinition[]`
- Produces: `getStepByIndex(index: number): OnboardingStepDefinition`
- Produces: `getNextStepIndex(state: MockOnboardingState, currentIndex: number): number`
- Produces: `canContinueFromStep(state: MockOnboardingState, currentIndex: number): boolean`
- Produces: `getCompletionStatus(state: MockOnboardingState): 'complete' | 'pending_admin_approval'`
- Produces: `mockOnboardingState: MockOnboardingState`
- Later tasks consume these exports in the onboarding page and components.

- [ ] **Step 1: Write failing flow tests**

Create `src/lib/onboarding/flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mockOnboardingState } from './mock-data';
import {
  ONBOARDING_STEPS,
  canContinueFromStep,
  getCompletionStatus,
  getNextStepIndex,
  getStepByIndex,
} from './flow';

describe('onboarding flow', () => {
  it('defines exactly 8 product steps in order', () => {
    expect(ONBOARDING_STEPS.map((step) => step.title)).toEqual([
      'Business Basics',
      'Primary Objective',
      'Add Business Sources',
      'Connect Meta',
      'Processing',
      'Review Business Context',
      'Select Ad Account',
      'Setup Complete',
    ]);
    expect(ONBOARDING_STEPS).toHaveLength(8);
  });

  it('returns steps by zero-based index', () => {
    expect(getStepByIndex(0).key).toBe('business-basics');
    expect(getStepByIndex(7).key).toBe('setup-complete');
  });

  it('allows step 4 to continue when Meta is skipped', () => {
    const state = {
      ...mockOnboardingState,
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'skipped' as const },
    };

    expect(canContinueFromStep(state, 3)).toBe(true);
    expect(getNextStepIndex(state, 3)).toBe(4);
  });

  it('requires selected ad account when Meta is connected', () => {
    const state = {
      ...mockOnboardingState,
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'connected' as const },
      selectedAdAccountId: null,
    };

    expect(canContinueFromStep(state, 6)).toBe(false);
  });

  it('allows ad account step when Meta was skipped', () => {
    const state = {
      ...mockOnboardingState,
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'skipped' as const },
      selectedAdAccountId: null,
    };

    expect(canContinueFromStep(state, 6)).toBe(true);
  });

  it('marks non-admin final state as pending admin approval', () => {
    const state = {
      ...mockOnboardingState,
      permissions: { ...mockOnboardingState.permissions, canApprove: false },
    };

    expect(getCompletionStatus(state)).toBe('pending_admin_approval');
  });

  it('marks admin final state as complete', () => {
    const state = {
      ...mockOnboardingState,
      permissions: { ...mockOnboardingState.permissions, canApprove: true },
    };

    expect(getCompletionStatus(state)).toBe('complete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/lib/onboarding/flow.test.ts`

Expected: FAIL because `src/lib/onboarding/*` files do not exist yet.

- [ ] **Step 3: Create onboarding types**

Create `src/lib/onboarding/types.ts`:

```ts
export type OnboardingStepKey =
  | 'business-basics'
  | 'primary-objective'
  | 'add-business-sources'
  | 'connect-meta'
  | 'processing'
  | 'review-business-context'
  | 'select-ad-account'
  | 'setup-complete';

export type MetaConnectionStatus = 'not_connected' | 'connected' | 'skipped' | 'failed';
export type SourceStatus = 'added' | 'uploading' | 'processing' | 'complete' | 'failed';
export type ProcessingStatus = 'idle' | 'processing' | 'ready' | 'blocked' | 'failed';

export type OnboardingStepDefinition = {
  key: OnboardingStepKey;
  title: string;
  eyebrow: string;
  description: string;
  optional?: boolean;
};

export type MockBusiness = {
  id: string;
  workspaceId: string;
  name: string;
  websiteUrl: string | null;
  status: string;
};

export type MockOnboardingSession = {
  id: string;
  businessId: string;
  workspaceId: string;
  status: string;
  currentStep: string | null;
};

export type MockObjective = {
  id: string;
  title: string;
  description: string;
  purpose: 'CAMPAIGN_SETUP' | 'PERFORMANCE_ANALYSIS' | 'OPTIMIZATION' | 'CREATIVE_BRIEF' | 'TRACKING_AUDIT';
};

export type MockSource = {
  id: string;
  sourceType: 'website' | 'upload' | 'manual_note';
  sourceName: string;
  externalReference: string | null;
  status: SourceStatus;
  currentStage: string | null;
  progress: number;
  error: string | null;
};

export type MockProcessingState = {
  overallStatus: ProcessingStatus;
  currentMessage: string;
  sources: MockSource[];
  blockers: string[];
  canContinue: boolean;
};

export type MockCompiledProfile = {
  summary: string;
  offerings: string[];
  valuePropositions: string[];
  targetAudiences: string[];
  funnelGoal: string;
  targetCpa: string;
};

export type MockQuestion = {
  factKey: string;
  questionType: 'text' | 'select' | 'multi_select';
  question: string;
  options: string[];
  answer: string | string[] | null;
};

export type MockMetaConnection = {
  status: MetaConnectionStatus;
  connectionId: string | null;
  connectedAt: string | null;
  error: string | null;
};

export type MockAdAccount = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  status: string;
};

export type MockPermissions = {
  canApprove: boolean;
  role: 'viewer' | 'editor' | 'admin';
};

export type MockCompletion = {
  approvalStatus: 'approved' | 'ready_for_admin_approval';
  dashboardHref: string;
  settingsHref: string;
};

export type MockOnboardingState = {
  business: MockBusiness;
  onboardingSession: MockOnboardingSession;
  selectedObjective: string | null;
  objectiveOptions: MockObjective[];
  sources: MockSource[];
  manualNotes: string;
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

- [ ] **Step 4: Create flow helpers**

Create `src/lib/onboarding/flow.ts`:

```ts
import type { MockOnboardingState, OnboardingStepDefinition } from './types';

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    key: 'business-basics',
    title: 'Business Basics',
    eyebrow: 'Step 1 of 8',
    description: 'Confirm the business NOVA is setting up.',
  },
  {
    key: 'primary-objective',
    title: 'Primary Objective',
    eyebrow: 'Step 2 of 8',
    description: 'Choose what NOVA should prioritize first.',
  },
  {
    key: 'add-business-sources',
    title: 'Add Business Sources',
    eyebrow: 'Step 3 of 8',
    description: 'Add website, files, decks, and notes for NOVA to learn from.',
  },
  {
    key: 'connect-meta',
    title: 'Connect Meta',
    eyebrow: 'Step 4 of 8',
    description: 'Connect Meta now or skip and do it later.',
    optional: true,
  },
  {
    key: 'processing',
    title: 'Processing',
    eyebrow: 'Step 5 of 8',
    description: 'NOVA analyzes submitted context sources.',
  },
  {
    key: 'review-business-context',
    title: 'Review Business Context',
    eyebrow: 'Step 6 of 8',
    description: 'Review the business profile NOVA compiled.',
  },
  {
    key: 'select-ad-account',
    title: 'Select Ad Account',
    eyebrow: 'Step 7 of 8',
    description: 'Choose an ad account if Meta is connected.',
    optional: true,
  },
  {
    key: 'setup-complete',
    title: 'Setup Complete',
    eyebrow: 'Step 8 of 8',
    description: 'Review setup status and continue into NOVA.',
  },
];

export function getStepByIndex(index: number): OnboardingStepDefinition {
  const step = ONBOARDING_STEPS[index];

  if (!step) {
    throw new RangeError(`Unknown onboarding step index: ${index}`);
  }

  return step;
}

export function canContinueFromStep(state: MockOnboardingState, currentIndex: number): boolean {
  const step = getStepByIndex(currentIndex);

  if (step.key === 'primary-objective') return state.selectedObjective !== null;
  if (step.key === 'add-business-sources') return state.sources.length > 0 || state.manualNotes.trim().length > 0;
  if (step.key === 'connect-meta') return state.metaConnection.status !== 'not_connected';
  if (step.key === 'processing') return state.processing.canContinue;
  if (step.key === 'select-ad-account') {
    if (state.metaConnection.status === 'connected') return state.selectedAdAccountId !== null;
    return true;
  }

  return true;
}

export function getNextStepIndex(state: MockOnboardingState, currentIndex: number): number {
  if (!canContinueFromStep(state, currentIndex)) return currentIndex;
  return Math.min(currentIndex + 1, ONBOARDING_STEPS.length - 1);
}

export function getCompletionStatus(state: MockOnboardingState): 'complete' | 'pending_admin_approval' {
  return state.permissions.canApprove ? 'complete' : 'pending_admin_approval';
}
```

- [ ] **Step 5: Create mock data**

Create `src/lib/onboarding/mock-data.ts`:

```ts
import type { MockOnboardingState } from './types';

export const mockOnboardingState: MockOnboardingState = {
  business: {
    id: 'biz_nova_media',
    workspaceId: 'ws_demo_agency',
    name: 'Nova Media Group',
    websiteUrl: 'https://novamediagroup.example',
    status: 'active',
  },
  onboardingSession: {
    id: 'onb_demo_001',
    businessId: 'biz_nova_media',
    workspaceId: 'ws_demo_agency',
    status: 'created',
    currentStep: 'business-basics',
  },
  selectedObjective: 'campaign_setup',
  objectiveOptions: [
    {
      id: 'campaign_setup',
      title: 'Campaign setup',
      description: 'Prepare audience, offer, and positioning context for new launches.',
      purpose: 'CAMPAIGN_SETUP',
    },
    {
      id: 'performance_analysis',
      title: 'Performance analysis',
      description: 'Help NOVA explain what is working and where budget is leaking.',
      purpose: 'PERFORMANCE_ANALYSIS',
    },
    {
      id: 'optimization',
      title: 'Optimization',
      description: 'Prioritize actions that improve spend efficiency and conversion quality.',
      purpose: 'OPTIMIZATION',
    },
    {
      id: 'creative_brief',
      title: 'Creative brief',
      description: 'Turn business context into strong angles, claims, and creative direction.',
      purpose: 'CREATIVE_BRIEF',
    },
    {
      id: 'tracking_audit',
      title: 'Tracking audit',
      description: 'Check whether measurement, attribution, and funnel signals are usable.',
      purpose: 'TRACKING_AUDIT',
    },
  ],
  sources: [
    {
      id: 'src_website',
      sourceType: 'website',
      sourceName: 'Company website',
      externalReference: 'https://novamediagroup.example',
      status: 'complete',
      currentStage: 'extracted',
      progress: 100,
      error: null,
    },
    {
      id: 'src_deck',
      sourceType: 'upload',
      sourceName: 'Q3 growth deck.pdf',
      externalReference: null,
      status: 'processing',
      currentStage: 'summarizing',
      progress: 78,
      error: null,
    },
  ],
  manualNotes: 'Premium lead generation agency focused on high-consideration B2B services.',
  processing: {
    overallStatus: 'ready',
    currentMessage: 'Business context is ready for review.',
    sources: [],
    blockers: [],
    canContinue: true,
  },
  compiledProfile: {
    summary: 'Nova Media Group helps B2B teams turn paid acquisition into qualified pipeline.',
    offerings: ['Paid social strategy', 'Creative testing', 'Funnel analysis', 'Performance optimization'],
    valuePropositions: [
      'Turns fragmented ad data into clear next actions.',
      'Combines creative, audience, and funnel context before recommending spend changes.',
    ],
    targetAudiences: ['B2B founders', 'Growth leads', 'Agency operators'],
    funnelGoal: 'Generate qualified sales conversations',
    targetCpa: '$180',
  },
  questions: [
    {
      factKey: 'audience.primary_segments',
      questionType: 'text',
      question: 'Which customer segment should NOVA prioritize first?',
      options: [],
      answer: 'B2B SaaS teams with active paid social spend.',
    },
  ],
  metaConnection: {
    status: 'skipped',
    connectionId: null,
    connectedAt: null,
    error: null,
  },
  adAccounts: [
    {
      id: 'act_822109',
      name: 'Nova Media Growth',
      currency: 'USD',
      timezone: 'America/New_York',
      status: 'active',
    },
    {
      id: 'act_774512',
      name: 'Nova Sandbox',
      currency: 'USD',
      timezone: 'America/Los_Angeles',
      status: 'active',
    },
  ],
  selectedAdAccountId: null,
  permissions: {
    canApprove: false,
    role: 'editor',
  },
  completion: {
    approvalStatus: 'ready_for_admin_approval',
    dashboardHref: '/dashboard',
    settingsHref: '/settings',
  },
};

mockOnboardingState.processing.sources = mockOnboardingState.sources;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:unit -- src/lib/onboarding/flow.test.ts`

Expected: PASS for all onboarding flow tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/onboarding/types.ts src/lib/onboarding/flow.ts src/lib/onboarding/mock-data.ts src/lib/onboarding/flow.test.ts
git commit -m "feat: add onboarding flow model"
```

---

### Task 2: Hide Global Navbar For Onboarding

**Files:**
- Modify: `src/components/Navbar.tsx`

**Interfaces:**
- Consumes: `usePathname()` already imported in `Navbar`.
- Produces: global navbar hidden whenever `pathname` starts with `/onboarding`.

- [ ] **Step 1: Add route guard**

Modify `src/components/Navbar.tsx` inside `Navbar()` immediately after `const pathname = usePathname();`:

```tsx
  if (pathname?.startsWith('/onboarding')) {
    return null;
  }
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS or no new lint errors from `src/components/Navbar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/Navbar.tsx
git commit -m "feat: hide navbar during onboarding"
```

---

### Task 3: Shared Onboarding Layout Components

**Files:**
- Create: `src/components/onboarding/OnboardingCard.tsx`
- Create: `src/components/onboarding/OnboardingActionFooter.tsx`
- Create: `src/components/onboarding/OnboardingProgress.tsx`
- Create: `src/components/onboarding/OnboardingShell.tsx`

**Interfaces:**
- Consumes: `ONBOARDING_STEPS` from `src/lib/onboarding/flow.ts`.
- Produces: `OnboardingShell`, `OnboardingCard`, `OnboardingActionFooter`, `OnboardingProgress` for all step screens.

- [ ] **Step 1: Create shared card component**

Create `src/components/onboarding/OnboardingCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type OnboardingCardProps = {
  children: ReactNode;
  className?: string;
};

export function OnboardingCard({ children, className }: OnboardingCardProps) {
  return (
    <section className={cn('rounded-[2rem] border border-[#ead8d3] bg-white/85 p-6 shadow-sm shadow-stone-200/60 md:p-8', className)}>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create footer component**

Create `src/components/onboarding/OnboardingActionFooter.tsx`:

```tsx
import type { ReactNode } from 'react';

type OnboardingActionFooterProps = {
  children: ReactNode;
};

export function OnboardingActionFooter({ children }: OnboardingActionFooterProps) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-[#ead8d3] bg-[#fbf6f4]/90 px-4 py-4 backdrop-blur-xl md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create progress component**

Create `src/components/onboarding/OnboardingProgress.tsx`:

```tsx
import { Check } from 'lucide-react';
import { ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import { cn } from '@/lib/utils';

type OnboardingProgressProps = {
  currentIndex: number;
  skippedStepKeys?: string[];
  blockedStepKeys?: string[];
};

export function OnboardingProgress({ currentIndex, skippedStepKeys = [], blockedStepKeys = [] }: OnboardingProgressProps) {
  return (
    <div className="w-full" aria-label="Onboarding progress">
      <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.24em] text-[#8d716b]">
        <span>{ONBOARDING_STEPS[currentIndex]?.eyebrow}</span>
        <span>{Math.round(((currentIndex + 1) / ONBOARDING_STEPS.length) * 100)}%</span>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {ONBOARDING_STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const current = index === currentIndex;
          const skipped = skippedStepKeys.includes(step.key);
          const blocked = blockedStepKeys.includes(step.key);

          return (
            <div key={step.key} className="group relative">
              <div
                className={cn(
                  'h-2 rounded-full bg-[#ecd8d2] transition-colors',
                  complete && 'bg-[#aa3016]',
                  current && 'bg-[#d14a2e]',
                  skipped && 'bg-[#d8ccc8]',
                  blocked && 'bg-[#f59e0b]'
                )}
              />
              <div className="mt-2 hidden text-[11px] font-medium text-[#645d58] lg:block">
                {complete && !skipped ? <Check className="mb-1 size-3 text-[#aa3016]" /> : null}
                <span className={cn(current && 'text-[#251816]', skipped && 'text-[#8d716b]')}>{step.title}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create shell component**

Create `src/components/onboarding/OnboardingShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ONBOARDING_STEPS } from '@/lib/onboarding/flow';
import { OnboardingProgress } from './OnboardingProgress';

type OnboardingShellProps = {
  currentIndex: number;
  children: ReactNode;
  footer: ReactNode;
  onBack: () => void;
  canGoBack: boolean;
  skippedStepKeys?: string[];
};

export function OnboardingShell({ currentIndex, children, footer, onBack, canGoBack, skippedStepKeys = [] }: OnboardingShellProps) {
  const step = ONBOARDING_STEPS[currentIndex];

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf6f4] text-[#251816]">
      <header className="border-b border-[#ead8d3] bg-[#fbf6f4]/90 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} disabled={!canGoBack} aria-label="Go back">
            <ArrowLeft className="size-4" />
          </Button>
          <Link href="/dashboard" className="text-lg font-semibold tracking-[-0.03em] text-[#251816]">
            NOVA
          </Link>
          <div className="ml-auto">
            <Button asChild variant="ghost" size="icon" aria-label="Exit onboarding">
              <Link href="/dashboard">
                <X className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <OnboardingProgress currentIndex={currentIndex} skippedStepKeys={skippedStepKeys} />
        <div className="mt-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#8d716b]">{step.eyebrow}</p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.06em] text-[#251816] md:text-6xl">{step.title}</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[#645d58] md:text-lg">{step.description}</p>
          </aside>
          <div>{children}</div>
        </div>
      </div>
      {footer}
    </main>
  );
}
```

- [ ] **Step 5: Run lint**

Run: `npm run lint`

Expected: PASS or no new lint errors from onboarding components.

- [ ] **Step 6: Commit**

```bash
git add src/components/onboarding/OnboardingCard.tsx src/components/onboarding/OnboardingActionFooter.tsx src/components/onboarding/OnboardingProgress.tsx src/components/onboarding/OnboardingShell.tsx
git commit -m "feat: add onboarding shell components"
```

---

### Task 4: Step-Specific Components

**Files:**
- Create: `src/components/onboarding/ObjectiveCard.tsx`
- Create: `src/components/onboarding/UploadDropzone.tsx`
- Create: `src/components/onboarding/SourceStatusCard.tsx`
- Create: `src/components/onboarding/MetaConnectPanel.tsx`
- Create: `src/components/onboarding/ProcessingTimeline.tsx`
- Create: `src/components/onboarding/BusinessContextReview.tsx`
- Create: `src/components/onboarding/AdAccountSelector.tsx`
- Create: `src/components/onboarding/CompletionSummary.tsx`

**Interfaces:**
- Consumes types from `src/lib/onboarding/types.ts`.
- Produces presentational components for route composition.

- [ ] **Step 1: Create objective card**

Create `src/components/onboarding/ObjectiveCard.tsx` with props `{ objective, selected, onSelect }`. Use a button root, `rounded-[1.5rem]`, selected border `#aa3016`, and title/description text from `MockObjective`.

- [ ] **Step 2: Create upload dropzone**

Create `src/components/onboarding/UploadDropzone.tsx` with props `{ onMockUpload }`. Use a dashed warm border, upload icon from `lucide-react`, supported copy: `PDF, DOCX, PPTX, XLSX up to 50MB`, and call `onMockUpload()` on button click.

- [ ] **Step 3: Create source status card**

Create `src/components/onboarding/SourceStatusCard.tsx` with props `{ source }`. Render `source.sourceName`, `source.sourceType`, status label, progress bar when progress is between 1 and 99, and error text when `source.error` exists.

- [ ] **Step 4: Create Meta connect panel**

Create `src/components/onboarding/MetaConnectPanel.tsx` with props `{ status, onConnect, onSkip, onRetry }`. Render four states: not connected, connected, skipped, failed. Include copy that Meta is optional and can be connected later.

- [ ] **Step 5: Create processing timeline**

Create `src/components/onboarding/ProcessingTimeline.tsx` with props `{ processing }`. Render `processing.currentMessage`, source cards, blockers, and a ready badge when `processing.canContinue` is true.

- [ ] **Step 6: Create business context review**

Create `src/components/onboarding/BusinessContextReview.tsx` with props `{ profile, questions, canApprove }`. Render summary, offerings, value propositions, target audiences, funnel goal, target CPA, questions, and approval notice. Non-admin copy must say: `Workspace admin approval is required before NOVA uses this context.`

- [ ] **Step 7: Create ad account selector**

Create `src/components/onboarding/AdAccountSelector.tsx` with props `{ metaStatus, accounts, selectedAdAccountId, onSelect, onRefresh, onRetryMeta }`. Render skipped state when `metaStatus === 'skipped'`, failed state when `metaStatus === 'failed'`, empty state when connected with no accounts, and radio-card account list when connected with accounts.

- [ ] **Step 8: Create completion summary**

Create `src/components/onboarding/CompletionSummary.tsx` with props `{ state, completionStatus }`. Render business name, sources count, Meta status, admin/non-admin approval result, dashboard CTA, and settings CTA.

- [ ] **Step 9: Run lint**

Run: `npm run lint`

Expected: PASS or no new lint errors from onboarding components.

- [ ] **Step 10: Commit**

```bash
git add src/components/onboarding
git commit -m "feat: add onboarding step components"
```

---

### Task 5: Compose The 8-Step Onboarding Route

**Files:**
- Create: `src/app/onboarding/[businessId]/page.tsx`

**Interfaces:**
- Consumes all onboarding model/helpers/components.
- Produces visible route `/onboarding/[businessId]` with local mock navigation through all 8 steps.

- [ ] **Step 1: Create client page shell**

Create `src/app/onboarding/[businessId]/page.tsx` as a client component with local state initialized from `mockOnboardingState`, `currentIndex`, `goNext`, `goBack`, and `renderStep()`.

- [ ] **Step 2: Compose step 1 Business Basics**

Use `OnboardingCard`. Show business name, website URL fallback `Website not provided`, workspace ID, status, and confirmation copy.

- [ ] **Step 3: Compose step 2 Primary Objective**

Render `ObjectiveCard` for every `objectiveOptions` item. Selecting card updates `selectedObjective`.

- [ ] **Step 4: Compose step 3 Add Business Sources**

Render `UploadDropzone`, `SourceStatusCard` list, manual notes textarea, and supported-file guidance. Mock upload adds a new complete source named `Brand voice notes.pdf`.

- [ ] **Step 5: Compose step 4 Connect Meta**

Render `MetaConnectPanel`. Mock connect sets status `connected`, connection ID `conn_mock_meta`, and first account selected remains null. Skip sets status `skipped`.

- [ ] **Step 6: Compose step 5 Processing**

Render `ProcessingTimeline`. Add a mock control button labeled `Mark ready for review` only when `processing.canContinue` is false.

- [ ] **Step 7: Compose step 6 Review Business Context**

Render `BusinessContextReview` and pass `permissions.canApprove`.

- [ ] **Step 8: Compose step 7 Select Ad Account**

Render `AdAccountSelector`. Selecting account sets `selectedAdAccountId`.

- [ ] **Step 9: Compose step 8 Setup Complete**

Render `CompletionSummary` with `getCompletionStatus(state)`.

- [ ] **Step 10: Wire footer actions**

Use `OnboardingActionFooter`. Left side shows contextual helper text. Right side shows Back and Continue buttons. Continue is disabled when `canContinueFromStep(state, currentIndex)` is false. Final step button links to `/dashboard`.

- [ ] **Step 11: Run unit tests and lint**

Run: `npm run test:unit -- src/lib/onboarding/flow.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: PASS or no new lint errors from onboarding files.

- [ ] **Step 12: Commit**

```bash
git add src/app/onboarding/[businessId]/page.tsx
git commit -m "feat: compose onboarding mock flow"
```

---

### Task 6: Visual Polish Pass

**Files:**
- Modify: `src/app/onboarding/[businessId]/page.tsx`
- Modify: `src/components/onboarding/*.tsx`

**Interfaces:**
- Consumes existing route and components.
- Produces consistent product-quality visual experience across desktop and mobile.

- [ ] **Step 1: Apply visual consistency pass**

Use these exact visual rules across onboarding components:

- Page background: `bg-[#fbf6f4]`
- Primary action: `bg-[#aa3016] hover:bg-[#d14a2e] text-white`
- Warm borders: `border-[#ead8d3]`
- Muted text: `text-[#645d58]`
- Main text: `text-[#251816]`
- Radius: cards use `rounded-[2rem]`, smaller cards use `rounded-[1.5rem]`
- Mobile: every grid collapses to one column below `lg`
- No emoji icons
- No Material Symbols

- [ ] **Step 2: Verify mobile class behavior manually in code**

Check every onboarding grid has mobile-first one-column layout and only adds multi-column at `md` or `lg` breakpoints.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Next build succeeds with onboarding route included.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/[businessId]/page.tsx src/components/onboarding
git commit -m "style: polish onboarding mock screens"
```

---

### Task 7: Agent-Browser QA

**Files:**
- No source files required unless QA finds defects.

**Interfaces:**
- Consumes local route `/onboarding/biz_nova_media`.
- Produces screenshots and validation notes.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

Expected: Next dev server starts on `http://localhost:3000`.

- [ ] **Step 2: Open onboarding route with agent-browser**

Run: `agent-browser open --enable react-devtools http://localhost:3000/onboarding/biz_nova_media`

Expected: Browser opens onboarding step 1.

- [ ] **Step 3: Capture desktop screenshot**

Run: `agent-browser screenshot --full /tmp/nova-onboarding-desktop.png`

Expected: Screenshot file exists and shows no global navbar.

- [ ] **Step 4: Check interactive snapshot**

Run: `agent-browser snapshot -i -c`

Expected: Snapshot includes NOVA onboarding controls, business basics content, Continue button, Exit control, and no global Dashboard/Campaigns/AI/Optimization nav links.

- [ ] **Step 5: Click through all 8 steps**

Use `agent-browser snapshot -i -c` to find the Continue button ref, then run `agent-browser click @eN` for each current Continue ref. Re-run snapshot after each click because refs become stale after page changes.

Expected visible sequence:

1. Business Basics
2. Primary Objective
3. Add Business Sources
4. Connect Meta
5. Processing
6. Review Business Context
7. Select Ad Account
8. Setup Complete

- [ ] **Step 6: Verify optional Meta skip path**

Restart route with `agent-browser open http://localhost:3000/onboarding/biz_nova_media`, navigate to Connect Meta, click `Skip for now`, continue to Select Ad Account.

Expected: Select Ad Account step shows Meta skipped state and allows Continue.

- [ ] **Step 7: Verify Meta connected path**

Restart route, navigate to Connect Meta, click `Connect Meta`, continue to Select Ad Account.

Expected: Account cards appear, Continue is disabled before selecting an account, then enabled after selecting one.

- [ ] **Step 8: Verify React tree**

Run: `agent-browser react tree`

Expected: Tree includes onboarding page and onboarding components. If command reports React DevTools hook missing, close browser and reopen with `agent-browser open --enable react-devtools http://localhost:3000/onboarding/biz_nova_media`.

- [ ] **Step 9: Verify web vitals smoke check**

Run: `agent-browser vitals http://localhost:3000/onboarding/biz_nova_media`

Expected: Command completes and reports FCP/LCP/CLS/TTFB values. Treat extreme CLS or load failures as defects.

- [ ] **Step 10: Fix defects found by QA**

If any expected result fails, make the smallest source change in the relevant component or page, then rerun the failed agent-browser step.

- [ ] **Step 11: Commit QA fixes**

If QA required source changes:

```bash
git add src/app/onboarding/[businessId]/page.tsx src/components/onboarding src/components/Navbar.tsx
git commit -m "fix: address onboarding browser QA"
```

If QA required no source changes, skip commit.

---

### Task 8: Final Verification And Push

**Files:**
- No new files required.

**Interfaces:**
- Consumes completed implementation.
- Produces pushed branch ready for review.

- [ ] **Step 1: Run focused tests**

Run: `npm run test:unit -- src/lib/onboarding/flow.test.ts`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS or only pre-existing unrelated warnings if repo already has them.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Confirm git status**

Run: `git status --short --branch`

Expected: branch `feature/onboarding-frontend-polish`; no unstaged source changes unless intentionally left for user review.

- [ ] **Step 5: Push branch**

Run: `git push origin feature/onboarding-frontend-polish`

Expected: branch pushed successfully.

---

## Self-Review

- Spec coverage: all 8 steps, hidden navbar, optional Meta, non-admin approval state, mock-first backend-shaped data, and agent-browser QA are represented by tasks.
- Placeholder scan: no unresolved placeholder markers or placeholder sections remain.
- Type consistency: helpers and mock data use names defined in `types.ts`; route consumes helpers from `flow.ts` and data from `mock-data.ts`.
- Scope check: plan does not wire backend APIs; backend wiring remains future work.
