import { Auditor } from './auditor';
import { Copilot } from './copilot';
import type { HealthSummary } from './types';
import type { OptimizationRecommendation } from './types';
import type { MetaInsightSummaryDTO, MetaCampaignSummaryDTO } from './meta-client.port';

export class HealthService {
  constructor(
    private auditor: Auditor = new Auditor(),
    private copilot: Copilot = new Copilot()
  ) {}

  runAudit(campaigns: MetaCampaignSummaryDTO[], insights: MetaInsightSummaryDTO[]): HealthSummary {
    return this.auditor.runChecks({ campaigns, insights });
  }

  generateRecommendations(campaigns: MetaCampaignSummaryDTO[], insights: MetaInsightSummaryDTO[]): OptimizationRecommendation[] {
    return this.copilot.detectOpportunities({ campaigns, insights });
  }
}
