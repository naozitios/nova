'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Campaign } from '@/types/advertising';
import { CampaignsToolbar } from '@/components/campaigns/CampaignsToolbar';
import { CampaignsTable } from '@/components/campaigns/CampaignsTable';
import { ColumnCustomizer } from '@/components/campaigns/ColumnCustomizer';
import { ExportViewModal } from '@/components/campaigns/ExportViewModal';
import { campaignsToTableRows, filterCampaigns, generateCSV, downloadCSV } from '@/components/campaigns/campaign-table-utils';
import { DEFAULT_VISIBLE_COLUMNS, CAMPAIGN_COLUMNS, getSupportedColumns } from '@/components/campaigns/campaign-column-registry';
import type { FilterState } from '@/components/campaigns/campaign-table-types';

const EMPTY_FILTERS: FilterState = {
  search: '',
  status: [],
  objective: [],
  platform: [],
  dateRange: null,
  country: [],
};

export default function Campaigns() {
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(DEFAULT_VISIBLE_COLUMNS);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const res = await fetch('/api/campaign');
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((e: Record<string, unknown>) => ({
        id: e.id as string,
        name: (e.config as Record<string, unknown>)?.name as string || (e.name as string),
        platform: ((e.config as Record<string, unknown>)?.platform as string[])?.[0] || 'meta' as const,
        status: 'active' as const,
        objective: (e.config as Record<string, unknown>)?.objective as string || '',
        totalBudget: parseInt((e.config as Record<string, unknown>)?.totalBudget as string) || 0,
        startDate: (e.config as Record<string, unknown>)?.startDate as string || '',
        endDate: (e.config as Record<string, unknown>)?.endDate as string || '',
        adGroups: [],
        createdAt: e.createdAt as string || '',
        updatedAt: e.updatedAt as string || '',
      }));
    },
  });



  const allRows = campaignsToTableRows(campaigns);
  const filteredRows = filterCampaigns(allRows, filters);

  const handleColumnApply = (columnIds: string[]) => {
    setVisibleColumnIds(columnIds);
    setColumnCustomizerOpen(false);
  };

  const handleColumnReset = () => {
    setVisibleColumnIds(DEFAULT_VISIBLE_COLUMNS);
    setColumnCustomizerOpen(false);
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    if (format === 'csv') {
      const visibleColumns = getSupportedColumns().filter(col =>
        visibleColumnIds.includes(col.id)
      );
      const csv = generateCSV(filteredRows, visibleColumns);
      downloadCSV(csv, 'campaigns-export.csv');
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 pt-28 pb-16 px-6 md:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-stone-900">Campaigns</h1>

        <CampaignsToolbar
          onColumnsClick={() => setColumnCustomizerOpen(true)}
          onExportClick={() => setExportModalOpen(true)}
          campaignCount={filteredRows.length}
          filters={filters}
          onFiltersChange={setFilters}
        />

        {isLoading ? (
          <div className="space-y-4">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-24" />
            ))}
          </div>
        ) : (
          <CampaignsTable
            rows={filteredRows}
            columns={CAMPAIGN_COLUMNS}
            visibleColumnIds={visibleColumnIds}
            isLoading={isLoading}
            hasActiveFilters={
              filters.search !== '' ||
              filters.status.length > 0 ||
              filters.objective.length > 0 ||
              filters.platform.length > 0 ||
              filters.dateRange !== null ||
              filters.country.length > 0
            }
          />
        )}

        {columnCustomizerOpen && (
          <ColumnCustomizer
            visibleColumnIds={visibleColumnIds}
            onApply={handleColumnApply}
            onReset={handleColumnReset}
            onClose={() => setColumnCustomizerOpen(false)}
          />
        )}

        {exportModalOpen && (
          <ExportViewModal
            rows={filteredRows}
            visibleColumns={CAMPAIGN_COLUMNS.filter(col => visibleColumnIds.includes(col.id))}
            onExport={handleExport}
            onClose={() => setExportModalOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
