import type { RetrievalPort, RetrievedChunk } from '../retrieval.port'
import type { EmbeddingPort } from '../embedding.port'
import type { RepositoryPort } from '../repository.port'
import type { MetaRepositoryPort } from '@/core/meta-data/repository.port'
import type { ServiceResult } from '../types'

export interface RetrievedBusinessContext {
  profile: Record<string, any> | null
  facts: Array<Record<string, any>>
  evidenceChunks: RetrievedChunk[]
  metaMetrics: Record<string, any>
}

export class RetrievalService {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly retrievalPort: RetrievalPort,
    private readonly embeddingPort: EmbeddingPort,
    private readonly metaRepo: MetaRepositoryPort
  ) {}

  async retrieveBusinessContext(input: {
    workspaceId: string
    businessId: string
    query: string
    limit?: number
  }): Promise<ServiceResult<RetrievedBusinessContext>> {
    const limit = input.limit ?? 8

    // 1. Embed query
    const embedResult = await this.embeddingPort.embed([input.query])
    if (!embedResult.ok) return embedResult
    const queryEmbedding = embedResult.data[0]

    // 2. Hybrid search chunks
    const searchResult = await this.retrievalPort.hybridSearch({
      workspaceId: input.workspaceId,
      businessId: input.businessId,
      query: input.query,
      queryEmbedding,
      limit,
    })
    if (!searchResult.ok) return searchResult

    // 3. Load current profile version
    const profileResult = await this.repo.getCurrentProfileVersion(
      input.workspaceId,
      input.businessId
    )
    const profile = profileResult.ok ? profileResult.data?.profile ?? null : null

    // 4. Load active facts
    const factsResult = await this.repo.listContextFacts({
      workspaceId: input.workspaceId,
      businessId: input.businessId,
      active: true,
    })
    const facts = factsResult.ok ? factsResult.data.items : []

    // 5. Load Meta metrics (ad accounts, daily insights)
    const adAccountsResult = await this.metaRepo.listAdAccounts(input.workspaceId)
    const adAccounts = adAccountsResult.ok ? adAccountsResult.data : []

    const metaMetrics = {
      adAccounts,
    }

    return {
      ok: true,
      data: {
        profile,
        facts,
        evidenceChunks: searchResult.data,
        metaMetrics,
      },
    }
  }
}
