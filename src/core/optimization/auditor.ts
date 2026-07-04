import type { AccountIssue, HealthSummary } from './types';
import type { MetaInsightSummaryDTO, MetaCampaignSummaryDTO } from './meta-client.port';

export interface AuditCheckInput {
  campaigns: MetaCampaignSummaryDTO[];
  insights: MetaInsightSummaryDTO[];
}

export class Auditor {
  runChecks(input: AuditCheckInput): HealthSummary {
    const issues: AccountIssue[] = [];

    issues.push(...this.checkTracking(input));
    issues.push(...this.checkAttribution(input));
    issues.push(...this.checkUTM(input));
    issues.push(...this.checkNaming(input));

    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const totalChecks = 48;
    const passedCount = totalChecks - issues.length;
    const score = this.calculateScore(criticalCount, warningCount, passedCount, totalChecks);

    return { score, criticalCount, warningCount, passedCount, issues };
  }

  private calculateScore(critical: number, warning: number, passed: number, total: number): number {
    const criticalPenalty = critical * 15;
    const warningPenalty = warning * 5;
    const baseScore = (passed / total) * 100;
    return Math.max(0, Math.min(100, Math.round(baseScore - criticalPenalty - warningPenalty)));
  }

  private checkTracking(input: AuditCheckInput): AccountIssue[] {
    const issues: AccountIssue[] = [];
    const activeCampaigns = input.campaigns.filter(c => c.status === 'ACTIVE');

    if (activeCampaigns.length > 0) {
      const totalConversions = input.insights.reduce((sum, i) => sum + i.conversions, 0);
      if (totalConversions === 0) {
        issues.push({
          id: `tracking-${Date.now()}-1`,
          severity: 'critical',
          category: 'tracking',
          finding: 'No conversions detected across active campaigns',
          evidence: `Zero conversions from ${activeCampaigns.length} active campaigns`,
          recommendation: 'Verify Meta Pixel and Conversion API are configured correctly',
          status: 'open',
        });
      }

      const zeroConversionCampaigns = activeCampaigns.filter(c => {
        const campaignInsights = input.insights.filter(i => i.campaignId === c.id);
        return campaignInsights.length > 0 && campaignInsights.every(i => i.conversions === 0);
      });

      if (zeroConversionCampaigns.length > 0) {
        issues.push({
          id: `tracking-${Date.now()}-2`,
          severity: 'warning',
          category: 'tracking',
          finding: `${zeroConversionCampaigns.length} campaign(s) have zero conversions`,
          evidence: `Campaigns: ${zeroConversionCampaigns.map(c => c.name).join(', ')}`,
          recommendation: 'Check event tracking setup for these campaigns',
          status: 'open',
        });
      }
    }

    return issues;
  }

  private checkAttribution(_input: AuditCheckInput): AccountIssue[] {
    const issues: AccountIssue[] = [];

    issues.push({
      id: `attr-${Date.now()}-1`,
      severity: 'info',
      category: 'attribution',
      finding: 'Attribution settings should be reviewed',
      evidence: 'Default attribution window is 7-day click',
      recommendation: 'Consider if 7-day click / 1-day view attribution matches your sales cycle',
      status: 'open',
    });

    return issues;
  }

  private checkUTM(input: AuditCheckInput): AccountIssue[] {
    const issues: AccountIssue[] = [];

    const noUtmCampaigns = input.campaigns.filter(c => !c.name.toLowerCase().includes('utm'));
    if (noUtmCampaigns.length === input.campaigns.length) {
      issues.push({
        id: `utm-${Date.now()}-1`,
        severity: 'warning',
        category: 'utm',
        finding: 'UTM parameters may not be configured',
        evidence: 'No UTM tracking detected in campaign configurations',
        recommendation: 'Implement consistent UTM parameter strategy across all campaigns',
        status: 'open',
      });
    }

    return issues;
  }

  private checkNaming(input: AuditCheckInput): AccountIssue[] {
    const issues: AccountIssue[] = [];
    const patterns = [
      { regex: /^[A-Z]/, label: 'start with capital letter' },
      { regex: /\d{4}/, label: 'include year' },
    ];

    for (const campaign of input.campaigns) {
      for (const pattern of patterns) {
        if (!pattern.regex.test(campaign.name)) {
          issues.push({
            id: `naming-${Date.now()}-${campaign.id}`,
            severity: 'info',
            category: 'naming',
            finding: `Campaign "${campaign.name}" does not ${pattern.label}`,
            evidence: `Campaign name: ${campaign.name}`,
            recommendation: `Update campaign name to ${pattern.label} for consistency`,
            status: 'open',
          });
          break;
        }
      }
    }

    return issues.slice(0, 3);
  }
}
