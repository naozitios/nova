'use client';

import { useCallback, useRef, useState } from 'react';
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
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({});
  const clickCountRef = useRef(0);

  const openCustomRangePicker = () => {
    setDraftRange(customRange?.from ? { from: customRange.from, to: customRange.to } : {});
    clickCountRef.current = customRange?.from ? 2 : 0;
    window.setTimeout(() => setCalendarOpen(true), 0);
  };

  const handleSelectChange = (next: string) => {
    if (next === 'custom') {
      openCustomRangePicker();
    } else {
      onChange(next as DashboardTimeRangeId);
    }
  };

  const handleCalendarSelect = useCallback((range: { from?: Date; to?: Date } | undefined) => {
    if (!range?.from) {
      setDraftRange({});
      clickCountRef.current = 0;
      return;
    }

    const clickedDate = range.to ?? range.from;

    if (clickCountRef.current >= 2) {
      setDraftRange({ from: clickedDate, to: undefined });
      clickCountRef.current = 1;
      return;
    }

    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
      setDraftRange({ from: clickedDate, to: undefined });
    } else {
      setDraftRange((prev) => {
        const start = prev?.from ?? clickedDate;
        if (clickedDate.getTime() < start.getTime()) {
          return { from: clickedDate, to: start };
        }
        return { from: start, to: clickedDate };
      });
    }
  }, []);

  const handleApply = () => {
    if (draftRange?.from && draftRange?.to && onCustomRangeChange) {
      onCustomRangeChange(draftRange);
      onChange('custom');
    }
    setCalendarOpen(false);
  };

  const handleCancel = () => {
    setCalendarOpen(false);
  };

  const triggerLabel =
    value === 'custom' && customRange?.from
      ? formatCustomRangeLabel(customRange)
      : undefined;

  return (
    <div className="flex flex-col gap-2 sm:items-end">
      <div className="relative flex flex-col gap-2 sm:items-end">
        <label className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
          Time range
        </label>
        <div className="flex items-center gap-2">
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
          {value === 'custom' && customRange?.from ? (
            <button
              type="button"
              onClick={openCustomRangePicker}
              className="h-10 rounded-full border border-stone-200 bg-white px-4 text-sm font-medium text-stone-700 shadow-sm hover:bg-stone-50"
            >
              Edit
            </button>
          ) : null}
        </div>
        {calendarOpen ? (
          <div className="absolute right-0 top-full z-50 mt-2 w-max rounded-3xl border border-stone-200 bg-white p-4 shadow-md">
            <div className="mb-3 flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-stone-700">Select date range</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="text-xs text-stone-400 hover:text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!draftRange?.from || !draftRange?.to}
                  className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
            <Calendar
              mode="range"
              selected={draftRange?.from ? (draftRange as { from: Date; to?: Date }) : undefined}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
