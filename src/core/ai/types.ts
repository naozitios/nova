/** Core AI domain types — ChangePreview, AIActionItem, and AIResponse used throughout the AI pipeline. */
/** Describes a before/after change for a single field in a campaign, shown to the user for confirmation. */
export interface ChangePreview {
  field: string;
  before: string;
  after: string;
  type: 'modify' | 'add' | 'remove';
}

/** Represents a single action the AI proposes to perform on a campaign (budget change, duplicate, pause, etc.). */
export interface AIActionItem {
  id: string;
  type: 'create_campaign' | 'update_campaign' | 'duplicate_campaign' | 'pause_campaign' | 'resume_campaign' | 'adjust_budget';
  campaignId?: string;
  campaignName: string;
  details: string;
  previews: ChangePreview[];
  params: Record<string, unknown>;
  /** Optional reference to the business context profile version used for this action. */
  business_context_version_id?: string;
}

/** The complete response from the AI service, including the message, proposed actions, and confirmation flag. */
export interface AIResponse {
  message: string;
  actions: AIActionItem[];
  requiresConfirmation: boolean;
  /** Optional reference to the business context profile version used to compile the AI's context. */
  business_context_version_id?: string;
}
