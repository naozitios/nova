import type { MockOnboardingState, OnboardingStepDefinition } from './types';

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    key: 'business-basics',
    title: 'Business Basics',
    eyebrow: 'Step 1 of 6',
    description: 'Define your commercial footprint.',
  },
  {
    key: 'add-business-sources',
    title: 'Add Business Sources',
    eyebrow: 'Step 2 of 6',
    description: 'Add website, files, decks, and notes for NOVA to learn from.',
  },
  {
    key: 'connect-meta',
    title: 'Connect Meta',
    eyebrow: 'Step 3 of 6',
    description: 'Connect Meta now or skip and do it later.',
    optional: true,
  },
  {
    key: 'processing',
    title: 'Analyzing Your Digital Footprint',
    eyebrow: 'Step 4 of 6',
    description: "Our AI is currently mapping your brand's ecosystem to build a tailored campaign strategy. This usually takes 30-60 seconds.",
  },
  {
    key: 'review-business-context',
    title: 'Review Business Context',
    eyebrow: 'Step 5 of 6',
    description: 'Review the business profile NOVA compiled.',
  },
  {
    key: 'setup-complete',
    title: 'Setup Complete',
    eyebrow: 'Step 6 of 6',
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

  if (step.key === 'business-basics')
    return (
      state.businessBasics.businessName.trim().length > 0 &&
      state.businessBasics.primaryMarket.length > 0 &&
      state.businessBasics.businessType.length > 0 &&
      state.businessBasics.advertisingGoal.length > 0
    );
  if (step.key === 'add-business-sources') return true;
  if (step.key === 'connect-meta') {
    if (state.metaConnection.status === 'skipped') return true;
    if (state.metaConnection.status === 'connected') return state.selectedAdAccountId !== null;
    return false;
  }
  if (step.key === 'processing') return state.processing.canContinue;

  return true;
}

export function getNextStepIndex(state: MockOnboardingState, currentIndex: number): number {
  if (!canContinueFromStep(state, currentIndex)) return currentIndex;
  
  return Math.min(currentIndex + 1, ONBOARDING_STEPS.length - 1);
}

export function getCompletionStatus(state: MockOnboardingState): 'complete' | 'pending_admin_approval' {
  return state.permissions.canApprove ? 'complete' : 'pending_admin_approval';
}
