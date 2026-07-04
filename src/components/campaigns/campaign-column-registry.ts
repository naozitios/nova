import type { ColumnDefinition, ColumnCategory } from './campaign-table-types';

export const CAMPAIGN_COLUMNS: ColumnDefinition[] = [
  // Setup
  { id: 'campaign', label: 'Campaign', category: 'setup', supported: true, formatter: (row) => row.name },
  { id: 'account', label: 'Account', category: 'setup', supported: false, disabledReason: 'Requires ad account data' },
  { id: 'objective', label: 'Objective', category: 'setup', supported: true, formatter: (row) => row.objective },
  { id: 'buyingtype', label: 'Buying Type', category: 'setup', supported: false, disabledReason: 'Not available in current data' },

  // Budget
  { id: 'budget', label: 'Budget', category: 'budget', supported: true, formatter: (row) => `$${row.budget.toLocaleString()}` },
  { id: 'budgettype', label: 'Budget Type', category: 'budget', supported: false, disabledReason: 'Requires budget configuration data' },
  { id: 'bidstrategy', label: 'Bid Strategy', category: 'budget', supported: false, disabledReason: 'Requires bid strategy data' },

  // Delivery
  { id: 'delivery', label: 'Delivery', category: 'delivery', supported: false, disabledReason: 'Requires delivery metrics' },
  { id: 'frequency', label: 'Frequency', category: 'delivery', supported: false, disabledReason: 'Requires impression data' },
  { id: 'reach', label: 'Reach', category: 'delivery', supported: false, disabledReason: 'Requires reach metrics' },

  // Clicks
  { id: 'linkclicks', label: 'Link Clicks', category: 'clicks', supported: false, disabledReason: 'Requires click tracking data' },
  { id: 'ctr', label: 'CTR', category: 'clicks', supported: false, disabledReason: 'Requires impression data' },
  { id: 'cpc', label: 'CPC', category: 'clicks', supported: false, disabledReason: 'Requires cost and click data' },

  // Engagement
  { id: 'impressions', label: 'Impressions', category: 'engagement', supported: false, disabledReason: 'Requires impression data' },
  { id: 'engagementreach', label: 'Reach', category: 'engagement', supported: false, disabledReason: 'Requires reach metrics' },
  { id: 'socialimpressions', label: 'Social Impressions', category: 'engagement', supported: false, disabledReason: 'Requires social data' },

  // Video
  { id: 'thruplay', label: 'ThruPlay', category: 'video', supported: false, disabledReason: 'Requires video metrics' },
  { id: 'videoviews', label: 'Video Views', category: 'video', supported: false, disabledReason: 'Requires video data' },
  { id: 'videoviewrate', label: 'Video View Rate', category: 'video', supported: false, disabledReason: 'Requires video view data' },

  // Conversion
  { id: 'conversions', label: 'Conversions', category: 'conversion', supported: false, disabledReason: 'Requires conversion tracking' },
  { id: 'conversionrate', label: 'Conversion Rate', category: 'conversion', supported: false, disabledReason: 'Requires conversion data' },
  { id: 'costperconversion', label: 'Cost per Conversion', category: 'conversion', supported: false, disabledReason: 'Requires cost and conversion data' },

  // Cost
  { id: 'amountspent', label: 'Amount Spent', category: 'cost', supported: false, disabledReason: 'Requires spend data' },
  { id: 'cpm', label: 'CPM', category: 'cost', supported: false, disabledReason: 'Requires impression and cost data' },

  // Revenue
  { id: 'roas', label: 'ROAS', category: 'revenue', supported: false, disabledReason: 'Requires revenue data' },
  { id: 'revenue', label: 'Revenue', category: 'revenue', supported: false, disabledReason: 'Requires revenue data' },

  // Diagnostics
  { id: 'qualityranking', label: 'Quality Ranking', category: 'diagnostics', supported: false, disabledReason: 'Requires quality data' },
  { id: 'engagementranking', label: 'Engagement Ranking', category: 'diagnostics', supported: false, disabledReason: 'Requires engagement ranking' },
  { id: 'conversionranking', label: 'Conversion Ranking', category: 'diagnostics', supported: false, disabledReason: 'Requires conversion ranking' },

  // Attribution
  { id: 'attributionmodel', label: 'Attribution Model', category: 'attribution', supported: false, disabledReason: 'Requires attribution setup' },

  // Breakdown
  { id: 'age', label: 'Age', category: 'breakdown', supported: false, disabledReason: 'Requires demographic breakdown' },
  { id: 'gender', label: 'Gender', category: 'breakdown', supported: false, disabledReason: 'Requires demographic breakdown' },
  { id: 'placement', label: 'Placement', category: 'breakdown', supported: false, disabledReason: 'Requires placement data' },
];

export const DEFAULT_VISIBLE_COLUMNS = CAMPAIGN_COLUMNS
  .filter((col) => col.supported)
  .map((col) => col.id);

export function getColumnById(id: string): ColumnDefinition | undefined {
  return CAMPAIGN_COLUMNS.find((col) => col.id === id);
}

export function getSupportedColumns(): ColumnDefinition[] {
  return CAMPAIGN_COLUMNS.filter((col) => col.supported);
}

export function getColumnsByCategory(category: ColumnCategory): ColumnDefinition[] {
  return CAMPAIGN_COLUMNS.filter((col) => col.category === category);
}
