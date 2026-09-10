import { createHash } from 'node:crypto'

import type { EmbeddingPort } from '@/core/business-context/embedding.port'
import type { ServiceResult } from '@/core/business-context/types'

export class LocalEmbeddingAdapter implements EmbeddingPort {
  readonly model = 'local-deterministic'
  readonly dimensions = 1536

  async embed(texts: string[]): Promise<ServiceResult<number[][]>> {
    return {
      ok: true,
      data: texts.map((text) => this.embedOne(text)),
    }
  }

  private embedOne(text: string): number[] {
    const seed = createHash('sha256').update(text).digest()
    return Array.from({ length: this.dimensions }, (_, index) => {
      const byte = seed[index % seed.length]
      return (byte / 127.5) - 1
    })
  }
}
