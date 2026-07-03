'use client';

import type { PerformanceTrendPoint } from './dashboard-types';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardTrendSectionProps {
  points: PerformanceTrendPoint[];
  rangeLabel: string;
  isLoading: boolean;
  isError: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function DashboardTrendSection({
  points,
  rangeLabel,
  isLoading,
  isError,
}: DashboardTrendSectionProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-6 h-6 w-48" />
        <Skeleton className="h-56 rounded-2xl" />
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

  if (points.length === 0) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Performance trend</h2>
        <p className="mt-2 text-sm text-stone-500">No performance data available</p>
      </section>
    );
  }

  const maxValue = Math.max(...points.flatMap((point) => [point.spend, point.revenue]), 1);

  return (
    <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Performance trend</h2>
          <p className="mt-1 text-sm text-stone-500">Spend and revenue from existing analytics for {rangeLabel}.</p>
        </div>
        <div className="flex items-center gap-5 text-sm text-stone-500">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-[#E55A3C]" /> Revenue
          </span>
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm bg-stone-300" /> Spend
          </span>
        </div>
      </div>

      <div className="flex h-56 items-end gap-2 rounded-2xl bg-stone-50 px-4 py-5" aria-label="Spend and revenue trend">
        {points.map((point) => (
          <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className="flex h-44 w-full items-end justify-center gap-1" title={`${point.label}: revenue ${formatCurrency(point.revenue)}, spend ${formatCurrency(point.spend)}`}>
              <div
                className="w-full max-w-5 rounded-t-md bg-[#E55A3C]"
                style={{ height: `${Math.max((point.revenue / maxValue) * 100, 2)}%` }}
              />
              <div
                className="w-full max-w-5 rounded-t-md bg-stone-300"
                style={{ height: `${Math.max((point.spend / maxValue) * 100, 2)}%` }}
              />
            </div>
            <span className="max-w-full truncate text-[11px] text-stone-400">{point.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
