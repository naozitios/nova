export interface ChangePreview {
  field: string;
  before: string;
  after: string;
  type: 'modify' | 'add' | 'remove';
}

export interface AIActionItem {
  id: string;
  type: 'create_campaign' | 'update_campaign' | 'duplicate_campaign' | 'pause_campaign' | 'resume_campaign' | 'adjust_budget';
  campaignId?: string;
  campaignName: string;
  details: string;
  previews: ChangePreview[];
  params: Record<string, unknown>;
}

export interface AIResponse {
  message: string;
  actions: AIActionItem[];
  requiresConfirmation: boolean;
}
