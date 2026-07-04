'use client';

import type { DashboardMetric } from './dashboard-types';
import { DashboardMetricCard } from './DashboardMetricCard';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardMetricGridProps {
  metrics: DashboardMetric[];
  isLoading: boolean;
  isError: boolean;
}

export function DashboardMetricGrid({ metrics, isLoading, isError }: DashboardMetricGridProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-3xl bg-white" />
        ))}
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-3xl border border-red-100 bg-white p-6 text-sm font-medium text-red-600 shadow-sm">
        Failed to load dashboard data
      </section>
    );
  }

  if (metrics.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-stone-200 bg-white p-10 text-center text-stone-500 shadow-sm">
        <p className="text-sm font-medium">No performance data available</p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metrics.map((metric) => (
        <DashboardMetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
