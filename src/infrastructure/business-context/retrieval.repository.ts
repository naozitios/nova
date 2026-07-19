import type { SupabaseClient } from '@supabase/supabase-js'
import type { RetrievalPort, RetrievedChunk } from '@/core/business-context/retrieval.port'
import type { ServiceResult } from '@/core/business-context/types'

export class RetrievalRepository implements RetrievalPort {
  constructor(private db: SupabaseClient) {}

  async hybridSearch(input: {
    workspaceId: string
    businessId: string
    query: string
    queryEmbedding: number[]
    limit: number
  }): Promise<ServiceResult<RetrievedChunk[]>> {
    const { data, error } = await this.db.rpc('hybrid_search_document_chunks', {
      query_text: input.query,
      query_embedding: input.queryEmbedding,
      match_workspace_id: input.workspaceId,
      match_business_id: input.businessId,
      match_count: input.limit,
    })

    if (error) {
      return { ok: false, error: { code: 'SEARCH_FAILED', message: error.message } }
    }

    const chunks: RetrievedChunk[] = (data || []).map((row: any) => ({
      id: row.id,
      sourceDocumentId: row.source_document_id,
      content: row.content,
      headingPath: row.heading_path || [],
      locator: row.locator || {},
      score: row.score || 0,
    }))

    return { ok: true, data: chunks }
  }
}
