'use client';

import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { LineChart, Line, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardChartPoint } from './dashboard-types';

interface DashboardLineChartCardProps {
  title: string;
  description: string;
  data: DashboardChartPoint[];
  config: ChartConfig;
  series: Array<{ dataKey: string; color: string; yAxisId?: string }>;
  isLoading: boolean;
  isError: boolean;
  leftAxisFormatter?: (value: number) => string;
  rightAxisFormatter?: (value: number) => string;
}

export function DashboardLineChartCard({
  title, description, data, config, series, isLoading, isError,
  leftAxisFormatter, rightAxisFormatter,
}: DashboardLineChartCardProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <Skeleton className="mb-2 h-5 w-48" />
        <Skeleton className="mb-4 h-4 w-64" />
        <Skeleton className="h-56 rounded-2xl" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="rounded-3xl border border-red-100 bg-white p-6 text-sm font-medium text-red-600 shadow-sm">
        Failed to load chart data
      </section>
    );
  }

  if (data.length === 0) {
    return (
      <section className="rounded-3xl border border-stone-100 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-2 text-sm text-stone-500">No data available for the selected range.</p>
      </section>
    );
  }

  const hasDualAxis = series.some((s) => s.yAxisId === 'right');

  return (
    <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>

      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        <LineChart data={data} margin={{ left: 12, right: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={leftAxisFormatter}
          />
          {hasDualAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={rightAxisFormatter}
            />
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {series.map((s) => (
            <Line
              key={s.dataKey}
              dataKey={s.dataKey}
              yAxisId={s.yAxisId ?? 'left'}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </section>
  );
}
