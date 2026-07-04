import type { OptimizationAction, ActionStatus, ActionCategory, ActionPriority, ActionRisk } from './types';

interface CreateActionInput {
  action: string;
  source: string;
  priority: ActionPriority;
  risk: ActionRisk;
  estimatedImpact: string;
  category: ActionCategory;
  description: string;
  reason: string;
  evidence: string;
  affectedCampaigns: string[];
}

export class ActionCenter {
  private actions: Map<string, OptimizationAction> = new Map();

  createAction(input: CreateActionInput): OptimizationAction {
    const action: OptimizationAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      action: input.action,
      source: input.source,
      priority: input.priority,
      risk: input.risk,
      estimatedImpact: input.estimatedImpact,
      status: 'pending_review',
      category: input.category,
      description: input.description,
      reason: input.reason,
      evidence: input.evidence,
      affectedCampaigns: input.affectedCampaigns,
      approvalHistory: [{
        action: 'created',
        timestamp: new Date().toISOString(),
        user: 'system',
      }],
      createdAt: new Date().toISOString(),
    };

    this.actions.set(action.id, action);
    return action;
  }

  approve(id: string, user = 'system'): OptimizationAction | null {
    const action = this.actions.get(id);
    if (!action || action.status !== 'pending_review') return null;

    action.status = 'approved';
    action.approvalHistory.push({
      action: 'approved',
      timestamp: new Date().toISOString(),
      user,
    });
    return action;
  }

  reject(id: string, user = 'system'): OptimizationAction | null {
    const action = this.actions.get(id);
    if (!action || action.status !== 'pending_review') return null;

    action.status = 'rejected';
    action.approvalHistory.push({
      action: 'rejected',
      timestamp: new Date().toISOString(),
      user,
    });
    return action;
  }

  dismiss(id: string, user = 'system'): OptimizationAction | null {
    const action = this.actions.get(id);
    if (!action) return null;

    action.status = 'dismissed';
    action.approvalHistory.push({
      action: 'dismissed',
      timestamp: new Date().toISOString(),
      user,
    });
    return action;
  }

  execute(id: string, user = 'system'): OptimizationAction | null {
    const action = this.actions.get(id);
    if (!action || action.status !== 'approved') return null;

    action.status = 'executed';
    action.approvalHistory.push({
      action: 'executed',
      timestamp: new Date().toISOString(),
      user,
    });
    return action;
  }

  list(status?: ActionStatus): OptimizationAction[] {
    const all = Array.from(this.actions.values());
    if (status) return all.filter(a => a.status === status);
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  get(id: string): OptimizationAction | undefined {
    return this.actions.get(id);
  }
}
