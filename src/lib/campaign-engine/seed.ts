import { campaignStore } from './store';
import { CampaignFormInput } from './generator';
import { CampaignConfig } from './types';

function configFromExisting(config: Partial<CampaignConfig>): CampaignFormInput {
  const adSet = config.adSets?.[0];
  return {
    name: config.name || '',
    platform: config.platform || [],
    objective: config.objective || 'CONVERSIONS',
    totalBudget: (config.totalBudget || 0).toString(),
    startDate: config.startDate || '',
    endDate: config.endDate || '',
    countries: adSet?.targeting.countries?.join(', ') || '',
    ageMin: (adSet?.targeting.ageRange?.[0] || 18).toString(),
    ageMax: (adSet?.targeting.ageRange?.[1] || 65).toString(),
    languages: adSet?.targeting.languages?.join(', ') || '',
    headline: adSet?.creatives?.[0]?.headline || '',
    bodyText: adSet?.creatives?.[0]?.bodyText || '',
    destinationUrl: adSet?.creatives?.[0]?.destinationUrl || '',
    mediaUrl: adSet?.creatives?.[0]?.mediaUrl || '',
  };
}

const seedCampaigns: Array<CampaignConfig & { id: string }> = [
  {
    id: 'cmp1',
    name: 'Summer Collection Launch',
    platform: ['meta'],
    objective: 'CONVERSIONS',
    totalBudget: 5000,
    startDate: '2026-06-01',
    endDate: '2026-07-15',
    adSets: [
      {
        name: 'Women 25-40',
        targeting: { countries: ['US', 'CA', 'UK'], ageRange: [25, 40], languages: ['en'] },
        bidAmount: 15,
        creatives: [
          {
            headline: 'Beat the heat in style',
            bodyText: 'Our summer collection is here. Shop now.',
            destinationUrl: 'https://example.com/summer',
            mediaUrl: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600',
            mediaType: 'image',
          },
        ],
      },
    ],
  },
  {
    id: 'cmp2',
    name: 'PMax - Evergreen',
    platform: ['google'],
    objective: 'CONVERSIONS',
    totalBudget: 8000,
    startDate: '2026-05-01',
    endDate: '2026-12-31',
    adSets: [
      {
        name: 'Performance Max',
        targeting: { countries: ['US', 'CA'], ageRange: [18, 65], languages: ['en'] },
        bidAmount: 20,
        creatives: [
          {
            headline: 'Premium Quality, Best Price',
            bodyText: 'Discover our range. Free shipping on orders over $50.',
            destinationUrl: 'https://example.com/shop',
            mediaUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600',
            mediaType: 'image',
          },
        ],
      },
    ],
  },
  {
    id: 'cmp3',
    name: 'Retargeting - Abandoned Cart',
    platform: ['meta'],
    objective: 'RETENTION',
    totalBudget: 2500,
    startDate: '2026-06-10',
    endDate: '2026-07-10',
    adSets: [
      {
        name: 'Cart Abandoners',
        targeting: { countries: ['US'], ageRange: [22, 55], languages: ['en'] },
        bidAmount: 12,
        creatives: [
          {
            headline: 'Still thinking it over?',
            bodyText: 'Get 10% off your abandoned cart. Limited time.',
            destinationUrl: 'https://example.com/cart',
            mediaUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600',
            mediaType: 'image',
          },
        ],
      },
    ],
  },
  {
    id: 'cmp4',
    name: 'Brand Awareness Q3',
    platform: ['google'],
    objective: 'BRAND_AWARENESS',
    totalBudget: 10000,
    startDate: '2026-07-01',
    endDate: '2026-09-30',
    adSets: [
      {
        name: 'Display Network',
        targeting: { countries: ['US', 'CA', 'UK', 'AU'], ageRange: [20, 60], languages: ['en', 'es'] },
        bidAmount: 8,
        creatives: [
          {
            headline: 'Your Brand, Everywhere',
            bodyText: 'Reach millions with our display network.',
            destinationUrl: 'https://example.com/brand',
            mediaUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600',
            mediaType: 'image',
          },
        ],
      },
    ],
  },
  {
    id: 'cmp5',
    name: 'Holiday Flash Sale',
    platform: ['meta'],
    objective: 'CONVERSIONS',
    totalBudget: 3000,
    startDate: '2026-06-15',
    endDate: '2026-06-30',
    adSets: [
      {
        name: 'Flash Sale - All',
        targeting: { countries: ['US'], ageRange: [18, 65], languages: ['en'] },
        bidAmount: 18,
        creatives: [
          {
            headline: '50% Off Everything!',
            bodyText: '24-hour flash sale. Don\'t miss out.',
            destinationUrl: 'https://example.com/sale',
            mediaUrl: 'https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=600',
            mediaType: 'image',
          },
        ],
      },
    ],
  },
];

let seeded = false;

export function ensureSeeded(): void {
  if (seeded) return;

  for (const existing of seedCampaigns) {
    const entry = campaignStore.get(existing.id);
    if (!entry) {
      const input = configFromExisting(existing);
      campaignStore.create(input, 'system');
    }
  }

  seeded = true;
}

export function getSeededCampaigns() {
  ensureSeeded();
  return campaignStore.list();
}
