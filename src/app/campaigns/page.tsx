'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adClient } from '@/api/adClient';
import { Campaign } from '@/types/advertising';
import { campaignStore, ensureSeeded } from '@/lib/campaign-engine';
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
      const mock = await adClient.campaigns.list();
      await ensureSeeded();
      const stored = await campaignStore.list();
      const storedCamps: Campaign[] = stored.map(e => ({
        id: e.id,
        name: e.config.name,
        platform: e.config.platform[0] || 'meta',
        status: 'active' as const,
        objective: e.config.objective,
        totalBudget: e.config.totalBudget,
        startDate: e.config.startDate,
        endDate: e.config.endDate,
        adGroups: e.config.adSets.map(a => ({
          id: `${e.id}-${a.name}`,
          name: a.name,
          platform: e.config.platform[0] || 'meta',
          targeting: a.targeting,
          bidAmount: a.bidAmount,
          creatives: a.creatives.map(c => ({
            id: `${e.id}-cr`,
            name: c.headline.slice(0, 20),
            platform: e.config.platform[0] || 'meta',
            headline: c.headline,
            bodyText: c.bodyText,
            destinationUrl: c.destinationUrl,
            mediaUrl: c.mediaUrl,
            mediaType: c.mediaType,
            status: 'approved' as const,
          })),
        })),
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      }));
      const existingIds = new Set(mock.map(c => c.id));
      const merged = [...mock];
      for (const sc of storedCamps) {
        if (!existingIds.has(sc.id)) merged.push(sc);
      }
      return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
