import { AIActionItem } from './types';

/** LLM client port — defines the contract for communicating with an LLM and the expected response shape. */
/** Structured response from an LLM containing a message, a list of actions, and a confirmation flag. */
export interface LLMResponse {
  message: string;
  actions: AIActionItem[];
  requiresConfirmation: boolean;
}

/** Port interface for LLM chat clients (e.g. Groq, OpenAI). */
export interface LlmClientPort {
  /** Sends a system prompt and user message, returning a structured LLMResponse. */
  chat(systemPrompt: string, userMessage: string): Promise<LLMResponse>;
}
