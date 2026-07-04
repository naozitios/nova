'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import type { DashboardTimeRangeId } from './dashboard-types';
import { DASHBOARD_TIME_RANGES } from './dashboard-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface DashboardTimeRangeSelectorProps {
  value: DashboardTimeRangeId;
  onChange: (value: DashboardTimeRangeId) => void;
  customRange?: { from?: Date; to?: Date };
  onCustomRangeChange?: (range: { from?: Date; to?: Date }) => void;
}

function formatCustomRangeLabel(range: { from?: Date; to?: Date }): string {
  if (!range.from) return 'Custom';
  const fromStr = format(range.from, 'MMM d');
  if (!range.to) return `Custom: ${fromStr}`;
  return `Custom: ${fromStr} – ${format(range.to, 'MMM d')}`;
}

export function DashboardTimeRangeSelector({
  value,
  onChange,
  customRange,
  onCustomRangeChange,
}: DashboardTimeRangeSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSelectChange = (next: string) => {
    if (next === 'custom') {
      setCalendarOpen(true);
    } else {
      onChange(next as DashboardTimeRangeId);
    }
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to && onCustomRangeChange) {
      onCustomRangeChange(range);
      onChange('custom');
      setCalendarOpen(false);
    }
  };

  const triggerLabel =
    value === 'custom' && customRange?.from
      ? formatCustomRangeLabel(customRange)
      : undefined;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <label className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
        Time range
      </label>
      <div className="relative">
        <Select value={value} onValueChange={handleSelectChange}>
          <SelectTrigger className="h-10 min-w-[180px] rounded-full border-stone-200 bg-white px-4 text-stone-700 shadow-sm">
            <SelectValue placeholder="Select time range">
              {triggerLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl border-stone-100 bg-white">
            {DASHBOARD_TIME_RANGES.map((range) => (
              <SelectItem key={range.id} value={range.id} disabled={!range.supported}>
                {range.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <span />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={customRange?.from ? customRange as { from: Date; to?: Date } : undefined}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
