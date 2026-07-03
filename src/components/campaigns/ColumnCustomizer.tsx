'use client';

import { useState } from 'react';
import { Search, X, RotateCcw, Check } from 'lucide-react';
import { CAMPAIGN_COLUMNS } from './campaign-column-registry';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ColumnCategory, ColumnDefinition } from './campaign-table-types';

interface ColumnCustomizerProps {
  visibleColumnIds: string[];
  onApply: (columnIds: string[]) => void;
  onReset: () => void;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<ColumnCategory, string> = {
  setup: 'Setup',
  budget: 'Budget',
  delivery: 'Delivery',
  clicks: 'Clicks',
  engagement: 'Engagement',
  video: 'Video',
  conversion: 'Conversion',
  cost: 'Cost',
  revenue: 'Revenue',
  diagnostics: 'Diagnostics',
  attribution: 'Attribution',
  breakdown: 'Breakdown',
};

const CATEGORY_ORDER: ColumnCategory[] = [
  'setup',
  'budget',
  'delivery',
  'clicks',
  'engagement',
  'video',
  'conversion',
  'cost',
  'revenue',
  'diagnostics',
  'attribution',
  'breakdown',
];

function groupByCategory(columns: ColumnDefinition[]): Map<ColumnCategory, ColumnDefinition[]> {
  const map = new Map<ColumnCategory, ColumnDefinition[]>();
  for (const col of columns) {
    const existing = map.get(col.category);
    if (existing) {
      existing.push(col);
    } else {
      map.set(col.category, [col]);
    }
  }
  return map;
}

export function ColumnCustomizer({
  visibleColumnIds,
  onApply,
  onReset,
  onClose,
}: ColumnCustomizerProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(visibleColumnIds),
  );
  const [search, setSearch] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ColumnCategory>>(
    () => new Set(),
  );

  const filteredColumns = search
    ? CAMPAIGN_COLUMNS.filter((col) =>
        col.label.toLowerCase().includes(search.toLowerCase()),
      )
    : CAMPAIGN_COLUMNS;

  const grouped = groupByCategory(filteredColumns);

  const activeCategories = CATEGORY_ORDER.filter((cat) => grouped.has(cat));

  function toggleColumn(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleCategory(category: ColumnCategory) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  function handleApply() {
    onApply(Array.from(selectedIds));
    onClose();
  }

  function handleReset() {
    onReset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-lg font-semibold text-stone-900">Customize Columns</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5 text-stone-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <Input
              placeholder="Search columns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl bg-stone-50 border-stone-200"
            />
          </div>
        </div>

        {/* Column list */}
        <div className="px-6 py-2 max-h-[400px] overflow-y-auto">
          {activeCategories.length === 0 ? (
            <p className="py-8 text-center text-sm text-stone-400">
              No columns match your search.
            </p>
          ) : (
            activeCategories.map((category) => {
              const columns = grouped.get(category)!;
              const isCollapsed = collapsedCategories.has(category);
              const enabledCount = columns.filter(
                (col) => col.supported && selectedIds.has(col.id),
              ).length;

              return (
                <div key={category} className="mb-2">
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center justify-between w-full py-2 text-left group"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                      {CATEGORY_LABELS[category]}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-stone-400">
                        {enabledCount}/{columns.length}
                      </span>
                      <span className="text-stone-300 text-xs">
                        {isCollapsed ? '▶' : '▼'}
                      </span>
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {columns.map((col) => {
                        const isSelected = selectedIds.has(col.id);
                        const isDisabled = !col.supported;

                        return (
                          <div
                            key={col.id}
                            className={`flex items-center gap-3 py-2 px-2 rounded-lg transition-colors ${
                              isDisabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:bg-stone-50'
                            }`}
                            onClick={() => {
                              if (!isDisabled) toggleColumn(col.id);
                            }}
                          >
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-[#E55A3C] border-[#E55A3C]'
                                  : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>

                            <span className="flex-1 text-sm text-stone-700">
                              {col.label}
                            </span>

                            {isDisabled && col.disabledReason ? (
                              <span className="text-xs text-stone-400 italic">
                                {col.disabledReason}
                              </span>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 bg-stone-100 text-stone-500"
                              >
                                {CATEGORY_LABELS[col.category]}
                              </Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-stone-100 bg-stone-50/50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 border-stone-200 text-stone-600"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-stone-500"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="bg-[#E55A3C] hover:bg-[#D14A2E] text-white"
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
