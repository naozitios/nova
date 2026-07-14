import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse } from '../../../_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

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

// GET /api/businesses/{id}/context/processing-runs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  // Optional sourceId filter from query params
  const sourceId = req.nextUrl.searchParams.get('sourceId') ?? undefined

  const result = await repo.listProcessingRuns(
    {
      workspaceId: wsResult.workspaceId,
      businessId,
      sourceId,
    },
    { limit: 50, offset: 0 },
    { field: 'startedAt', direction: 'desc' },
  )

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  // Serialize to API shape
  const runs = result.data.items.map((run) => ({
    id: run.id,
    business_id: run.businessId,
    source_id: run.sourceId,
    job_id: run.jobId,
    pipeline_type: run.pipelineType,
    status: run.status,
    current_stage: run.currentStage,
    terminal_outcome: run.terminalOutcome,
    attempt_count: run.attemptCount,
    pages_processed: run.pagesProcessed,
    slides_processed: run.slidesProcessed,
    documents_created: run.documentsCreated,
    facts_extracted: run.factsExtracted,
    warnings_count: run.warningsCount,
    credits_consumed: run.creditsConsumed,
    quality_summary: run.qualitySummary,
    started_at: run.startedAt.toISOString(),
    completed_at: run.completedAt?.toISOString() ?? null,
  }))

  return jsonResponse({ runs })
}
