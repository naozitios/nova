import { CampaignService } from '@/core/campaign/service';
import { LlmClientPort } from './llm-client.port';
import type { AIActionItem, AIResponse, ChangePreview } from './types';

/** AI service — processes user prompts via LLM or rule-based fallback, and applies proposed campaign actions. */
/** Core AI service that processes user prompts via LLM or fallback logic, and applies resulting actions. */
export class AIService {
  private lastResponse = '';

  constructor(
    private campaignService: CampaignService,
    private llmClient?: LlmClientPort
  ) {}

  /** Returns the message text from the most recent LLM response. */
  getLastResponse(): string {
    return this.lastResponse;
  }

  /** Processes a user prompt through the LLM or fallback logic and returns the AI response with actions. */
  async processPrompt(prompt: string): Promise<AIResponse> {
    if (this.llmClient) {
      const campaigns = await this.campaignService.list();
      const campaignContext = campaigns.map(e => ({
        id: e.id,
        name: e.config.name,
        platform: e.config.platform,
        objective: e.config.objective,
        budget: e.config.totalBudget,
        countries: e.config.adSets[0]?.targeting.countries,
        ageRange: e.config.adSets[0]?.targeting.ageRange,
        status: 'active',
      }));

      const systemPrompt = `You are a campaign management AI. You have access to these campaigns:
${JSON.stringify(campaignContext, null, 2)}

You can perform these actions: adjust_budget, duplicate_campaign, pause_campaign, resume_campaign, create_campaign.

Always respond with a JSON object containing:
- message: a human-readable explanation
- actions: an array of action objects with { id, type, campaignId, campaignName, details, previews: [{ field, before, after, type }], params }
- requiresConfirmation: true if actions need user approval

If you cannot fulfill the request, set actions to an empty array and requiresConfirmation to false.`;

      const response = await this.llmClient.chat(systemPrompt, prompt);
      this.lastResponse = response.message;
      return response;
    }

    return this.fallbackProcessPrompt(prompt);
  }

  private async fallbackProcessPrompt(prompt: string): Promise<AIResponse> {
    const lower = prompt.toLowerCase().trim();

    const increaseMatch = lower.match(/(?:increase|raise|bump)\s+.*?budgets?\s+.*?(\d+)\s*%/);
    if (increaseMatch) {
      return this.handleBudgetIncrease(increaseMatch, lower);
    }

    if (lower.includes('duplicate') || lower.includes('clone') || lower.includes('copy')) {
      return this.handleDuplicate(lower);
    }

    if (lower.includes('pause') || lower.includes('stop') || lower.includes('halt')) {
      return this.handlePause();
    }

    if (lower.includes('lookalike') || (lower.includes('create') && lower.includes('audience'))) {
      return this.handleLookalike();
    }

    return {
      message: `I understand you want to manage your campaigns, but I need a more specific instruction. Try something like:

• "Increase budgets for all Singapore campaigns by 15%"
• "Duplicate this campaign for Australia"
• "Pause campaigns spending below target ROAS"
• "Create a lookalike audience from my best-performing campaign"`,
      actions: [],
      requiresConfirmation: false,
    };
  }

  private async getAllCampaigns() {
    return this.campaignService.list();
  }

  private async findCampaignsByCountry(country: string) {
    const lower = country.toLowerCase();
    const all = await this.getAllCampaigns();
    return all.filter(e => {
      const countries = e.config.adSets[0]?.targeting.countries || [];
      return countries.some(c => c.toLowerCase() === lower);
    });
  }

  private async findBestPerformingCampaign() {
    const entries = await this.getAllCampaigns();
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.config.totalBudget - a.config.totalBudget)[0];
  }

  private async findLowRoasCampaigns() {
    const entries = await this.getAllCampaigns();
    if (entries.length === 0) return [];
    const avgBudget = entries.reduce((a, e) => a + e.config.totalBudget, 0) / entries.length;
    return entries.filter(e => e.config.totalBudget < avgBudget * 0.4);
  }

  private generateId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }

  private async handleBudgetIncrease(match: RegExpMatchArray, lower: string): Promise<AIResponse> {
    const pct = parseInt(match[1]);
    let countryFilter = '';
    const countryMatch = lower.match(/(?:for|in|targeting)\s+(\w+)/);
    if (countryMatch) countryFilter = countryMatch[1];

    const targets = countryFilter
      ? await this.findCampaignsByCountry(countryFilter)
      : await this.getAllCampaigns();

    if (targets.length === 0) {
      return {
        message: `I couldn't find any campaigns${countryFilter ? ` targeting ${countryFilter}` : ''} to adjust.`,
        actions: [],
        requiresConfirmation: false,
      };
    }

    const actions: AIActionItem[] = targets.map(entry => {
      const currentBudget = entry.config.totalBudget;
      const increase = Math.round(currentBudget * pct / 100);
      const previews: ChangePreview[] = [{
        field: 'Budget',
        before: `$${currentBudget.toLocaleString()}`,
        after: `$${(currentBudget + increase).toLocaleString()}`,
        type: 'modify',
      }];
      return {
        id: this.generateId(),
        type: 'adjust_budget',
        campaignId: entry.id,
        campaignName: entry.config.name,
        details: `Increase budget by ${pct}% ($${currentBudget.toLocaleString()} → $${(currentBudget + increase).toLocaleString()})`,
        previews,
        params: { newBudget: currentBudget + increase, budgetIncrease: pct / 100 },
      };
    });

    this.lastResponse = `I'll increase budgets by ${pct}% for ${actions.length} campaign${actions.length > 1 ? 's' : ''}${countryFilter ? ` targeting ${countryFilter}` : ''}.`;
    return {
      message: this.lastResponse,
      actions,
      requiresConfirmation: true,
    };
  }

  private async handleDuplicate(lower: string): Promise<AIResponse> {
    const countryMatch = lower.match(/for\s+(\w+)/);
    const targetCountry = countryMatch ? countryMatch[1].toUpperCase() : '';

    const entries = await this.getAllCampaigns();
    if (entries.length === 0) {
      return { message: "No campaigns found to duplicate.", actions: [], requiresConfirmation: false };
    }

    const source = entries[0];
    const campaignName = `${source.config.name}${targetCountry ? ` - ${targetCountry}` : ' (Copy)'}`;
    const sourceAdSet = source.config.adSets[0];

    const previews: ChangePreview[] = [
      { field: 'Campaign Name', before: '', after: campaignName, type: 'add' },
      { field: 'Platforms', before: '', after: source.config.platform.join(', '), type: 'add' },
      { field: 'Objective', before: '', after: source.config.objective.replace(/_/g, ' ').toLowerCase(), type: 'add' },
      { field: 'Budget', before: '', after: `$${source.config.totalBudget.toLocaleString()}`, type: 'add' },
      { field: 'Start Date', before: '', after: source.config.startDate, type: 'add' },
      { field: 'End Date', before: '', after: source.config.endDate, type: 'add' },
      { field: 'Countries', before: '', after: (targetCountry || sourceAdSet?.targeting.countries.join(', ') || ''), type: 'add' },
      { field: 'Age Range', before: '', after: sourceAdSet ? `${sourceAdSet.targeting.ageRange[0]}-${sourceAdSet.targeting.ageRange[1]}` : '', type: 'add' },
    ];

    return {
      message: `I'll duplicate "${source.config.name}"${targetCountry ? ` for ${targetCountry}` : ''} as "${campaignName}". Here's the new campaign:`,
      actions: [{
        id: this.generateId(),
        type: 'duplicate_campaign',
        campaignId: source.id,
        campaignName: source.config.name,
        details: `Create new campaign "${campaignName}"${targetCountry ? ` targeting ${targetCountry}` : ''}`,
        previews,
        params: {
          sourceCampaignId: source.id,
          newName: campaignName,
          countries: targetCountry ? [targetCountry] : source.config.adSets[0]?.targeting.countries || [],
        },
      }],
      requiresConfirmation: true,
    };
  }

  private async handlePause(): Promise<AIResponse> {
    const lowRoas = await this.findLowRoasCampaigns();
    if (lowRoas.length === 0) {
      return { message: "All campaigns are performing well. No campaigns need to be paused.", actions: [], requiresConfirmation: false };
    }

    const today = new Date().toISOString().split('T')[0];
    const actions: AIActionItem[] = lowRoas.map(entry => {
      const previews: ChangePreview[] = [
        { field: 'Status', before: 'Active', after: 'Paused', type: 'modify' },
        { field: 'End Date', before: entry.config.endDate, after: today, type: 'modify' },
      ];
      return {
        id: this.generateId(),
        type: 'pause_campaign',
        campaignId: entry.id,
        campaignName: entry.config.name,
        details: `Pause "${entry.config.name}" (budget: $${entry.config.totalBudget.toLocaleString()})`,
        previews,
        params: {},
      };
    });

    return {
      message: `I found ${actions.length} campaign${actions.length > 1 ? 's' : ''} spending below target ROAS. Here's what I recommend pausing:`,
      actions,
      requiresConfirmation: true,
    };
  }

  private async handleLookalike(): Promise<AIResponse> {
    const best = await this.findBestPerformingCampaign();
    if (!best) {
      return { message: "No campaigns available to create a lookalike from.", actions: [], requiresConfirmation: false };
    }

    const bestAdSet = best.config.adSets[0];
    const newBudget = Math.round(best.config.totalBudget * 0.7);
    const previews: ChangePreview[] = [
      { field: 'Campaign Name', before: '', after: `Lookalike - ${best.config.name}`, type: 'add' },
      { field: 'Source', before: '', after: best.config.name, type: 'add' },
      { field: 'Platforms', before: '', after: best.config.platform.join(', '), type: 'add' },
      { field: 'Budget', before: '', after: `$${newBudget.toLocaleString()} (70% of original)`, type: 'add' },
      { field: 'Objective', before: '', after: best.config.objective.replace(/_/g, ' ').toLowerCase(), type: 'add' },
      { field: 'Countries', before: '', after: bestAdSet?.targeting.countries.join(', ') || '', type: 'add' },
      { field: 'Age Range', before: '', after: bestAdSet ? `${bestAdSet.targeting.ageRange[0]}-${bestAdSet.targeting.ageRange[1]}` : '', type: 'add' },
    ];

    return {
      message: `I'll create a lookalike audience based on "${best.config.name}" — your best-performing campaign. Here's the proposed campaign:`,
      actions: [{
        id: this.generateId(),
        type: 'create_campaign',
        campaignName: best.config.name,
        details: `Create lookalike campaign based on "${best.config.name}"`,
        previews,
        params: { sourceCampaignId: best.id, type: 'lookalike' },
      }],
      requiresConfirmation: true,
    };
  }

  /** Executes a single AI action (budget adjust, duplicate, pause, create) and returns the result. */
  async applyAction(action: AIActionItem): Promise<{ success: boolean; message: string }> {
    switch (action.type) {
      case 'adjust_budget': {
        if (!action.campaignId) return { success: false, message: 'No campaign specified.' };
        const entry = await this.campaignService.get(action.campaignId);
        if (!entry) return { success: false, message: 'Campaign not found.' };

        const newBudget = action.params.newBudget as number;
        await this.campaignService.update(action.campaignId, { totalBudget: newBudget.toString() }, 'AI Assistant', 'AI: Budget adjustment');
        return { success: true, message: `Budget updated to $${newBudget.toLocaleString()}.` };
      }

      case 'duplicate_campaign': {
        if (!action.campaignId) return { success: false, message: 'No source campaign specified.' };
        const entry = await this.campaignService.get(action.campaignId);
        if (!entry) return { success: false, message: 'Source campaign not found.' };

        const formInput = {
          name: (action.params.newName as string) || `${entry.config.name} (Copy)`,
          platform: [...entry.config.platform],
          objective: entry.config.objective,
          totalBudget: entry.config.totalBudget.toString(),
          startDate: entry.config.startDate,
          endDate: entry.config.endDate,
          countries: ((action.params.countries as string[]) || entry.config.adSets[0]?.targeting.countries || []).join(', '),
          ageMin: (entry.config.adSets[0]?.targeting.ageRange[0] || 18).toString(),
          ageMax: (entry.config.adSets[0]?.targeting.ageRange[1] || 65).toString(),
          languages: (entry.config.adSets[0]?.targeting.languages || []).join(', '),
          headline: entry.config.adSets[0]?.creatives[0]?.headline || '',
          bodyText: entry.config.adSets[0]?.creatives[0]?.bodyText || '',
          destinationUrl: entry.config.adSets[0]?.creatives[0]?.destinationUrl || '',
          mediaUrl: entry.config.adSets[0]?.creatives[0]?.mediaUrl || '',
        };

        await this.campaignService.create(formInput, 'AI Assistant');
        return { success: true, message: `Campaign "${formInput.name}" created.` };
      }

      case 'pause_campaign': {
        if (!action.campaignId) return { success: false, message: 'No campaign specified.' };
        await this.campaignService.update(action.campaignId, { endDate: new Date().toISOString().split('T')[0] }, 'AI Assistant', 'AI: Pause campaign');
        return { success: true, message: `Campaign "${action.campaignName}" paused.` };
      }

      case 'create_campaign': {
        const sourceId = action.params.sourceCampaignId as string;
        if (!sourceId) return { success: false, message: 'No source campaign specified.' };
        const source = await this.campaignService.get(sourceId);
        if (!source) return { success: false, message: 'Source campaign not found.' };

        const formInput = {
          name: `Lookalike - ${source.config.name}`,
          platform: [...source.config.platform],
          objective: source.config.objective,
          totalBudget: Math.round(source.config.totalBudget * 0.7).toString(),
          startDate: source.config.startDate,
          endDate: source.config.endDate,
          countries: (source.config.adSets[0]?.targeting.countries || []).join(', '),
          ageMin: (source.config.adSets[0]?.targeting.ageRange[0] || 18).toString(),
          ageMax: (source.config.adSets[0]?.targeting.ageRange[1] || 65).toString(),
          languages: (source.config.adSets[0]?.targeting.languages || []).join(', '),
          headline: source.config.adSets[0]?.creatives[0]?.headline || '',
          bodyText: source.config.adSets[0]?.creatives[0]?.bodyText || '',
          destinationUrl: source.config.adSets[0]?.creatives[0]?.destinationUrl || '',
          mediaUrl: source.config.adSets[0]?.creatives[0]?.mediaUrl || '',
        };

        await this.campaignService.create(formInput, 'AI Assistant');
        return { success: true, message: `Lookalike campaign "${formInput.name}" created.` };
      }

      default:
        return { success: false, message: `Unknown action type: ${action.type}.` };
    }
  }

  /** Applies multiple actions concurrently and returns an array of per-action results. */
  async applyAllActions(actions: AIActionItem[]): Promise<Array<{ id: string; success: boolean; message: string }>> {
    const results = await Promise.all(actions.map(action => this.applyAction(action)));
    return actions.map((action, i) => ({ id: action.id, ...results[i] }));
  }
}
