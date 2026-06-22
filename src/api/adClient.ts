import { AdAccount, Campaign, MediaAsset, AnalyticsSnapshot, BudgetRule, AggregatedMetrics, Platform } from '@/types/advertising';

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString().split('T')[0];

const mockAccounts: AdAccount[] = [
  { id: 'acc1', platform: 'meta', name: 'Main Brand Account', accountId: 'act_123456789', status: 'connected', currency: 'USD', timezone: 'America/New_York' },
  { id: 'acc2', platform: 'google', name: 'Google Ads - Main', accountId: '123-456-7890', status: 'connected', currency: 'USD', timezone: 'America/New_York' },
];

const mockCampaigns: Campaign[] = [
  {
    id: 'cmp1', name: 'Summer Collection Launch', platform: 'meta', status: 'active', objective: 'CONVERSIONS',
    totalBudget: 5000, startDate: '2026-06-01', endDate: '2026-07-15', createdAt: '2026-05-28', updatedAt: '2026-06-22',
    adGroups: [{
      id: 'ag1', name: 'Women 25-40', platform: 'meta',
      targeting: { countries: ['US', 'CA', 'UK'], ageRange: [25, 40], languages: ['en'] },
      bidAmount: 15,
      creatives: [{
        id: 'cr1', name: 'Summer Hero', platform: 'meta', headline: 'Beat the heat in style', bodyText: 'Our summer collection is here. Shop now.',
        destinationUrl: 'https://example.com/summer', mediaUrl: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600', mediaType: 'image',
        status: 'approved',
      }],
    }],
  },
  {
    id: 'cmp2', name: 'PMax - Evergreen', platform: 'google', status: 'active', objective: 'CONVERSIONS',
    totalBudget: 8000, startDate: '2026-05-01', endDate: '2026-12-31', createdAt: '2026-04-28', updatedAt: '2026-06-21',
    adGroups: [{
      id: 'ag2', name: 'Performance Max', platform: 'google',
      targeting: { countries: ['US', 'CA'], ageRange: [18, 65], languages: ['en'] },
      bidAmount: 20,
      creatives: [{
        id: 'cr2', name: 'PMax Asset Group 1', platform: 'google', headline: 'Premium Quality, Best Price', bodyText: 'Discover our range. Free shipping on orders over $50.',
        destinationUrl: 'https://example.com/shop', mediaUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', mediaType: 'image',
        status: 'approved',
      }],
    }],
  },
  {
    id: 'cmp3', name: 'Retargeting - Abandoned Cart', platform: 'meta', status: 'active', objective: 'RETENTION',
    totalBudget: 2500, startDate: '2026-06-10', endDate: '2026-07-10', createdAt: '2026-06-08', updatedAt: '2026-06-22',
    adGroups: [{
      id: 'ag3', name: 'Cart Abandoners', platform: 'meta',
      targeting: { countries: ['US'], ageRange: [22, 55], languages: ['en'] },
      bidAmount: 12,
      creatives: [{
        id: 'cr3', name: 'Comeback Offer', platform: 'meta', headline: 'Still thinking it over?', bodyText: 'Get 10% off your abandoned cart. Limited time.',
        destinationUrl: 'https://example.com/cart', mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600', mediaType: 'image',
        status: 'approved',
      }],
    }],
  },
  {
    id: 'cmp4', name: 'Brand Awareness Q3', platform: 'google', status: 'draft', objective: 'BRAND_AWARENESS',
    totalBudget: 10000, startDate: '2026-07-01', endDate: '2026-09-30', createdAt: '2026-06-20', updatedAt: '2026-06-20',
    adGroups: [{
      id: 'ag4', name: 'Display Network', platform: 'google',
      targeting: { countries: ['US', 'CA', 'UK', 'AU'], ageRange: [20, 60], languages: ['en', 'es'] },
      bidAmount: 8,
      creatives: [{
        id: 'cr4', name: 'Display Creative', platform: 'google', headline: 'Your Brand, Everywhere', bodyText: 'Reach millions with our display network.',
        destinationUrl: 'https://example.com/brand', mediaUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600', mediaType: 'image',
        status: 'pending',
      }],
    }],
  },
  {
    id: 'cmp5', name: 'Holiday Flash Sale', platform: 'meta', status: 'paused', objective: 'CONVERSIONS',
    totalBudget: 3000, startDate: '2026-06-15', endDate: '2026-06-30', createdAt: '2026-06-12', updatedAt: '2026-06-19',
    adGroups: [{
      id: 'ag5', name: 'Flash Sale - All', platform: 'meta',
      targeting: { countries: ['US'], ageRange: [18, 65], languages: ['en'] },
      bidAmount: 18,
      creatives: [{
        id: 'cr5', name: 'Flash Sale Creative', platform: 'meta', headline: '50% Off Everything!', bodyText: '24-hour flash sale. Don\'t miss out.',
        destinationUrl: 'https://example.com/sale', mediaUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600', mediaType: 'image',
        status: 'rejected',
        rejectionReason: 'Text exceeds 20% rule in primary text area.',
      }],
    }],
  },
];

const mockAssets: MediaAsset[] = [
  { id: 'ast1', name: 'Shoe Hero Shot', fileUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600', fileType: 'image', fileSize: 2048000, dimensions: { width: 1200, height: 1200 }, uploadedAt: '2026-06-01', validationStatus: 'valid' },
  { id: 'ast2', name: 'Summer Product Video', fileUrl: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600', fileType: 'image', fileSize: 1536000, dimensions: { width: 1920, height: 1080 }, uploadedAt: '2026-06-02', validationStatus: 'valid' },
  { id: 'ast3', name: 'Lifestyle Banner', fileUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', fileType: 'image', fileSize: 3100000, dimensions: { width: 2400, height: 1200 }, uploadedAt: '2026-06-05', validationStatus: 'invalid', validationMessage: 'Video exceeds 60s limit for Meta Feed ads.' },
  { id: 'ast4', name: 'Brand Logo', fileUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600', fileType: 'image', fileSize: 512000, dimensions: { width: 800, height: 800 }, uploadedAt: '2026-06-10', validationStatus: 'valid' },
];

function generateAnalytics(): AnalyticsSnapshot[] {
  const snapshots: AnalyticsSnapshot[] = [];
  for (let d = 30; d >= 0; d--) {
    const date = daysAgo(d);
    mockCampaigns.filter(c => c.status !== 'draft').forEach(c => {
      snapshots.push({
        date, platform: c.platform as Platform, campaignId: c.id, campaignName: c.name,
        spend: Math.round(Math.random() * 500 + 50),
        impressions: Math.round(Math.random() * 50000 + 5000),
        clicks: Math.round(Math.random() * 2000 + 100),
        revenue: Math.round(Math.random() * 3000 + 200),
      });
    });
  }
  return snapshots;
}

const mockAnalytics = generateAnalytics();

const mockRules: BudgetRule[] = [
  { id: 'rule1', name: 'Optimize Cross-Channel Allocations Daily', enabled: true, minBudget: 1000, maxBudget: 10000, platformA: 'meta', platformB: 'google', roasThreshold: 0.2, shiftPercentage: 0.1, lastExecuted: '2026-06-21T23:50:00Z' },
];

function computeAggregatedMetrics(): AggregatedMetrics {
  const latest = mockAnalytics.filter(a => a.date === daysAgo(0));
  const totals = { totalSpend: 0, totalImpressions: 0, totalClicks: 0, totalRevenue: 0 };
  const platformBreakdown = { meta: { spend: 0, impressions: 0, clicks: 0, revenue: 0 }, google: { spend: 0, impressions: 0, clicks: 0, revenue: 0 } };

  latest.forEach(a => {
    totals.totalSpend += a.spend;
    totals.totalImpressions += a.impressions;
    totals.totalClicks += a.clicks;
    totals.totalRevenue += a.revenue;
    if (a.platform in platformBreakdown) {
      platformBreakdown[a.platform as keyof typeof platformBreakdown].spend += a.spend;
      platformBreakdown[a.platform as keyof typeof platformBreakdown].impressions += a.impressions;
      platformBreakdown[a.platform as keyof typeof platformBreakdown].clicks += a.clicks;
      platformBreakdown[a.platform as keyof typeof platformBreakdown].revenue += a.revenue;
    }
  });

  return {
    ...totals,
    blendedCTR: totals.totalImpressions > 0 ? (totals.totalClicks / totals.totalImpressions) * 100 : 0,
    blendedROAS: totals.totalSpend > 0 ? totals.totalRevenue / totals.totalSpend : 0,
    platformBreakdown,
  };
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export const adClient = {
  accounts: {
    list: async () => { await delay(400); return mockAccounts; },
    connect: async (platform: Platform) => { await delay(800); return { success: true, platform }; },
    disconnect: async (id: string) => { await delay(300); return { success: true, id }; },
  },
  campaigns: {
    list: async () => { await delay(500); return mockCampaigns; },
    create: async (data: Partial<Campaign>) => { await delay(1000); const c: Campaign = { id: `cmp-${Date.now()}`, ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), adGroups: [] } as Campaign; mockCampaigns.push(c); return c; },
    update: async (id: string, data: Partial<Campaign>) => { await delay(500); const idx = mockCampaigns.findIndex(c => c.id === id); if (idx >= 0) { mockCampaigns[idx] = { ...mockCampaigns[idx], ...data, updatedAt: new Date().toISOString() }; return mockCampaigns[idx]; } return null; },
    delete: async (id: string) => { await delay(300); const idx = mockCampaigns.findIndex(c => c.id === id); if (idx >= 0) mockCampaigns.splice(idx, 1); return { success: true }; },
  },
  analytics: {
    getLatest: async () => { await delay(400); return computeAggregatedMetrics(); },
    getTimeSeries: async () => { await delay(600); return mockAnalytics; },
    getByCampaign: async (campaignId: string) => { await delay(300); return mockAnalytics.filter(a => a.campaignId === campaignId); },
  },
  assets: {
    list: async () => { await delay(400); return mockAssets; },
    upload: async (_file: File) => { await delay(1500); return { id: `ast-${Date.now()}`, name: _file.name, fileUrl: URL.createObjectURL(_file), fileType: _file.type.startsWith('video') ? 'video' : 'image', fileSize: _file.size, dimensions: { width: 1200, height: 1200 }, uploadedAt: new Date().toISOString(), validationStatus: 'valid' as const }; },
    delete: async (id: string) => { await delay(300); return { success: true, id }; },
  },
  rules: {
    list: async () => { await delay(300); return mockRules; },
    update: async (id: string, data: Partial<BudgetRule>) => { await delay(400); const idx = mockRules.findIndex(r => r.id === id); if (idx >= 0) { mockRules[idx] = { ...mockRules[idx], ...data }; return mockRules[idx]; } return null; },
  },
  publishCampaign: async (campaignData: any) => {
    await delay(2000);
    const results = {
      meta: { success: true, campaignId: `meta-${Date.now()}`, errors: null as string | null },
      google: { success: true, campaignId: `google-${Date.now()}`, errors: null as string | null },
    };
    if (campaignData.headline?.toLowerCase().includes('free')) {
      results.meta.errors = 'Meta Policy Violation: "Free" in headline requires pre-approval.';
      results.meta.success = false;
    }
    return results;
  },
};
