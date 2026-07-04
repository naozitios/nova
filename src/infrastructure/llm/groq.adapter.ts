import Groq from 'groq-sdk';
import type { LlmClientPort, LLMResponse } from '@/core/ai/llm-client.port';
import { config } from '@/infrastructure/config';
import { PromptBuilder } from './prompt-builder';
import { ResponseParser } from './response-parser';

/** Groq LLM adapter — implements LlmClientPort by calling the Groq API with Nova's prompt/response pipeline. */
/** Adapter that implements LlmClientPort by calling the Groq API with Nova's prompt/response pipeline. */
export class GroqAdapter implements LlmClientPort {
  private client: Groq;
  private promptBuilder = new PromptBuilder();
  private responseParser = new ResponseParser();

  constructor() {
    this.client = new Groq({
      apiKey: config.groq.apiKey,
    });
  }

  /** Sends a system prompt and user message to Groq, returning a parsed LLMResponse. */
  async chat(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    try {
      const completion = await this.client.chat.completions.create({
        model: config.groq.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.1,
        max_tokens: config.groq.maxTokens,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content || '';
      return this.responseParser.parse(raw);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Groq API error';
      return {
        message: `I encountered an error processing your request: ${message}. Please try again.`,
        actions: [],
        requiresConfirmation: false,
      };
    }
  }
}
