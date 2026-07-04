const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().split('T')[0];

const mockCampaigns: CampaignSeed[] = [
  { id: 'cmp1', name: 'Summer Collection Launch', platform: 'meta', objective: 'CONVERSIONS', budget: 5000, startDate: '2026-06-01', endDate: '2026-07-15' },
  { id: 'cmp2', name: 'PMax - Evergreen', platform: 'google', objective: 'CONVERSIONS', budget: 8000, startDate: '2026-05-01', endDate: '2026-12-31' },
  { id: 'cmp3', name: 'Retargeting - Abandoned Cart', platform: 'meta', objective: 'RETENTION', budget: 2500, startDate: '2026-06-10', endDate: '2026-07-10' },
  { id: 'cmp4', name: 'Brand Awareness Q3', platform: 'google', objective: 'BRAND_AWARENESS', budget: 10000, startDate: '2026-07-01', endDate: '2026-09-30' },
  { id: 'cmp5', name: 'Holiday Flash Sale', platform: 'meta', objective: 'CONVERSIONS', budget: 3000, startDate: '2026-06-15', endDate: '2026-06-30' },
];

interface CampaignSeed {
  id: string; name: string; platform: string; objective: string; budget: number; startDate: string; endDate: string;
}

export function getMockAnalytics() {
  const spend = 12580;
  const impressions = 845000;
  const clicks = 12450;
  const revenue = 48200;
  return {
    totalSpend: spend,
    totalImpressions: impressions,
    totalClicks: clicks,
    totalRevenue: revenue,
    blendedCTR: (clicks / impressions) * 100,
    blendedROAS: revenue / spend,
    platformBreakdown: {
      meta: { spend: Math.round(spend * 0.65), impressions: Math.round(impressions * 0.7), clicks: Math.round(clicks * 0.6), revenue: Math.round(revenue * 0.7) },
      google: { spend: Math.round(spend * 0.35), impressions: Math.round(impressions * 0.3), clicks: Math.round(clicks * 0.4), revenue: Math.round(revenue * 0.3) },
    },
  };
}

export function getMockTimeSeries() {
  const snapshots: Array<{ date: string; platform: string; campaignId: string; campaignName: string; spend: number; impressions: number; clicks: number; revenue: number }> = [];
  for (let d = 30; d >= 0; d--) {
    const date = daysAgo(d);
    for (const c of mockCampaigns) {
      snapshots.push({
        date,
        platform: c.platform,
        campaignId: c.id,
        campaignName: c.name,
        spend: Math.round(Math.random() * 500 + 50),
        impressions: Math.round(Math.random() * 50000 + 5000),
        clicks: Math.round(Math.random() * 2000 + 100),
        revenue: Math.round(Math.random() * 3000 + 200),
      });
    }
  }
  return snapshots;
}

export function getMockCampaignSeeds(): CampaignSeed[] {
  return mockCampaigns;
}
