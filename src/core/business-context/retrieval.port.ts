import type { ServiceResult } from './types'

export interface RetrievedChunk {
  id: string
  sourceDocumentId: string
  content: string
  headingPath: string[]
  locator: Record<string, any>
  score: number
}

export interface RetrievalPort {
  hybridSearch(input: {
    workspaceId: string
    businessId: string
    query: string
    queryEmbedding: number[]
    limit: number
  }): Promise<ServiceResult<RetrievedChunk[]>>
}
