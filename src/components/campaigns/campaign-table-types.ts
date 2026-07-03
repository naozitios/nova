import type { Campaign } from '@/types/advertising';

export type ColumnCategory =
  | 'setup'
  | 'budget'
  | 'delivery'
  | 'clicks'
  | 'engagement'
  | 'video'
  | 'conversion'
  | 'cost'
  | 'revenue'
  | 'diagnostics'
  | 'attribution'
  | 'breakdown';

export interface CampaignTableRow {
  id: string;
  name: string;
  platform: Campaign['platform'];
  status: Campaign['status'];
  objective: string;
  budget: number;
  startDate: string;
  endDate: string;
  adSetCount: number;
  countries: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ColumnDefinition {
  id: string;
  label: string;
  category: ColumnCategory;
  supported: boolean;
  disabledReason?: string;
  formatter?: (row: CampaignTableRow) => string;
}

export interface FilterState {
  search: string;
  status: string[];
  objective: string[];
  platform: string[];
  dateRange: { start: string; end: string } | null;
  country: string[];
}

export interface ExportRequest {
  rows: CampaignTableRow[];
  columns: ColumnDefinition[];
  format: 'csv' | 'excel' | 'pdf';
  confirmed: boolean;
}
