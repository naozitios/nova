import type { CampaignConfig, AdSetConfig } from '@/core/campaign/types';
import type { MetaCampaignSummaryDTO, MetaInsightSummaryDTO, MetaCreativeSummaryDTO } from '@/core/optimization/meta-client.port';
import type { MetaCampaignInput, MetaCreativeDTO } from './types';

export class MetaMapper {
  toCampaignConfig(dto: MetaCampaignSummaryDTO, insights?: MetaInsightSummaryDTO[], creatives?: MetaCreativeSummaryDTO[]): CampaignConfig {
    const budget = dto.lifetimeBudget
      ? parseInt(dto.lifetimeBudget) / 100
      : dto.dailyBudget
        ? (parseInt(dto.dailyBudget) / 100) * 30
        : 0;

    const adSet: AdSetConfig = {
      name: `${dto.name} - Ad Set`,
      targeting: {
        countries: [],
        ageRange: [18, 65],
        languages: ['en'],
      },
      bidAmount: Math.round(budget * 0.003),
      creatives: (creatives || []).map(c => ({
        headline: c.title || dto.name,
        bodyText: c.body || '',
        destinationUrl: c.objectUrl || '',
        mediaUrl: c.imageUrl || '',
        mediaType: 'image' as const,
      })),
    };

    if (!creatives?.length) {
      adSet.creatives = [{
        headline: dto.name,
        bodyText: '',
        destinationUrl: '',
        mediaUrl: '',
        mediaType: 'image',
      }];
    }

    return {
      name: dto.name,
      platform: ['meta'],
      objective: this.mapObjective(dto.objective),
      totalBudget: budget,
      startDate: dto.startTime?.split('T')[0] || '',
      endDate: dto.stopTime?.split('T')[0] || '',
      adSets: [adSet],
    };
  }

  toCampaignInput(config: CampaignConfig, status: 'ACTIVE' | 'PAUSED'): MetaCampaignInput {
    return {
      name: config.name,
      objective: this.mapObjectiveReverse(config.objective),
      status,
      lifetimeBudget: config.totalBudget * 100,
      startTime: config.startDate + 'T00:00:00Z',
      stopTime: config.endDate + 'T23:59:59Z',
    };
  }

  private mapObjective(objective: string): CampaignConfig['objective'] {
    switch (objective) {
      case 'CONVERSIONS': return 'CONVERSIONS';
      case 'BRAND_AWARENESS': return 'BRAND_AWARENESS';
      case 'TRAFFIC': return 'TRAFFIC';
      case 'RETENTION': return 'RETENTION';
      default: return 'CONVERSIONS';
    }
  }

  private mapObjectiveReverse(objective: string): string {
    switch (objective) {
      case 'CONVERSIONS': return 'CONVERSIONS';
      case 'BRAND_AWARENESS': return 'BRAND_AWARENESS';
      case 'TRAFFIC': return 'TRAFFIC';
      case 'RETENTION': return 'RETENTION';
      default: return 'CONVERSIONS';
    }
  }

  insightsToMetrics(insights: MetaInsightSummaryDTO[]) {
    const totals = insights.reduce((acc, i) => ({
      impressions: acc.impressions + i.impressions,
      clicks: acc.clicks + i.clicks,
      spend: acc.spend + i.spend,
      conversions: acc.conversions + i.conversions,
      conversionValue: acc.conversionValue + i.conversionValue,
    }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0 });

    return {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
      costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
      roas: totals.spend > 0 ? totals.conversionValue / totals.spend : 0,
    };
  }
}
