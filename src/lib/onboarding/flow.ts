import type { MockOnboardingState, OnboardingStepDefinition } from './types';

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    key: 'add-business-sources',
    title: 'Add Business Sources',
    eyebrow: 'Step 1 of 6',
    description: 'Add website, files, decks, and notes for NOVA to learn from.',
  },
  {
    key: 'connect-meta',
    title: 'Connect Meta',
    eyebrow: 'Step 2 of 6',
    description: 'Connect Meta now or skip and do it later.',
    optional: true,
  },
  {
    key: 'processing',
    title: 'Analyzing Your Digital Footprint',
    eyebrow: 'Step 3 of 6',
    description: "Our AI is currently mapping your brand's ecosystem to build a tailored campaign strategy. This usually takes 30-60 seconds.",
  },
  {
    key: 'review-business-context',
    title: 'Review Business Context',
    eyebrow: 'Step 4 of 6',
    description: 'Review the business profile NOVA compiled.',
  },
  {
    key: 'select-ad-account',
    title: 'Select Ad Account',
    eyebrow: 'Step 5 of 6',
    description: 'Choose an ad account if Meta is connected.',
    optional: true,
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

  if (step.key === 'add-business-sources')
    return state.selectedObjective !== null && (state.sources.length > 0 || state.manualNotes.trim().length > 0);
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
  const step = getStepByIndex(currentIndex);
  
  // Skip select-ad-account when Meta is skipped
  if (step.key === 'review-business-context' && state.metaConnection.status === 'skipped') {
    return Math.min(currentIndex + 2, ONBOARDING_STEPS.length - 1);
  }
  
  return Math.min(currentIndex + 1, ONBOARDING_STEPS.length - 1);
}

export function getCompletionStatus(state: MockOnboardingState): 'complete' | 'pending_admin_approval' {
  return state.permissions.canApprove ? 'complete' : 'pending_admin_approval';
}
