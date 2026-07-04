'use client';

import type { DashboardChartPoint } from './dashboard-types';
import type { ChartConfig } from '@/components/ui/chart';
import { DashboardLineChartCard } from './DashboardLineChartCard';

interface DashboardChartGridProps {
  chartPoints: DashboardChartPoint[];
  isLoading: boolean;
  isError: boolean;
}

const revenueVsRoasConfig = {
  revenue: { label: 'Revenue', color: 'var(--chart-1)' },
  roas: { label: 'ROAS', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const spendVsCpmConfig = {
  spend: { label: 'Spend', color: 'var(--chart-3)' },
  cpm: { label: 'CPM', color: 'var(--chart-4)' },
} satisfies ChartConfig;

const impressionsVsCtrConfig = {
  impressions: { label: 'Impressions', color: 'var(--chart-5)' },
  ctr: { label: 'CTR', color: 'var(--chart-6)' },
} satisfies ChartConfig;

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatRoas(value: number): string {
  return `${value.toFixed(2)}x`;
}

export function DashboardChartGrid({ chartPoints, isLoading, isError }: DashboardChartGridProps) {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <DashboardLineChartCard
        title="Revenue vs ROAS"
        description="Daily revenue and return on ad spend for the selected range."
        data={chartPoints}
        config={revenueVsRoasConfig}
        series={[
          { dataKey: 'revenue', color: 'var(--color-revenue)', yAxisId: 'left' },
          { dataKey: 'roas', color: 'var(--color-roas)', yAxisId: 'right' },
        ]}
        isLoading={isLoading}
        isError={isError}
        leftAxisFormatter={formatCurrency}
        rightAxisFormatter={formatRoas}
      />
      <DashboardLineChartCard
        title="Spend vs CPM"
        description="Daily spend and cost per thousand impressions for the selected range."
        data={chartPoints}
        config={spendVsCpmConfig}
        series={[
          { dataKey: 'spend', color: 'var(--color-spend)', yAxisId: 'left' },
          { dataKey: 'cpm', color: 'var(--color-cpm)', yAxisId: 'right' },
        ]}
        isLoading={isLoading}
        isError={isError}
        leftAxisFormatter={formatCurrency}
        rightAxisFormatter={formatCurrency}
      />
      <DashboardLineChartCard
        title="Impressions vs CTR"
        description="Daily reach and click-through rate for the selected range."
        data={chartPoints}
        config={impressionsVsCtrConfig}
        series={[
          { dataKey: 'impressions', color: 'var(--color-impressions)', yAxisId: 'left' },
          { dataKey: 'ctr', color: 'var(--color-ctr)', yAxisId: 'right' },
        ]}
        isLoading={isLoading}
        isError={isError}
        leftAxisFormatter={(v) => v.toLocaleString()}
        rightAxisFormatter={formatPercent}
      />
    </section>
  );
}
