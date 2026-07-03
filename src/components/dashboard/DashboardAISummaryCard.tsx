'use client';

import { Sparkles } from 'lucide-react';
import type { DashboardAISummary } from './dashboard-types';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardAISummaryCardProps {
  summary: DashboardAISummary | null;
  isLoading: boolean;
  isError: boolean;
}

export function DashboardAISummaryCard({ summary, isLoading, isError }: DashboardAISummaryCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-4 h-6 w-56" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
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

  if (!summary) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">Performance summary</h2>
        <p className="mt-2 text-sm text-stone-500">No performance data available</p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Performance summary</h2>
          <p className="mt-1 text-sm text-stone-500">Rule-based dashboard guidance from available metrics.</p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-stone-900">{summary.headline}</h3>
      <ul className="mt-4 space-y-3 text-sm text-stone-600">
        {summary.bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E55A3C]" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm font-medium text-stone-700">
        Suggested next step: {summary.nextStep}
      </div>
    </section>
  );
}
