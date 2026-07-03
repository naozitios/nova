'use client';

import type { DashboardInsight } from './dashboard-types';
import { DashboardInsightCard } from './DashboardInsightCard';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardInsightListProps {
  insights: DashboardInsight[];
  isLoading: boolean;
  isError: boolean;
  onReview: (insight: DashboardInsight) => void;
  onDismiss: (id: string) => void;
}

export function DashboardInsightList({
  insights,
  isLoading,
  isError,
  onReview,
  onDismiss,
}: DashboardInsightListProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-5 h-6 w-44" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-3xl" />
          ))}
        </div>
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

  return (
    <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-stone-900">Insights / Actions</h2>
        <p className="mt-1 text-sm text-stone-500">Frontend-only review cards from existing analytics and campaign ids.</p>
      </div>

      {insights.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-8 text-center text-sm font-medium text-stone-500">
          No insights for this period.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {insights.map((insight) => (
            <DashboardInsightCard
              key={insight.id}
              insight={insight}
              onReview={onReview}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </section>
  );
}
