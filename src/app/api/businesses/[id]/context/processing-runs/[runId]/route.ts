import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, notFound, jsonResponse } from '../../../../_shared'
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

// GET /api/businesses/{id}/context/processing-runs/{runId}
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  const { id: businessId, runId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  // Fetch run
  const runResult = await repo.getProcessingRun(wsResult.workspaceId, runId)
  if (!runResult.ok) {
    return errorResponse(500, runResult.error.code, runResult.error.message)
  }
  if (!runResult.data) {
    return notFound('Processing run not found')
  }

  // Fetch stage events for this run
  const eventsResult = await repo.listStageEvents(
    {
      workspaceId: wsResult.workspaceId,
      businessId,
      runId,
    },
    { limit: 200, offset: 0 },
  )
  if (!eventsResult.ok) {
    return errorResponse(500, eventsResult.error.code, eventsResult.error.message)
  }

  // Fetch quality gate results for this run
  const gatesResult = await repo.listQualityGateResults(
    {
      workspaceId: wsResult.workspaceId,
      businessId,
      runId,
    },
    { limit: 100, offset: 0 },
  )
  if (!gatesResult.ok) {
    return errorResponse(500, gatesResult.error.code, gatesResult.error.message)
  }

  const run = runResult.data

  // Serialize run
  const serializedRun = {
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
    stage_events: eventsResult.data.items.map((e) => ({
      id: e.id,
      run_id: e.runId,
      job_id: e.jobId,
      source_id: e.sourceId,
      stage: e.stage,
      status: e.status,
      attempt: e.attempt,
      worker_id: e.workerId,
      provider: e.provider,
      provider_request_id: e.providerRequestId,
      started_at: e.startedAt.toISOString(),
      completed_at: e.completedAt?.toISOString() ?? null,
      duration_ms: e.durationMs,
      pages_processed: e.pagesProcessed,
      slides_processed: e.slidesProcessed,
      bytes_processed: e.bytesProcessed,
      documents_created: e.documentsCreated,
      facts_extracted: e.factsExtracted,
      warnings_count: e.warningsCount,
      credits_consumed: e.creditsConsumed,
      error_class: e.errorClass,
      error: e.error,
      metadata: e.metadata,
    })),
    quality_gates: gatesResult.data.items.map((g) => ({
      id: g.id,
      gate_scope: g.gateScope,
      gate_name: g.gateName,
      status: g.status,
      measured_value: g.measuredValue,
      threshold: g.threshold,
      reason: g.reason,
      created_at: g.createdAt.toISOString(),
    })),
  }

  return jsonResponse(serializedRun)
}
