import type { ServiceResult } from './types'

export interface EmbeddingPort {
  readonly model: string
  readonly dimensions: number
  embed(texts: string[]): Promise<ServiceResult<number[][]>>
}
