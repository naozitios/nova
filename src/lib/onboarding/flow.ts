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
  if (step.key === 'connect-meta') {
    return state.metaConnection.status === 'connected' || state.metaConnection.status === 'skipped';
  }
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

type ReviewStepInput = {
  loading: boolean;
  error: string | null;
  review: { unresolvedFields: string[] } | null;
};

export function canContinueFromReviewStep(input: ReviewStepInput): boolean {
  if (input.loading) return false;
  if (input.error !== null) return false;
  if (input.review === null) return false;
  return input.review.unresolvedFields.length === 0;
}
