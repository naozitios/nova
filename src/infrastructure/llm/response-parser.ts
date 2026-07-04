import type { LLMResponse } from '@/core/ai/llm-client.port';

/** Response parser — transforms raw LLM JSON output into structured LLMResponse objects, with sanitization and validation. */
/** Parses raw LLM output into a structured LLMResponse, handling markdown fences and validation. */
export class ResponseParser {
  /** Parses a raw LLM JSON string into an LLMResponse, falling back to a plain message on error. */
  parse(raw: string): LLMResponse {
    const cleaned = this.sanitize(raw);

    try {
      const parsed = JSON.parse(cleaned);

      if (!parsed.message || !Array.isArray(parsed.actions)) {
        throw new Error('Invalid response structure');
      }

      return {
        message: parsed.message,
        actions: parsed.actions.map((a: Record<string, unknown>) => ({
          id: String(a.id || `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
          type: this.validateActionType(String(a.type || '')),
          campaignId: a.campaignId ? String(a.campaignId) : undefined,
          campaignName: String(a.campaignName || ''),
          details: String(a.details || ''),
          previews: Array.isArray(a.previews) ? a.previews.map((p: Record<string, unknown>) => ({
            field: String(p.field || ''),
            before: String(p.before || ''),
            after: String(p.after || ''),
            type: (p.type as 'modify' | 'add' | 'remove') || 'modify',
          })) : [],
          params: (a.params as Record<string, unknown>) || {},
        })),
        requiresConfirmation: parsed.requiresConfirmation !== false,
      };
    } catch {
      return {
        message: cleaned,
        actions: [],
        requiresConfirmation: false,
      };
    }
  }

  /** Strips markdown code-fence wrappers from LLM output to extract raw JSON. */
  private sanitize(text: string): string {
    let cleaned = text.trim();

    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n');
      if (lines[0].includes('json')) lines.shift();
      else lines.shift();
      if (lines[lines.length - 1]?.startsWith('```')) lines.pop();
      cleaned = lines.join('\n').trim();
    }

    return cleaned;
  }

  /** Validates that an action type is one of the known types, defaulting to 'adjust_budget'. */
  private validateActionType(type: string): LLMResponse['actions'][0]['type'] {
    const valid = ['create_campaign', 'update_campaign', 'duplicate_campaign', 'pause_campaign', 'resume_campaign', 'adjust_budget'];
    if (valid.includes(type)) return type as LLMResponse['actions'][0]['type'];
    return 'adjust_budget';
  }
}
