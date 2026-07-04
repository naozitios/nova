/** Public AI library types — ChangePreview, AIActionItem, and AIResponse re-exported for external consumers. */
/** Describes a before/after change for a campaign field, shown to the user for confirmation. */
export interface ChangePreview {
  field: string;
  before: string;
  after: string;
  type: 'modify' | 'add' | 'remove';
}

/** A single action the AI proposes (budget change, duplicate, pause, create). */
export interface AIActionItem {
  id: string;
  type: 'create_campaign' | 'update_campaign' | 'duplicate_campaign' | 'pause_campaign' | 'resume_campaign' | 'adjust_budget';
  campaignId?: string;
  campaignName: string;
  details: string;
  previews: ChangePreview[];
  params: Record<string, unknown>;
}

/** The full AI service response including the message, actions, and confirmation flag. */
export interface AIResponse {
  message: string;
  actions: AIActionItem[];
  requiresConfirmation: boolean;
}
