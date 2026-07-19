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

  it('throws for unknown step indexes instead of silently falling through', () => {
    expect(() => getStepByIndex(-1)).toThrow(RangeError);
    expect(() => getStepByIndex(8)).toThrow('Unknown onboarding step index: 8');
  });

  it('requires a selected objective before advancing from step 2', () => {
    const state = makeState({
      selectedObjective: null,
    });

    expect(canContinueFromStep(state, 1)).toBe(false);
    expect(getNextStepIndex(state, 1)).toBe(1);
  });

  it('requires at least one source or manual note before learning starts', () => {
    const blockedState = makeState({
      sources: [],
      manualNotes: '   ',
    });
    const manualOnlyState = makeState({
      sources: [],
      manualNotes: 'Position NOVA around qualified pipeline, not raw lead volume.',
    });

    expect(canContinueFromStep(blockedState, 2)).toBe(false);
    expect(getNextStepIndex(blockedState, 2)).toBe(2);
    expect(canContinueFromStep(manualOnlyState, 2)).toBe(true);
  });

  it('allows Meta to be skipped but not ignored before continuing', () => {
    const ignoredState = makeState({
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'not_connected' },
    });
    const skippedState = makeState({
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'skipped' },
    });

    expect(canContinueFromStep(ignoredState, 3)).toBe(false);
    expect(getNextStepIndex(ignoredState, 3)).toBe(3);
    expect(canContinueFromStep(skippedState, 3)).toBe(true);
    expect(getNextStepIndex(skippedState, 3)).toBe(4);
  });

  it('blocks a failed Meta connection until the user retries or skips', () => {
    const state = makeState({
      metaConnection: {
        ...mockOnboardingState.metaConnection,
        status: 'failed',
        error: 'OAuth permission was declined.',
      },
    });

    expect(canContinueFromStep(state, 3)).toBe(false);
    expect(getNextStepIndex(state, 3)).toBe(3);
  });

  it('uses processing readiness as the only step 5 gate', () => {
    const processingState = makeState({
      processing: { ...mockOnboardingState.processing, canContinue: false },
    });
    const readyState = makeState({
      processing: { ...mockOnboardingState.processing, canContinue: true },
    });

    expect(canContinueFromStep(processingState, 4)).toBe(false);
    expect(canContinueFromStep(readyState, 4)).toBe(true);
  });

  it('requires an ad account when Meta is connected', () => {
    const state = makeState({
      metaConnection: {
        ...mockOnboardingState.metaConnection,
        status: 'connected',
        connectionId: 'meta_conn_001',
      },
      selectedAdAccountId: null,
    });

    expect(canContinueFromStep(state, 6)).toBe(false);
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

    expect(canContinueFromStep(state, 6)).toBe(true);
    expect(getNextStepIndex(state, 6)).toBe(7);
  });

  it('allows ad account step to continue when Meta was skipped', () => {
    const state = makeState({
      metaConnection: { ...mockOnboardingState.metaConnection, status: 'skipped' },
      selectedAdAccountId: null,
    });

    expect(canContinueFromStep(state, 6)).toBe(true);
  });

  it('does not advance past the final step', () => {
    expect(getNextStepIndex(mockOnboardingState, 7)).toBe(7);
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
