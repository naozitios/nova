import { format, parseISO } from 'date-fns';
import type { Campaign } from '@/types/advertising';
import type {
  CampaignTableRow,
  ColumnDefinition,
  FilterState,
} from './campaign-table-types';

export function campaignToTableRow(campaign: Campaign): CampaignTableRow {
  return {
    id: campaign.id,
    name: campaign.name,
    platform: campaign.platform,
    status: campaign.status,
    objective: formatObjective(campaign.objective),
    budget: campaign.totalBudget,
    startDate: formatDate(campaign.startDate),
    endDate: formatDate(campaign.endDate),
    adSetCount: campaign.adGroups.length,
    countries: [...new Set(campaign.adGroups.flatMap(ag => ag.targeting.countries))],
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

export function campaignsToTableRows(campaigns: Campaign[]): CampaignTableRow[] {
  return campaigns.map(campaignToTableRow);
}

export function formatObjective(objective: string): string {
  return objective
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'MMM d, yyyy');
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function filterCampaigns(
  rows: CampaignTableRow[],
  filters: FilterState,
): CampaignTableRow[] {
  return rows.filter(row => {
    const query = filters.search.toLowerCase();
    if (
      query &&
      !row.name.toLowerCase().includes(query) &&
      !row.platform.toLowerCase().includes(query) &&
      !row.objective.toLowerCase().includes(query)
    ) {
      return false;
    }

    if (filters.status.length > 0 && !filters.status.includes(row.status)) {
      return false;
    }

    if (filters.objective.length > 0 && !filters.objective.includes(row.objective)) {
      return false;
    }

    if (filters.platform.length > 0 && !filters.platform.includes(row.platform)) {
      return false;
    }

    if (filters.dateRange) {
      const { start, end } = filters.dateRange;
      const rowDate = row.startDate;
      if (start && rowDate < start) return false;
      if (end && rowDate > end) return false;
    }

    if (filters.country.length > 0) {
      const hasMatchingCountry = filters.country.some(c => row.countries.includes(c));
      if (!hasMatchingCountry) return false;
    }

    return true;
  });
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function generateCSV(
  rows: CampaignTableRow[],
  columns: ColumnDefinition[],
): string {
  const visibleColumns = columns.filter(col => col.supported);

  const header = visibleColumns.map(col => csvEscape(col.label)).join(',');
  const dataRows = rows.map(row =>
    visibleColumns
      .map(col => {
        const value = col.formatter ? col.formatter(row) : '';
        return csvEscape(String(value));
      })
      .join(','),
  );

  return [header, ...dataRows].join('\n');
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
