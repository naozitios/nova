// ─── OpenAI-compatible embedding adapter ────────────────────────────────────
//
// Implements EmbeddingPort using native fetch against the OpenAI embeddings
// API (or any compatible endpoint). Batches at 64 texts per request.
// ─────────────────────────────────────────────────────────────────────────────

import type { EmbeddingPort } from '@/core/business-context/embedding.port'
import type { ServiceResult } from '@/core/business-context/types'

const BATCH_SIZE = 64

export interface OpenAIEmbeddingConfig {
  apiKey: string
  apiUrl?: string
  model?: string
  dimensions?: number
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>
}

export class OpenAIEmbeddingAdapter implements EmbeddingPort {
  readonly model: string
  readonly dimensions: number

  private readonly apiKey: string
  private readonly apiUrl: string

  constructor(config: OpenAIEmbeddingConfig) {
    this.apiKey = config.apiKey
    this.apiUrl = config.apiUrl ?? 'https://api.openai.com/v1'
    this.model = config.model ?? 'text-embedding-3-small'
    this.dimensions = config.dimensions ?? 1536
  }

  async embed(texts: string[]): Promise<ServiceResult<number[][]>> {
    if (texts.length === 0) {
      return { ok: true, data: [] }
    }

    const allEmbeddings: number[][] = new Array(texts.length)

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE)

      try {
        const response = await fetch(`${this.apiUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
          }),
        })

        if (!response.ok) {
          const text = await response.text().catch(() => 'Unknown error')
          return {
            ok: false,
            error: {
              code: 'EMBEDDING_FAILED',
              message: `Embedding request failed with status ${response.status}: ${text}`,
            },
          }
        }

        const body: EmbeddingResponse = await response.json()

        if (!Array.isArray(body.data)) {
          return {
            ok: false,
            error: {
              code: 'EMBEDDING_FAILED',
              message: 'Invalid response structure: missing data array',
            },
          }
        }

        // Preserve input order — API returns in same order as input
        for (let j = 0; j < batch.length; j++) {
          allEmbeddings[i + j] = body.data[j].embedding
        }
      } catch (err) {
        return {
          ok: false,
          error: {
            code: 'EMBEDDING_FAILED',
            message: err instanceof Error ? err.message : 'Network error',
          },
        }
      }
    }

    return { ok: true, data: allEmbeddings }
  }
}
