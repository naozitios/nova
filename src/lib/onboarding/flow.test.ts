import { describe, expect, it } from 'vitest';

import { mockOnboardingState } from './mock-data';
import {
  ONBOARDING_STEPS,
  canContinueFromReviewStep,
  canContinueFromStep,
  getCompletionStatus,
  getNextStepIndex,
  getStepByIndex,
} from './flow';
import type { MockOnboardingState } from './types';

function makeState(overrides: Partial<MockOnboardingState> = {}): MockOnboardingState {
  return {
    ...mockOnboardingState,
    ...overrides,
  };
}

describe('onboarding flow', () => {
  it('defines exactly 6 product steps in order', () => {
    expect(ONBOARDING_STEPS.map((step) => step.title)).toEqual([
      'Business Basics',
      'Add Business Sources',
      'Connect Meta',
      'Analyzing Your Digital Footprint',
      'Review Business Context',
      'Setup Complete',
    ]);
    expect(ONBOARDING_STEPS).toHaveLength(6);
  });

  it('returns steps by zero-based index', () => {
    expect(getStepByIndex(0).key).toBe('business-basics');
    expect(getStepByIndex(5).key).toBe('setup-complete');
  });

  it('throws for unknown step indexes instead of silently falling through', () => {
    expect(() => getStepByIndex(-1)).toThrow(RangeError);
    expect(() => getStepByIndex(6)).toThrow('Unknown onboarding step index: 6');
  });

  it('allows ad account step to continue when connected Meta has an account selection', () => {
    const state = makeState({
      metaConnection: {
        ...mockOnboardingState.metaConnection,
        status: 'connected',
        connectionId: 'meta_conn_001',
      },
      selectedAdAccountId: 'act_822109',
    });

    expect(canContinueFromStep(state, 4)).toBe(true);
    expect(getNextStepIndex(state, 4)).toBe(5);
  });

  it('allows ad account step to continue when Meta was skipped', () => {
    const state = makeState({
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'skipped' },
      selectedAdAccountId: null,
    });

    expect(canContinueFromStep(state, 4)).toBe(true);
  });

  it('does not advance past the final step', () => {
    expect(getNextStepIndex(mockOnboardingState, 5)).toBe(5);
  });

  it('marks non-admin final state as pending admin approval', () => {
    const state = makeState({
      permissions: { ...mockOnboardingState.permissions, canApprove: false },
    });

    expect(getCompletionStatus(state)).toBe('pending_admin_approval');
  });

  it('marks admin final state as complete', () => {
    const state = makeState({
      permissions: { ...mockOnboardingState.permissions, canApprove: true },
    });

    expect(getCompletionStatus(state)).toBe('complete');
  });
});

describe('canContinueFromReviewStep', () => {
  it('returns false while loading', () => {
    expect(canContinueFromReviewStep({ loading: true, error: null, review: null })).toBe(false);
  });

  it('returns false when error exists', () => {
    expect(canContinueFromReviewStep({ loading: false, error: 'network timeout', review: null })).toBe(false);
  });

  it('returns false when review is null', () => {
    expect(canContinueFromReviewStep({ loading: false, error: null, review: null })).toBe(false);
  });

  it('returns false when unresolvedFields is nonempty', () => {
    expect(
      canContinueFromReviewStep({
        loading: false,
        error: null,
        review: { unresolvedFields: ['targetAudiences'] },
      }),
    ).toBe(false);
  });

  it('returns true when loaded, no error, review present, and no unresolved fields', () => {
    expect(
      canContinueFromReviewStep({
        loading: false,
        error: null,
        review: { unresolvedFields: [] },
      }),
    ).toBe(true);
  });
});
