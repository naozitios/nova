import { NextRequest } from 'next/server'
import {
  requireAuthz,
  parseJsonBody,
  validateWithSchema,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { RetrievalRepository } from '@/infrastructure/business-context/retrieval.repository'
import { RetrievalService } from '@/core/business-context/service/retrieval.service'
import { OpenAIEmbeddingAdapter } from '@/infrastructure/business-context/openai-embedding.adapter'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { ContextPurpose } from '@/core/business-context/types'
import { z } from 'zod'

const searchBodySchema = z.object({
  query: z.string().min(1).max(2000),
  purpose: z.enum([
    ContextPurpose.CAMPAIGN_SETUP,
    ContextPurpose.PERFORMANCE_ANALYSIS,
    ContextPurpose.OPTIMIZATION,
    ContextPurpose.HYPOTHESIS_GENERATION,
    ContextPurpose.CREATIVE_BRIEF,
    ContextPurpose.TRACKING_AUDIT,
  ]),
  limit: z.number().int().min(1).max(20).optional().default(8),
})

async function resolveWorkspaceFromBusiness(
  businessId: string,
): Promise<{ workspaceId: string } | { error: Response }> {
  const client = getSupabaseServiceClient()
  const { data, error } = await client
    .from('businesses')
    .select('workspace_id')
    .eq('id', businessId)
    .single()

  if (error || !data) {
    return { error: errorResponse(404, 'NOT_FOUND', 'Business not found') }
  }
  return { workspaceId: data.workspace_id as string }
}

// POST /api/businesses/{id}/context/search — hybrid retrieval
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const bodyResult = await parseJsonBody(req)
  if (!bodyResult.ok) return bodyResult.response

  const validated = validateWithSchema(searchBodySchema, bodyResult.data)
  if (!validated.ok) return validated.response

  const db = getSupabaseServiceClient()
  const repo = new SupabaseRepository(db)
  const retrievalRepo = new RetrievalRepository(db)
  const metaRepo = new SupabaseMetaRepository(db)
  
  const apiKey = process.env.EMBEDDING_API_KEY
  if (!apiKey) {
    return errorResponse(500, 'CONFIG_ERROR', 'EMBEDDING_API_KEY not configured')
  }
  const embeddingAdapter = new OpenAIEmbeddingAdapter({ apiKey })

  const service = new RetrievalService(repo, retrievalRepo, embeddingAdapter, metaRepo)

  const result = await service.retrieveBusinessContext({
    workspaceId: wsResult.workspaceId,
    businessId,
    query: validated.data.query,
    limit: validated.data.limit,
  })

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  return jsonResponse(result.data, 200)
}
