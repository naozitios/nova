'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adClient } from '@/api/adClient';
import { DashboardAISummaryCard } from '@/components/dashboard/DashboardAISummaryCard';
import { DashboardInsightDrawer } from '@/components/dashboard/DashboardInsightDrawer';
import { DashboardInsightList } from '@/components/dashboard/DashboardInsightList';
import { DashboardMetricGrid } from '@/components/dashboard/DashboardMetricGrid';
import { DashboardTimeRangeSelector } from '@/components/dashboard/DashboardTimeRangeSelector';
import { DashboardTrendSection } from '@/components/dashboard/DashboardTrendSection';
import { RecentChangesList } from '@/components/dashboard/RecentChangesList';
import type { DashboardInsight, DashboardTimeRangeId } from '@/components/dashboard/dashboard-types';
import {
  DEFAULT_DASHBOARD_TIME_RANGE,
  deriveDashboardInsights,
  deriveDashboardMetrics,
  deriveDashboardSummary,
  derivePerformanceTrendPoints,
  deriveRecentChanges,
  filterAnalyticsByTimeRange,
  getDashboardTimeRange,
} from '@/components/dashboard/dashboard-utils';
import type { AggregatedMetrics, AnalyticsSnapshot, Campaign } from '@/types/advertising';

export default function Dashboard() {
  const [selectedRange, setSelectedRange] = useState<DashboardTimeRangeId>(DEFAULT_DASHBOARD_TIME_RANGE);
  const [dismissedInsightIds, setDismissedInsightIds] = useState<Set<string>>(() => new Set());
  const [reviewInsight, setReviewInsight] = useState<DashboardInsight | null>(null);

  const latestQuery = useQuery<AggregatedMetrics>({
    queryKey: ['analytics-latest'],
    queryFn: () => adClient.analytics.getLatest(),
  });
  const timeSeriesQuery = useQuery<AnalyticsSnapshot[]>({
    queryKey: ['analytics-timeseries'],
    queryFn: () => adClient.analytics.getTimeSeries(),
  });
  const campaignsQuery = useQuery<Campaign[]>({
    queryKey: ['dashboard-campaigns'],
    queryFn: () => adClient.campaigns.list(),
  });

  const selectedRangeMeta = getDashboardTimeRange(selectedRange);
  const filteredSnapshots = useMemo(
    () => filterAnalyticsByTimeRange(timeSeriesQuery.data ?? [], selectedRange),
    [timeSeriesQuery.data, selectedRange]
  );
  const metrics = useMemo(() => deriveDashboardMetrics(filteredSnapshots), [filteredSnapshots]);
  const trendPoints = useMemo(() => derivePerformanceTrendPoints(filteredSnapshots), [filteredSnapshots]);
  const summary = useMemo(() => deriveDashboardSummary(metrics), [metrics]);
  const insights = useMemo(
    () => deriveDashboardInsights(filteredSnapshots, campaignsQuery.data ?? []),
    [filteredSnapshots, campaignsQuery.data]
  );
  const visibleInsights = useMemo(
    () => insights.filter((insight) => !dismissedInsightIds.has(insight.id)),
    [insights, dismissedInsightIds]
  );
  const recentChanges = useMemo(
    () => deriveRecentChanges(campaignsQuery.data ?? [], selectedRange),
    [campaignsQuery.data, selectedRange]
  );

  const isAnalyticsLoading = latestQuery.isLoading || timeSeriesQuery.isLoading;
  const isDashboardLoading = isAnalyticsLoading || campaignsQuery.isLoading;
  const isDashboardError = latestQuery.isError || timeSeriesQuery.isError || campaignsQuery.isError;

  function handleDismissInsight(id: string) {
    setDismissedInsightIds((previous) => new Set(previous).add(id));
    if (reviewInsight?.id === id) setReviewInsight(null);
  }

  return (
    <div className="min-h-screen bg-stone-50 px-6 pb-16 pt-28 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <h1 className="text-3xl font-bold text-stone-900">Dashboard</h1>
          <DashboardTimeRangeSelector value={selectedRange} onChange={setSelectedRange} />
        </div>

        <DashboardMetricGrid
          metrics={metrics}
          isLoading={isAnalyticsLoading}
          isError={isDashboardError}
        />

        <DashboardTrendSection
          points={trendPoints}
          rangeLabel={selectedRangeMeta.label}
          isLoading={isAnalyticsLoading}
          isError={isDashboardError}
        />

        <DashboardAISummaryCard
          summary={summary}
          isLoading={isAnalyticsLoading}
          isError={isDashboardError}
        />

        <DashboardInsightList
          insights={visibleInsights}
          isLoading={isDashboardLoading}
          isError={isDashboardError}
          onReview={setReviewInsight}
          onDismiss={handleDismissInsight}
        />

        <RecentChangesList
          items={recentChanges}
          isLoading={campaignsQuery.isLoading}
          isError={isDashboardError}
        />
      </div>

      <DashboardInsightDrawer insight={reviewInsight} onClose={() => setReviewInsight(null)} />
    </div>
  );
}
