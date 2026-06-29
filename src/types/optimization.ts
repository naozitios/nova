export type IssueSeverity = 'critical' | 'warning' | 'info';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';
export type IssueCategory = 'tracking' | 'attribution' | 'utm' | 'naming';

export interface AccountIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  finding: string;
  evidence: string;
  recommendation: string;
  status: IssueStatus;
}

export interface HealthSummary {
  score: number;
  criticalCount: number;
  warningCount: number;
  passedCount: number;
  issues: AccountIssue[];
}

export type RecommendationStatus = 'new' | 'reviewed' | 'approved' | 'dismissed' | 'executed';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type OpportunityType = 'creative_fatigue' | 'scaling' | 'budget_waste' | 'performance_decline';

export interface OptimizationRecommendation {
  id: string;
  type: OpportunityType;
  campaignName: string;
  finding: string;
  evidence: string;
  likelyCause: string;
  recommendedAction: string;
  expectedImpact: string;
  confidence: ConfidenceLevel;
  status: RecommendationStatus;
  createdAt: string;
}

export type ActionPriority = 'high' | 'medium' | 'low';
export type ActionRisk = 'high' | 'medium' | 'low';
export type ActionCategory = 'scale' | 'reduce' | 'fix' | 'launch';
export type ActionStatus = 'pending_review' | 'approved' | 'rejected' | 'dismissed' | 'executed';

export interface OptimizationAction {
  id: string;
  action: string;
  source: string;
  priority: ActionPriority;
  risk: ActionRisk;
  estimatedImpact: string;
  status: ActionStatus;
  category: ActionCategory;
  description: string;
  reason: string;
  evidence: string;
  affectedCampaigns: string[];
  approvalHistory: { action: string; timestamp: string; user: string }[];
  createdAt: string;
}
