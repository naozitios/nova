import type { CampaignEntry } from '@/core/campaign/repository.port';

/** Prompt builder — constructs structured system prompts with campaign context and available actions for the LLM. */
/** Builds structured system prompts for the LLM, embedding campaign context and action definitions. */
export class PromptBuilder {
  /** Builds the full system prompt with campaign context and available actions. */
  build(campaigns: CampaignEntry[]): string {
    const campaignContext = campaigns.map(e => ({
      id: e.id,
      name: e.config.name,
      platform: e.config.platform,
      objective: e.config.objective,
      budget: e.config.totalBudget,
      countries: e.config.adSets[0]?.targeting.countries,
      ageRange: e.config.adSets[0]?.targeting.ageRange,
      startDate: e.config.startDate,
      endDate: e.config.endDate,
      status: 'active',
    }));

    return `You are a campaign management AI assistant for Nova. You help users manage their advertising campaigns.

Available actions:
- adjust_budget: Increase or decrease a campaign's budget
- duplicate_campaign: Duplicate an existing campaign for a new country or as a copy
- pause_campaign: Pause a campaign that is underperforming
- resume_campaign: Resume a paused campaign
- create_campaign: Create a new campaign (e.g. lookalike)

Current campaigns:
${JSON.stringify(campaignContext, null, 2)}

Rules:
1. Only use campaign IDs that exist in the list above
2. Budget amounts are in USD
3. Always provide previews showing before/after values
4. Set requiresConfirmation to true unless the request cannot be fulfilled
5. If you cannot fulfill the request, set actions to an empty array

Respond with a JSON object (no markdown, no code fences):
{
  "message": "Human-readable explanation of what will happen",
  "actions": [
    {
      "id": "unique-string-id",
      "type": "adjust_budget|duplicate_campaign|pause_campaign|resume_campaign|create_campaign",
      "campaignId": "existing-campaign-id",
      "campaignName": "campaign-name",
      "details": "Description of the action",
      "previews": [{ "field": "Budget", "before": "$1,000", "after": "$1,150", "type": "modify" }],
      "params": {}
    }
  ],
  "requiresConfirmation": true
}`;
  }

  /** Builds a prompt that asks the LLM to summarize an account health audit in plain English. */
  buildHealthCheck(healthSummary: unknown): string {
    return `Summarize the following account health audit results in plain English. Highlight the most critical issues first:

${JSON.stringify(healthSummary, null, 2)}

Respond with a JSON object:
{
  "message": "concise summary",
  "actions": [],
  "requiresConfirmation": false
}`;
  }
}
