'use client';

import Link from 'next/link';
import { ArrowRight, DollarSign, Eye, MousePointerClick, TrendingUp } from 'lucide-react';
import type { DashboardMetric, DashboardMetricId } from './dashboard-types';

const METRIC_ICONS: Record<DashboardMetricId, typeof DollarSign> = {
  spend: DollarSign,
  revenue: DollarSign,
  roas: TrendingUp,
  ctr: MousePointerClick,
  impressions: Eye,
  clicks: MousePointerClick,
};

interface DashboardMetricCardProps {
  metric: DashboardMetric;
}

export function DashboardMetricCard({ metric }: DashboardMetricCardProps) {
  const Icon = METRIC_ICONS[metric.id];
  const content = (
    <div className="group h-full rounded-3xl border border-stone-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-stone-200 hover:shadow-md">
      <div className="mb-5 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-stone-500">{metric.label}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9]">
          <Icon className="h-5 w-5 text-[#E55A3C]" />
        </span>
      </div>
      <div className="text-3xl font-semibold tracking-tight text-stone-900">
        {metric.formattedValue}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-stone-500">
        <span>{metric.description}</span>
        {metric.href ? <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 transition group-hover:text-[#E55A3C]" /> : null}
      </div>
    </div>
  );

  if (!metric.href) return content;

  return (
    <Link href={metric.href} className="block h-full focus:outline-none focus:ring-2 focus:ring-[#E55A3C]/40 focus:ring-offset-2">
      {content}
    </Link>
  );
}
