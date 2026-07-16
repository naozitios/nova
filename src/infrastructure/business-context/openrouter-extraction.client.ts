import type { JsonValue } from '@/core/business-context/types'
import type { ExtractionSchema, LlmClient } from './llm-extraction.adapter'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export class OpenRouterExtractionClient implements LlmClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async complete(request: {
    schema: ExtractionSchema
    content: string
    systemPrompt: string
    temperature?: number
    maxTokens?: number
  }): Promise<JsonValue> {
    const response = await this.fetchImpl(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.content },
        ],
        temperature: request.temperature ?? 0.1,
        max_tokens: request.maxTokens ?? 4096,
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'business_context_extraction', schema: request.schema },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API ${response.status}: ${(await response.text()).slice(0, 200)}`)
    }

    const payload: unknown = await response.json()
    const content = getContent(payload)
    if (typeof content !== 'string') throw new Error('OpenRouter response missing completion content')
    return JSON.parse(content) as JsonValue
  }
}

function getContent(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return undefined
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return undefined
  const first = choices[0]
  if (!first || typeof first !== 'object') return undefined
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return undefined
  return (message as { content?: unknown }).content
}
