import type { AnalyticsSnapshot, Campaign } from '../../types/advertising';
import type {
  DashboardAISummary,
  DashboardChartPoint,
  DashboardInsight,
  DashboardInsightCTA,
  DashboardMetric,
  DashboardMetricId,
  DashboardTimeRange,
  DashboardTimeRangeId,
  PerformanceTrendPoint,
  RecentChangeItem,
} from './dashboard-types';

const DAY_MS = 24 * 60 * 60 * 1000;

type DateWindow = {
  start: string;
  end: string;
};

type CampaignRollup = {
  campaignId: string;
  campaignName: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
};

export const DEFAULT_DASHBOARD_TIME_RANGE: DashboardTimeRangeId = 'last-7-days';

export const DASHBOARD_TIME_RANGES: DashboardTimeRange[] = [
  { id: 'today', label: 'Today', supported: true },
  { id: 'yesterday', label: 'Yesterday', supported: true },
  { id: 'last-7-days', label: 'Last 7 days', supported: true },
  { id: 'this-week', label: 'This week', supported: true },
  { id: 'last-week', label: 'Last week', supported: true },
  { id: 'month-to-date', label: 'Month to date', supported: true },
  { id: 'custom', label: 'Custom', supported: true },
];

const dateLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function startOfWeek(date: Date): Date {
  const day = date.getUTCDay();
  return addDays(date, -day);
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function formatDateLabel(dateKey: string): string {
  return dateLabelFormatter.format(parseDateKey(dateKey));
}

function isWithinWindow(dateKey: string, window: DateWindow): boolean {
  return dateKey >= window.start && dateKey <= window.end;
}

function sumSnapshots(snapshots: AnalyticsSnapshot[]) {
  return snapshots.reduce(
    (total, snapshot) => ({
      spend: total.spend + snapshot.spend,
      revenue: total.revenue + snapshot.revenue,
      impressions: total.impressions + snapshot.impressions,
      clicks: total.clicks + snapshot.clicks,
    }),
    { spend: 0, revenue: 0, impressions: 0, clicks: 0 }
  );
}

function buildMetric(
  id: DashboardMetricId,
  label: string,
  value: number,
  formattedValue: string,
  description: string
): DashboardMetric {
  return {
    id,
    label,
    value,
    formattedValue,
    description,
    href: '/campaigns',
  };
}

function metricById(metrics: DashboardMetric[], id: DashboardMetricId): DashboardMetric | undefined {
  return metrics.find((metric) => metric.id === id);
}

function groupByCampaign(snapshots: AnalyticsSnapshot[], campaigns: Campaign[]): CampaignRollup[] {
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));
  const grouped = new Map<string, CampaignRollup>();

  for (const snapshot of snapshots) {
    if (!campaignIds.has(snapshot.campaignId)) continue;

    const existing = grouped.get(snapshot.campaignId) ?? {
      campaignId: snapshot.campaignId,
      campaignName: snapshot.campaignName,
      spend: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
    };

    existing.spend += snapshot.spend;
    existing.revenue += snapshot.revenue;
    existing.impressions += snapshot.impressions;
    existing.clicks += snapshot.clicks;
    grouped.set(snapshot.campaignId, existing);
  }

  return [...grouped.values()];
}

function safeCtas(hasCampaignId: boolean): DashboardInsightCTA[] {
  return hasCampaignId ? ['Deep Dive', 'Review', 'Dismiss'] : ['Review', 'Dismiss'];
}

export function getDashboardTimeRange(id: DashboardTimeRangeId): DashboardTimeRange {
  return DASHBOARD_TIME_RANGES.find((range) => range.id === id) ?? DASHBOARD_TIME_RANGES[2];
}

export function getDashboardRangeWindow(
  rangeId: DashboardTimeRangeId,
  today: Date = new Date()
): DateWindow | null {
  const current = toDateOnly(today);

  if (rangeId === 'today') {
    const key = toDateKey(current);
    return { start: key, end: key };
  }

  if (rangeId === 'yesterday') {
    const key = toDateKey(addDays(current, -1));
    return { start: key, end: key };
  }

  if (rangeId === 'last-7-days') {
    return { start: toDateKey(addDays(current, -6)), end: toDateKey(current) };
  }

  if (rangeId === 'this-week') {
    return { start: toDateKey(startOfWeek(current)), end: toDateKey(current) };
  }

  if (rangeId === 'last-week') {
    const thisWeekStart = startOfWeek(current);
    return {
      start: toDateKey(addDays(thisWeekStart, -7)),
      end: toDateKey(addDays(thisWeekStart, -1)),
    };
  }

  if (rangeId === 'month-to-date') {
    return {
      start: toDateKey(new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1))),
      end: toDateKey(current),
    };
  }

  return null;
}

export function filterAnalyticsByTimeRange(
  snapshots: AnalyticsSnapshot[],
  rangeId: DashboardTimeRangeId,
  today: Date = new Date()
): AnalyticsSnapshot[] {
  const window = getDashboardRangeWindow(rangeId, today);
  if (!window) return [];

  return snapshots.filter((snapshot) => isWithinWindow(snapshot.date, window));
}

export function filterAnalyticsByCustomDateRange(
  snapshots: AnalyticsSnapshot[],
  fromDateKey: string,
  toDateKey: string
): AnalyticsSnapshot[] {
  const [start, end] = fromDateKey <= toDateKey ? [fromDateKey, toDateKey] : [toDateKey, fromDateKey];
  return snapshots.filter((snapshot) => snapshot.date >= start && snapshot.date <= end);
}

export function deriveDashboardChartPoints(snapshots: AnalyticsSnapshot[]): DashboardChartPoint[] {
  if (snapshots.length === 0) return [];

  const grouped = snapshots.reduce<Record<string, DashboardChartPoint>>((acc, snapshot) => {
    acc[snapshot.date] ??= {
      date: snapshot.date,
      label: formatDateLabel(snapshot.date),
      revenue: 0,
      spend: 0,
      impressions: 0,
      clicks: 0,
      roas: 0,
      cpm: 0,
      ctr: 0,
    };

    acc[snapshot.date].spend += snapshot.spend;
    acc[snapshot.date].revenue += snapshot.revenue;
    acc[snapshot.date].impressions += snapshot.impressions;
    acc[snapshot.date].clicks += snapshot.clicks;
    return acc;
  }, {});

  return Object.values(grouped)
    .map((point) => ({
      ...point,
      roas: point.spend > 0 ? point.revenue / point.spend : 0,
      cpm: point.impressions > 0 ? (point.spend / point.impressions) * 1000 : 0,
      ctr: point.impressions > 0 ? (point.clicks / point.impressions) * 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function deriveDashboardMetrics(snapshots: AnalyticsSnapshot[]): DashboardMetric[] {
  if (snapshots.length === 0) return [];

  const totals = sumSnapshots(snapshots);
  const metrics: DashboardMetric[] = [
    buildMetric('spend', 'Spend', totals.spend, formatCurrency(totals.spend), 'Media spend from current analytics'),
    buildMetric('revenue', 'Revenue', totals.revenue, formatCurrency(totals.revenue), 'Revenue from current analytics'),
  ];

  if (totals.spend > 0) {
    const roas = totals.revenue / totals.spend;
    metrics.push(buildMetric('roas', 'ROAS', roas, `${roas.toFixed(2)}x`, 'Revenue divided by spend'));
  }

  if (totals.impressions > 0) {
    const ctr = (totals.clicks / totals.impressions) * 100;
    metrics.push(buildMetric('ctr', 'CTR', ctr, formatPercent(ctr), 'Clicks divided by impressions'));
  }

  metrics.push(
    buildMetric('impressions', 'Impressions', totals.impressions, formatNumber(totals.impressions), 'Impressions from current analytics'),
    buildMetric('clicks', 'Clicks', totals.clicks, formatNumber(totals.clicks), 'Clicks from current analytics')
  );

  return metrics.slice(0, 6);
}

export function derivePerformanceTrendPoints(snapshots: AnalyticsSnapshot[]): PerformanceTrendPoint[] {
  const grouped = snapshots.reduce<Record<string, PerformanceTrendPoint>>((acc, snapshot) => {
    acc[snapshot.date] ??= {
      date: snapshot.date,
      label: formatDateLabel(snapshot.date),
      spend: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
    };

    acc[snapshot.date].spend += snapshot.spend;
    acc[snapshot.date].revenue += snapshot.revenue;
    acc[snapshot.date].impressions += snapshot.impressions;
    acc[snapshot.date].clicks += snapshot.clicks;
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
}

export function deriveDashboardSummary(metrics: DashboardMetric[]): DashboardAISummary | null {
  if (metrics.length === 0) return null;

  const spend = metricById(metrics, 'spend');
  const revenue = metricById(metrics, 'revenue');
  const roas = metricById(metrics, 'roas');
  const ctr = metricById(metrics, 'ctr');
  const impressions = metricById(metrics, 'impressions');
  const clicks = metricById(metrics, 'clicks');
  const bullets: string[] = [];

  if (spend && revenue && roas) {
    bullets.push(
      `Spend is ${spend.formattedValue} and revenue is ${revenue.formattedValue}, yielding ${roas.formattedValue} ROAS.`
    );
  } else if (spend && revenue) {
    bullets.push(`Spend is ${spend.formattedValue} and revenue is ${revenue.formattedValue}.`);
  }

  if (impressions && clicks && ctr) {
    bullets.push(
      `Traffic generated ${clicks.formattedValue} clicks from ${impressions.formattedValue} impressions at ${ctr.formattedValue} CTR.`
    );
  } else if (clicks) {
    bullets.push(`Clicks total ${clicks.formattedValue} for the selected period.`);
  }

  if (spend && clicks && bullets.length < 4) {
    bullets.push(
      `${spend.label} and ${clicks.label} are available for campaign-level review without previous-period deltas.`
    );
  }

  if (bullets.length < 2) {
    bullets.push(`Available dashboard metrics: ${metrics.map((metric) => metric.label).join(', ')}.`);
  }

  const headline =
    roas && roas.value >= 1
      ? 'Revenue is outpacing spend for the selected period'
      : 'Dashboard guidance is based on available analytics only';

  const nextStep = roas
    ? `Review campaign details behind ${roas.formattedValue} ROAS before changing budgets.`
    : 'Open Campaigns to inspect the available metric context before taking action.';

  return {
    headline,
    bullets: bullets.slice(0, 4),
    nextStep,
  };
}

export function deriveDashboardInsights(
  snapshots: AnalyticsSnapshot[],
  campaigns: Campaign[]
): DashboardInsight[] {
  const rollups = groupByCampaign(snapshots, campaigns);
  if (rollups.length === 0) return [];

  const insights: DashboardInsight[] = [];
  const totalSpend = rollups.reduce((sum, rollup) => sum + rollup.spend, 0);
  const topSpend = [...rollups].sort((a, b) => b.spend - a.spend)[0];

  if (topSpend && topSpend.spend > 0) {
    const spendShare = totalSpend > 0 ? (topSpend.spend / totalSpend) * 100 : 0;
    insights.push({
      id: `top-spend-${topSpend.campaignId}`,
      title: 'Top spend concentration',
      category: 'Budget',
      severity: spendShare >= 60 ? 'Warning' : 'Informational',
      affectedObject: topSpend.campaignName,
      whatHappened: `${topSpend.campaignName} has the highest spend in the selected period.`,
      whyItMatters: 'Budget concentration can hide campaign-level efficiency changes.',
      evidence: `${formatCurrency(topSpend.spend)} is ${spendShare.toFixed(1)}% of selected-period spend.`,
      nextStep: 'Review campaign delivery before making budget changes.',
      ctas: safeCtas(true),
      campaignId: topSpend.campaignId,
      campaignName: topSpend.campaignName,
    });
  }

  const lowestRoas = [...rollups]
    .filter((rollup) => rollup.spend > 0)
    .sort((a, b) => a.revenue / a.spend - b.revenue / b.spend)[0];

  if (lowestRoas) {
    const roas = lowestRoas.revenue / lowestRoas.spend;
    insights.push({
      id: `lowest-roas-${lowestRoas.campaignId}`,
      title: 'Lowest ROAS campaign',
      category: 'Performance',
      severity: roas < 1 ? 'Warning' : 'Opportunity',
      affectedObject: lowestRoas.campaignName,
      whatHappened: `${lowestRoas.campaignName} has the lowest ROAS among campaigns with spend.`,
      whyItMatters: 'Reviewing the lowest efficiency campaign helps prioritize deeper analysis.',
      evidence: `${formatCurrency(lowestRoas.revenue)} revenue on ${formatCurrency(lowestRoas.spend)} spend equals ${roas.toFixed(2)}x ROAS.`,
      nextStep: 'Open the campaign details and compare delivery before changing setup.',
      ctas: safeCtas(true),
      campaignId: lowestRoas.campaignId,
      campaignName: lowestRoas.campaignName,
    });
  }

  const bestCtr = [...rollups]
    .filter((rollup) => rollup.impressions > 0)
    .sort((a, b) => b.clicks / b.impressions - a.clicks / a.impressions)[0];

  if (bestCtr) {
    const ctr = (bestCtr.clicks / bestCtr.impressions) * 100;
    insights.push({
      id: `best-ctr-${bestCtr.campaignId}`,
      title: 'Strongest click-through signal',
      category: 'Creative',
      severity: 'Opportunity',
      affectedObject: bestCtr.campaignName,
      whatHappened: `${bestCtr.campaignName} has the strongest CTR signal in the selected period.`,
      whyItMatters: 'High CTR can identify creative or message-market fit worth reviewing.',
      evidence: `${formatPercent(ctr)} CTR from ${formatNumber(bestCtr.impressions)} impressions and ${formatNumber(bestCtr.clicks)} clicks.`,
      nextStep: 'Review the campaign creative context before copying patterns elsewhere.',
      ctas: safeCtas(true),
      campaignId: bestCtr.campaignId,
      campaignName: bestCtr.campaignName,
    });
  }

  return insights.slice(0, 3);
}

export function deriveRecentChanges(
  campaigns: Campaign[],
  rangeId: DashboardTimeRangeId,
  today: Date = new Date()
): RecentChangeItem[] {
  const window = getDashboardRangeWindow(rangeId, today);
  if (!window) return [];

  return campaigns
    .flatMap((campaign): RecentChangeItem[] => {
      const updatedDate = campaign.updatedAt.slice(0, 10);
      const createdDate = campaign.createdAt.slice(0, 10);
      const isUpdated = campaign.updatedAt !== campaign.createdAt;

      if (isUpdated && isWithinWindow(updatedDate, window)) {
        return [
          {
            id: `${campaign.id}-updated-${updatedDate}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            description: 'Campaign updated',
            timestamp: campaign.updatedAt,
            href: `/campaigns/${campaign.id}`,
          },
        ];
      }

      if (isWithinWindow(createdDate, window)) {
        return [
          {
            id: `${campaign.id}-created-${createdDate}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            description: 'Campaign created',
            timestamp: campaign.createdAt,
            href: `/campaigns/${campaign.id}`,
          },
        ];
      }

      return [];
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 5);
}
