import type { OptimizationRecommendation, OpportunityType, ConfidenceLevel, RecommendationStatus } from './types';
import type { MetaInsightSummaryDTO, MetaCampaignSummaryDTO } from './meta-client.port';

export interface CopilotInput {
  campaigns: MetaCampaignSummaryDTO[];
  insights: MetaInsightSummaryDTO[];
}

export class Copilot {
  detectOpportunities(input: CopilotInput): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    recommendations.push(...this.detectCreativeFatigue(input));
    recommendations.push(...this.detectScalingOpportunities(input));
    recommendations.push(...this.detectBudgetWaste(input));
    recommendations.push(...this.detectPerformanceDecline(input));

    return recommendations.sort((a, b) => this.priorityWeight(b.type) - this.priorityWeight(a.type));
  }

  private priorityWeight(type: OpportunityType): number {
    switch (type) {
      case 'budget_waste': return 4;
      case 'performance_decline': return 3;
      case 'creative_fatigue': return 2;
      case 'scaling': return 1;
    }
  }

  private detectCreativeFatigue(input: CopilotInput): OptimizationRecommendation[] {
    const results: OptimizationRecommendation[] = [];

    for (const campaign of input.campaigns) {
      const campaignInsights = input.insights.filter(i => i.campaignId === campaign.id);
      if (campaignInsights.length < 2) continue;

      const sorted = campaignInsights.sort((a, b) => new Date(a.campaignId > b.campaignId ? 1 : -1).getTime());
      const latest = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];

      if (latest.frequency > 3 && latest.ctr < previous.ctr && latest.cpm > previous.cpm) {
        results.push({
          id: `fatigue-${Date.now()}-${campaign.id}`,
          type: 'creative_fatigue',
          campaignName: campaign.name,
          finding: `Creative fatigue detected for "${campaign.name}"`,
          evidence: `Frequency: ${latest.frequency.toFixed(1)}, CTR: ${latest.ctr.toFixed(2)}%, CPM: $${latest.cpm.toFixed(2)}`,
          likelyCause: 'Audience has seen the same creatives multiple times',
          recommendedAction: 'Refresh creatives and launch new ad variants',
          expectedImpact: 'Estimated CTR improvement of 15-30%',
          confidence: 'medium',
          status: 'new' as RecommendationStatus,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private detectScalingOpportunities(input: CopilotInput): OptimizationRecommendation[] {
    const results: OptimizationRecommendation[] = [];

    for (const campaign of input.campaigns) {
      const campaignInsights = input.insights.filter(i => i.campaignId === campaign.id);
      if (campaignInsights.length < 2) continue;

      const sorted = campaignInsights.sort((a, b) => a.campaignId.localeCompare(b.campaignId));
      const latest = sorted[sorted.length - 1];

      if (latest.roas > 2 && latest.costPerConversion < 20 && latest.conversions > 10) {
        results.push({
          id: `scale-${Date.now()}-${campaign.id}`,
          type: 'scaling',
          campaignName: campaign.name,
          finding: `Scaling opportunity for "${campaign.name}"`,
          evidence: `ROAS: ${latest.roas.toFixed(2)}x, Cost per conversion: $${latest.costPerConversion.toFixed(2)}, Conversions: ${latest.conversions}`,
          likelyCause: 'Campaign is performing above targets with consistent results',
          recommendedAction: 'Increase campaign budget by 20-30% to capture additional volume',
          expectedImpact: 'Estimated conversion increase of 15-25%',
          confidence: 'high',
          status: 'new' as RecommendationStatus,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private detectBudgetWaste(input: CopilotInput): OptimizationRecommendation[] {
    const results: OptimizationRecommendation[] = [];

    for (const campaign of input.campaigns) {
      const campaignInsights = input.insights.filter(i => i.campaignId === campaign.id);
      if (campaignInsights.length === 0) continue;

      const latest = campaignInsights[campaignInsights.length - 1];

      if (latest.spend > 100 && latest.conversions === 0) {
        results.push({
          id: `waste-${Date.now()}-${campaign.id}`,
          type: 'budget_waste',
          campaignName: campaign.name,
          finding: `Possible budget waste for "${campaign.name}"`,
          evidence: `Spend: $${latest.spend.toFixed(2)}, Conversions: ${latest.conversions}`,
          likelyCause: 'Campaign is spending without driving results',
          recommendedAction: 'Reduce budget or pause campaign until creative/targeting is optimized',
          expectedImpact: 'Estimated savings of $' + latest.spend.toFixed(0) + ' per period',
          confidence: 'high',
          status: 'new' as RecommendationStatus,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private detectPerformanceDecline(input: CopilotInput): OptimizationRecommendation[] {
    const results: OptimizationRecommendation[] = [];

    for (const campaign of input.campaigns) {
      const campaignInsights = input.insights.filter(i => i.campaignId === campaign.id);
      if (campaignInsights.length < 2) continue;

      const sorted = campaignInsights.sort((a, b) => a.campaignId.localeCompare(b.campaignId));
      const latest = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2];

      if (previous.costPerConversion > 0 && latest.costPerConversion > previous.costPerConversion * 1.3) {
        results.push({
          id: `decline-${Date.now()}-${campaign.id}`,
          type: 'performance_decline',
          campaignName: campaign.name,
          finding: `Performance decline for "${campaign.name}"`,
          evidence: `CPA increased from $${previous.costPerConversion.toFixed(2)} to $${latest.costPerConversion.toFixed(2)}`,
          likelyCause: 'Multiple possible factors: creative fatigue, audience saturation, or competitive changes',
          recommendedAction: 'Investigate creative, audience, landing page, and tracking for issues',
          expectedImpact: 'Potential CPA reduction of 20-30% if root cause is addressed',
          confidence: 'medium',
          status: 'new' as RecommendationStatus,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }
}
