'use client';

import type { DashboardTimeRangeId } from './dashboard-types';
import { DASHBOARD_TIME_RANGES } from './dashboard-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DashboardTimeRangeSelectorProps {
  value: DashboardTimeRangeId;
  onChange: (value: DashboardTimeRangeId) => void;
}

export function DashboardTimeRangeSelector({ value, onChange }: DashboardTimeRangeSelectorProps) {
  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <label className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
        Time range
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as DashboardTimeRangeId)}>
        <SelectTrigger className="h-10 min-w-[180px] rounded-full border-stone-200 bg-white px-4 text-stone-700 shadow-sm">
          <SelectValue placeholder="Select time range" />
        </SelectTrigger>
        <SelectContent align="end" className="rounded-xl border-stone-100 bg-white">
          {DASHBOARD_TIME_RANGES.map((range) => (
            <SelectItem key={range.id} value={range.id} disabled={!range.supported}>
              {range.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
