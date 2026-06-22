'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, DollarSign, MousePointerClick, Eye, TrendingUp } from 'lucide-react';
import { adClient } from '@/api/adClient';
import { AggregatedMetrics, AnalyticsSnapshot } from '@/types/advertising';

function formatCurrency(n: number) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function MetricCard({ title, value, change, icon: Icon, trend }: { title: string; value: string; change: string; icon: React.ElementType; trend: 'up' | 'down' | 'neutral' }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-stone-500">{title}</span>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FEF3E2] to-[#FFDAB9] flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#E55A3C]" />
        </div>
      </div>
      <div className="text-3xl font-semibold text-stone-900 mb-1">{value}</div>
      <div className={`flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400'}`}>
        {trend === 'up' ? <ArrowUp className="w-4 h-4" /> : trend === 'down' ? <ArrowDown className="w-4 h-4" /> : null}
        {change}
      </div>
    </motion.div>
  );
}

function PlatformBreakdown({ data }: { data: AggregatedMetrics }) {
  const platforms = [
    { name: 'Meta Ads', key: 'meta' as const, color: '#E55A3C' },
    { name: 'Google Ads', key: 'google' as const, color: '#4285F4' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
      <h3 className="text-lg font-semibold text-stone-900 mb-6">Platform Breakdown</h3>
      <div className="space-y-6">
        {platforms.map(({ name, key, color }) => {
          const p = data.platformBreakdown[key];
          const spendPct = data.totalSpend > 0 ? ((p.spend / data.totalSpend) * 100).toFixed(1) : '0';
          const roas = p.spend > 0 ? (p.revenue / p.spend).toFixed(2) : '0.00';
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium text-stone-900">{name}</span>
                </div>
                <span className="text-sm text-stone-500">{spendPct}% of spend</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <div className="text-xs text-stone-400">Spend</div>
                  <div className="text-sm font-semibold text-stone-900">{formatCurrency(p.spend)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-400">Revenue</div>
                  <div className="text-sm font-semibold text-stone-900">{formatCurrency(p.revenue)}</div>
                </div>
                <div>
                  <div className="text-xs text-stone-400">ROAS</div>
                  <div className="text-sm font-semibold text-stone-900">{roas}x</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function PerformanceChart({ data }: { data: AnalyticsSnapshot[] }) {
  const daily = data.reduce<Record<string, { spend: number; revenue: number }>>((acc, d) => {
    if (!acc[d.date]) acc[d.date] = { spend: 0, revenue: 0 };
    acc[d.date].spend += d.spend;
    acc[d.date].revenue += d.revenue;
    return acc;
  }, {});
  const sorted = Object.entries(daily).sort(([a], [b]) => a.localeCompare(b));
  const maxVal = Math.max(...sorted.map(([, v]) => Math.max(v.spend, v.revenue)), 1);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
      <h3 className="text-lg font-semibold text-stone-900 mb-6">30-Day Performance</h3>
      <div className="relative h-48">
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {sorted.map(([date, val]) => (
            <div key={date} className="flex-1 flex flex-col justify-end gap-[2px]">
              <div
                className="w-full rounded-t-sm bg-gradient-to-t from-[#E55A3C] to-[#F4A574] transition-all duration-300 hover:opacity-80"
                style={{ height: `${(val.revenue / maxVal) * 100}%` }}
              />
              <div
                className="w-full rounded-t-sm bg-stone-200 transition-all duration-300"
                style={{ height: `${(val.spend / maxVal) * 100}%` }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-gradient-to-t from-[#E55A3C] to-[#F4A574]" />
          <span className="text-stone-500">Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-stone-200" />
          <span className="text-stone-500">Spend</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: metrics, isLoading: mLoading } = useQuery<AggregatedMetrics>({ queryKey: ['analytics-latest'], queryFn: () => adClient.analytics.getLatest() });
  const { data: timeSeries } = useQuery<AnalyticsSnapshot[]>({ queryKey: ['analytics-timeseries'], queryFn: () => adClient.analytics.getTimeSeries() });

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900">Dashboard</h1>
          <p className="text-stone-500 mt-1">Real-time cross-channel performance overview</p>
        </div>

        {mLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-3xl p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : metrics ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <MetricCard title="Total Spend" value={formatCurrency(metrics.totalSpend)} change="+12.3% vs yesterday" icon={DollarSign} trend="up" />
              <MetricCard title="Total Impressions" value={metrics.totalImpressions.toLocaleString()} change="+8.1% vs yesterday" icon={Eye} trend="up" />
              <MetricCard title="Total Clicks" value={metrics.totalClicks.toLocaleString()} change="+15.2% vs yesterday" icon={MousePointerClick} trend="up" />
              <MetricCard title="Blended ROAS" value={`${metrics.blendedROAS.toFixed(2)}x`} change={`CTR: ${metrics.blendedCTR.toFixed(2)}%`} icon={TrendingUp} trend="neutral" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <div className="lg:col-span-2">
                {timeSeries && <PerformanceChart data={timeSeries} />}
              </div>
              <PlatformBreakdown data={metrics} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
