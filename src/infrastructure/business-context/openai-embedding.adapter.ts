import type { EmbeddingPort } from '@/core/business-context/embedding.port'
import type { ServiceResult } from '@/core/business-context/types'

interface OpenAIEmbeddingConfig {
  apiKey: string
  model?: string
  dimensions?: number
  baseUrl?: string
}

export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  readonly model: string
  readonly dimensions: number
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(config: OpenAIEmbeddingConfig) {
    this.apiKey = config.apiKey
    this.model = config.model ?? 'text-embedding-3-small'
    this.dimensions = config.dimensions ?? 1536
    this.baseUrl = config.baseUrl ?? 'https://api.openai.com/v1'
  }

  async embed(texts: string[]): Promise<ServiceResult<number[][]>> {
    if (texts.length === 0) {
      return { ok: true, data: [] }
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dimensions,
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        return {
          ok: false,
          error: {
            code: 'EMBEDDING_FAILED',
            message: `OpenAI embedding request failed (${response.status}): ${body}`,
          },
        }
      }

      const data = await response.json() as {
        data: { embedding: number[]; index: number }[]
      }

      const sorted = data.data.sort((a, b) => a.index - b.index)
      const embeddings = sorted.map((d) => d.embedding)

      return { ok: true, data: embeddings }
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'EMBEDDING_FAILED',
          message: err instanceof Error ? err.message : 'Unknown embedding error',
        },
      }
    }
  }
}
