import assert from 'node:assert/strict';
import test from 'node:test';

import type { AnalyticsSnapshot, Campaign } from '../../types/advertising';
import {
  DASHBOARD_TIME_RANGES,
  DEFAULT_DASHBOARD_TIME_RANGE,
  deriveDashboardChartPoints,
  deriveDashboardInsights,
  deriveDashboardMetrics,
  deriveDashboardSummary,
  derivePerformanceTrendPoints,
  deriveRecentChanges,
  filterAnalyticsByCustomDateRange,
  filterAnalyticsByTimeRange,
} from './dashboard-utils';

const today = new Date('2026-07-03T12:00:00Z');

const snapshots: AnalyticsSnapshot[] = [
  {
    date: '2026-06-20',
    platform: 'meta',
    campaignId: 'old-campaign',
    campaignName: 'Old Campaign',
    spend: 999,
    impressions: 999,
    clicks: 9,
    revenue: 1,
  },
  {
    date: '2026-06-27',
    platform: 'google',
    campaignId: 'cmp2',
    campaignName: 'Evergreen Search',
    spend: 200,
    impressions: 4000,
    clicks: 100,
    revenue: 600,
  },
  {
    date: '2026-07-03',
    platform: 'meta',
    campaignId: 'cmp1',
    campaignName: 'Summer Launch',
    spend: 100,
    impressions: 1000,
    clicks: 50,
    revenue: 300,
  },
];

const campaigns: Campaign[] = [
  {
    id: 'cmp1',
    name: 'Summer Launch',
    platform: 'meta',
    status: 'active',
    objective: 'CONVERSIONS',
    totalBudget: 5000,
    startDate: '2026-06-01',
    endDate: '2026-07-15',
    createdAt: '2026-05-28',
    updatedAt: '2026-06-22',
    adGroups: [],
  },
  {
    id: 'cmp2',
    name: 'Evergreen Search',
    platform: 'google',
    status: 'active',
    objective: 'CONVERSIONS',
    totalBudget: 8000,
    startDate: '2026-05-01',
    endDate: '2026-12-31',
    createdAt: '2026-04-28',
    updatedAt: '2026-06-21',
    adGroups: [],
  },
];

test('defines required dashboard time ranges with Last 7 days default', () => {
  assert.equal(DEFAULT_DASHBOARD_TIME_RANGE, 'last-7-days');
  assert.deepEqual(
    DASHBOARD_TIME_RANGES.map((range) => range.label),
    ['Today', 'Yesterday', 'Last 7 days', 'This week', 'Last week', 'Month to date', 'Custom']
  );
});

test('filters analytics by selected range using existing snapshot dates only', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);

  assert.deepEqual(
    filtered.map((snapshot) => snapshot.date),
    ['2026-06-27', '2026-07-03']
  );
});

test('derives only supported metric cards and hides comparisons', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);
  const metrics = deriveDashboardMetrics(filtered);

  assert.deepEqual(
    metrics.map((metric) => metric.id),
    ['spend', 'revenue', 'roas', 'ctr', 'impressions', 'clicks']
  );
  assert.equal(metrics.find((metric) => metric.id === 'spend')?.formattedValue, '$300.00');
  assert.equal(metrics.find((metric) => metric.id === 'roas')?.formattedValue, '3.00x');
  assert.equal(metrics.find((metric) => metric.id === 'ctr')?.formattedValue, '3.00%');
  assert.ok(metrics.every((metric) => metric.comparison === undefined));
  assert.ok(!metrics.some((metric) => /CPA|CPL|Pacing|Purchases|Leads|CVR|Frequency|Reach/.test(metric.label)));
});

test('aggregates trend points from existing time series only', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);
  const points = derivePerformanceTrendPoints(filtered);

  assert.deepEqual(
    points.map((point) => point.date),
    ['2026-06-27', '2026-07-03']
  );
  assert.equal(points[0].spend, 200);
  assert.equal(points[1].revenue, 300);
});

test('derives rule-based summary without unsupported metric references', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);
  const summary = deriveDashboardSummary(deriveDashboardMetrics(filtered));

  assert.ok(summary);
  assert.ok(summary.bullets.length >= 2 && summary.bullets.length <= 4);
  assert.ok(summary.nextStep.length > 0);
  assert.doesNotMatch(
    [summary.headline, ...summary.bullets, summary.nextStep].join(' '),
    /CPA|CPL|Pacing|Purchases|Leads|CVR|Frequency|Reach/
  );
});

test('derives bounded insights with safe CTA vocabulary and existing campaign ids', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);
  const insights = deriveDashboardInsights(filtered, campaigns);
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));

  assert.ok(insights.length >= 1 && insights.length <= 3);
  for (const insight of insights) {
    assert.match(insight.category, /^(Performance|Budget|Creative|Tracking|Setup|Scaling)$/);
    assert.match(insight.severity, /^(Critical|Warning|Opportunity|Informational)$/);
    assert.deepEqual(insight.ctas.sort(), insight.ctas.filter((cta) => ['Deep Dive', 'Review', 'Dismiss'].includes(cta)).sort());
    if (insight.campaignId) assert.ok(campaignIds.has(insight.campaignId));
  }
});

test('derives recent changes only from existing campaign timestamps', () => {
  assert.deepEqual(deriveRecentChanges(campaigns, 'last-7-days', today), []);

  const lastWeekChanges = deriveRecentChanges(campaigns, 'last-week', today);

  assert.equal(lastWeekChanges.length, 2);
  assert.deepEqual(
    lastWeekChanges.map((change) => change.campaignId),
    ['cmp1', 'cmp2']
  );
  assert.ok(lastWeekChanges.every((change) => change.description === 'Campaign updated'));
});

test('filters analytics by custom date range inclusively', () => {
  const customFiltered = filterAnalyticsByCustomDateRange(snapshots, '2026-06-27', '2026-07-03');
  assert.deepEqual(
    customFiltered.map((s) => s.date),
    ['2026-06-27', '2026-07-03']
  );
});

test('returns empty array when no snapshots match custom range', () => {
  const customFiltered = filterAnalyticsByCustomDateRange(snapshots, '2026-05-01', '2026-05-05');
  assert.deepEqual(customFiltered, []);
});

test('handles reversed custom date range by swapping dates', () => {
  const customFiltered = filterAnalyticsByCustomDateRange(snapshots, '2026-07-03', '2026-06-27');
  assert.deepEqual(
    customFiltered.map((s) => s.date),
    ['2026-06-27', '2026-07-03']
  );
});

test('handles single-day custom range', () => {
  const customFiltered = filterAnalyticsByCustomDateRange(snapshots, '2026-07-03', '2026-07-03');
  assert.equal(customFiltered.length, 1);
  assert.equal(customFiltered[0].date, '2026-07-03');
});

test('derives daily chart points with roas, cpm, ctr fields', () => {
  const filtered = filterAnalyticsByTimeRange(snapshots, 'last-7-days', today);
  const points = deriveDashboardChartPoints(filtered);

  assert.ok(points.length > 0);
  for (const point of points) {
    assert.ok(typeof point.date === 'string');
    assert.ok(typeof point.label === 'string');
    assert.ok(typeof point.revenue === 'number');
    assert.ok(typeof point.spend === 'number');
    assert.ok(typeof point.impressions === 'number');
    assert.ok(typeof point.clicks === 'number');
    assert.ok(typeof point.roas === 'number');
    assert.ok(typeof point.cpm === 'number');
    assert.ok(typeof point.ctr === 'number');
  }
});

test('computes roas as revenue/spend when spend > 0, else 0', () => {
  const points = deriveDashboardChartPoints(snapshots);
  const pointWithSpend = points.find((p) => p.spend > 0);
  if (pointWithSpend) {
    const expected = pointWithSpend.revenue / pointWithSpend.spend;
    assert.ok(Math.abs(pointWithSpend.roas - expected) < 0.001);
  }
  const zeroSpendPoints = points.filter((p) => p.spend === 0);
  for (const p of zeroSpendPoints) {
    assert.equal(p.roas, 0);
  }
});

test('computes cpm as (spend/impressions)*1000 when impressions > 0, else 0', () => {
  const points = deriveDashboardChartPoints(snapshots);
  const pointWithImpressions = points.find((p) => p.impressions > 0);
  if (pointWithImpressions) {
    const expected = (pointWithImpressions.spend / pointWithImpressions.impressions) * 1000;
    assert.ok(Math.abs(pointWithImpressions.cpm - expected) < 0.001);
  }
  const zeroImpPoints = points.filter((p) => p.impressions === 0);
  for (const p of zeroImpPoints) {
    assert.equal(p.cpm, 0);
  }
});

test('computes ctr as (clicks/impressions)*100 when impressions > 0, else 0', () => {
  const points = deriveDashboardChartPoints(snapshots);
  const pointWithImpressions = points.find((p) => p.impressions > 0);
  if (pointWithImpressions) {
    const expected = (pointWithImpressions.clicks / pointWithImpressions.impressions) * 100;
    assert.ok(Math.abs(pointWithImpressions.ctr - expected) < 0.001);
  }
  const zeroImpPoints = points.filter((p) => p.impressions === 0);
  for (const p of zeroImpPoints) {
    assert.equal(p.ctr, 0);
  }
});

test('handles empty snapshots array for chart points', () => {
  const points = deriveDashboardChartPoints([]);
  assert.deepEqual(points, []);
});

test('aggregates same-date snapshots before deriving chart points', () => {
  const dupSnapshots: AnalyticsSnapshot[] = [
    { date: '2026-07-03', platform: 'meta', campaignId: 'a', campaignName: 'A', spend: 50, impressions: 500, clicks: 25, revenue: 150 },
    { date: '2026-07-03', platform: 'google', campaignId: 'b', campaignName: 'B', spend: 50, impressions: 500, clicks: 25, revenue: 150 },
  ];
  const points = deriveDashboardChartPoints(dupSnapshots);
  assert.equal(points.length, 1);
  assert.equal(points[0].spend, 100);
  assert.equal(points[0].revenue, 300);
  assert.equal(points[0].impressions, 1000);
  assert.equal(points[0].clicks, 50);
});
