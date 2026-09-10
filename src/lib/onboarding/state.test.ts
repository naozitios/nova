import { describe, expect, it } from 'vitest';

import {
  mapBackendRouteStage,
  mapSourceStatus,
  mapMetaSkippable,
  deriveCompletionState,
} from './state';

describe('mapBackendRouteStage', () => {
  it('maps "business" to business-basics', () => {
    expect(mapBackendRouteStage('business')).toBe('business-basics');
  });

  it('maps "sources" to add-business-sources', () => {
    expect(mapBackendRouteStage('sources')).toBe('add-business-sources');
  });

  it('maps "review" to review-business-context', () => {
    expect(mapBackendRouteStage('review')).toBe('review-business-context');
  });

  it('maps "context" to review-business-context', () => {
    expect(mapBackendRouteStage('context')).toBe('review-business-context');
  });

  it('maps "complete" to setup-complete', () => {
    expect(mapBackendRouteStage('complete')).toBe('setup-complete');
  });

  it('returns null for unrecognized stage', () => {
    expect(mapBackendRouteStage('unknown_stage')).toBeNull();
  });
});

describe('mapSourceStatus', () => {
  it('maps "queued" to added', () => {
    expect(mapSourceStatus('queued')).toBe('added');
  });

  it('maps "processing" to processing', () => {
    expect(mapSourceStatus('processing')).toBe('processing');
  });

  it('maps "completed" to complete', () => {
    expect(mapSourceStatus('completed')).toBe('complete');
  });

  it('maps "failed" to failed', () => {
    expect(mapSourceStatus('failed')).toBe('failed');
  });

  it('maps "registered" to added', () => {
    expect(mapSourceStatus('registered')).toBe('added');
  });

  it('maps "processed" to complete', () => {
    expect(mapSourceStatus('processed')).toBe('complete');
  });

  it('maps "processed_with_warnings" to complete', () => {
    expect(mapSourceStatus('processed_with_warnings')).toBe('complete');
  });

  it('maps "blocked_needs_user_action" to failed', () => {
    expect(mapSourceStatus('blocked_needs_user_action')).toBe('failed');
  });

  it('maps "failed_permanent" to failed', () => {
    expect(mapSourceStatus('failed_permanent')).toBe('failed');
  });

  it('returns null for unrecognized status', () => {
    expect(mapSourceStatus('archived')).toBeNull();
  });
});

describe('mapMetaSkippable', () => {
  it('treats "not_configured" as skippable', () => {
    expect(mapMetaSkippable({ status: 'not_configured' })).toEqual({
      skippable: true,
      uiStatus: 'not_configured',
    });
  });

  it('treats "not_connected" as not skippable', () => {
    expect(mapMetaSkippable({ status: 'not_connected' })).toEqual({
      skippable: false,
      uiStatus: 'not_connected',
    });
  });

  it('treats "connected" as not skippable', () => {
    expect(mapMetaSkippable({ status: 'connected' })).toEqual({
      skippable: false,
      uiStatus: 'connected',
    });
  });

  it('treats "skipped" as not skippable', () => {
    expect(mapMetaSkippable({ status: 'skipped' })).toEqual({
      skippable: false,
      uiStatus: 'skipped',
    });
  });

  it('treats "failed" as not skippable', () => {
    expect(mapMetaSkippable({ status: 'failed' })).toEqual({
      skippable: false,
      uiStatus: 'failed',
    });
  });
});

describe('deriveCompletionState', () => {
  it('derives "complete" when approval is approved', () => {
    expect(
      deriveCompletionState({
        approvalStatus: 'approved',
        canApprove: true,
      }),
    ).toEqual({ state: 'complete', action: 'continue_to_dashboard' });
  });

  it('derives "pending_approval" when approval is ready_for_admin_approval', () => {
    expect(
      deriveCompletionState({
        approvalStatus: 'ready_for_admin_approval',
        canApprove: true,
      }),
    ).toEqual({ state: 'pending_approval', action: 'notify_admin' });
  });

  it('derives "pending_approval" when admin cannot approve', () => {
    expect(
      deriveCompletionState({
        approvalStatus: 'ready_for_admin_approval',
        canApprove: false,
      }),
    ).toEqual({ state: 'pending_approval', action: 'wait_for_admin' });
  });

  it('derives "complete" even when cannot_approve if already approved', () => {
    expect(
      deriveCompletionState({
        approvalStatus: 'approved',
        canApprove: false,
      }),
    ).toEqual({ state: 'complete', action: 'continue_to_dashboard' });
  });

  it('does not depend on mock flags', () => {
    // Derivation based solely on approvalStatus, not arbitrary flags
    const fromApproved = deriveCompletionState({
      approvalStatus: 'approved',
      canApprove: true,
    });
    const fromReady = deriveCompletionState({
      approvalStatus: 'ready_for_admin_approval',
      canApprove: false,
    });

    expect(fromApproved.state).toBe('complete');
    expect(fromReady.state).toBe('pending_approval');
    expect(fromApproved).not.toEqual(fromReady);
  });
});
