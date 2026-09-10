import type { SourceStatus } from './types';

type RouteStage = 'business' | 'sources' | 'review' | 'context' | 'complete';

const ROUTE_STAGE_MAP: Record<RouteStage, string> = {
  business: 'business-basics',
  sources: 'add-business-sources',
  review: 'review-business-context',
  context: 'review-business-context',
  complete: 'setup-complete',
};

export function mapBackendRouteStage(stage: string): string | null {
  if (stage in ROUTE_STAGE_MAP) {
    return ROUTE_STAGE_MAP[stage as RouteStage];
  }
  return null;
}

const SOURCE_STATUS_MAP: Record<string, SourceStatus> = {
  registered: 'added',
  queued: 'added',
  processing: 'processing',
  processed: 'complete',
  processed_with_warnings: 'complete',
  blocked_needs_user_action: 'failed',
  failed_permanent: 'failed',
  completed: 'complete',
  failed: 'failed',
};

export function mapSourceStatus(status: string): SourceStatus | null {
  if (status in SOURCE_STATUS_MAP) {
    return SOURCE_STATUS_MAP[status];
  }
  return null;
}

export function mapMetaSkippable(meta: { status: string }): {
  skippable: boolean;
  uiStatus: string;
} {
  const skippable = meta.status === 'not_configured';
  return { skippable, uiStatus: meta.status };
}

type CompletionInput = {
  approvalStatus: 'approved' | 'ready_for_admin_approval';
  canApprove: boolean;
};

type CompletionResult = {
  state: 'complete' | 'pending_approval';
  action: string;
};

export function deriveCompletionState(input: CompletionInput): CompletionResult {
  if (input.approvalStatus === 'approved') {
    return { state: 'complete', action: 'continue_to_dashboard' };
  }

  if (input.canApprove) {
    return { state: 'pending_approval', action: 'notify_admin' };
  }

  return { state: 'pending_approval', action: 'wait_for_admin' };
}
