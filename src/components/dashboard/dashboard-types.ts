export type DashboardTimeRangeId =
  | 'today'
  | 'yesterday'
  | 'last-7-days'
  | 'this-week'
  | 'last-week'
  | 'month-to-date'
  | 'custom';

export interface DashboardTimeRange {
  id: DashboardTimeRangeId;
  label: string;
  supported: boolean;
  disabledReason?: string;
}

export type DashboardMetricId = 'spend' | 'revenue' | 'roas' | 'ctr' | 'impressions' | 'clicks';

export interface DashboardMetric {
  id: DashboardMetricId;
  label: string;
  value: number;
  formattedValue: string;
  description: string;
  href?: string;
  comparison?: string;
}

export interface PerformanceTrendPoint {
  date: string;
  label: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
}

export interface DashboardAISummary {
  headline: string;
  bullets: string[];
  nextStep: string;
}

export type DashboardInsightCategory =
  | 'Performance'
  | 'Budget'
  | 'Creative'
  | 'Tracking'
  | 'Setup'
  | 'Scaling';

export type DashboardInsightSeverity = 'Critical' | 'Warning' | 'Opportunity' | 'Informational';

export type DashboardInsightCTA = 'Deep Dive' | 'Review' | 'Dismiss';

export interface DashboardInsight {
  id: string;
  title: string;
  category: DashboardInsightCategory;
  severity: DashboardInsightSeverity;
  affectedObject: string;
  whatHappened: string;
  whyItMatters: string;
  evidence: string;
  nextStep: string;
  ctas: DashboardInsightCTA[];
  campaignId?: string;
  campaignName?: string;
}

export interface RecentChangeItem {
  id: string;
  campaignId?: string;
  campaignName: string;
  description: string;
  timestamp: string;
  href?: string;
}

export interface DashboardChartPoint {
  date: string;
  label: string;
  revenue: number;
  spend: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpm: number;
  ctr: number;
}
