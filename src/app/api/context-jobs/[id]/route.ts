import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, notFound } from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'

// GET /api/context-jobs/{id}
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params
  const client = getSupabaseServiceClient()

  // Fetch job by ID to get workspaceId (URL has no workspace context)
  const { data: job, error } = await client
    .from('context_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    return notFound('Job not found')
  }

  const workspaceId = job.workspace_id as string
  const authz = await requireAuthz(_req, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  // Serialize job to API shape (snake_case → camelCase)
  const result = {
    id: job.id,
    workspace_id: job.workspace_id,
    business_id: job.business_id,
    session_id: job.session_id ?? null,
    job_type: job.job_type,
    status: job.status,
    attempt_count: Number(job.attempt_count),
    max_attempts: Number(job.max_attempts),
    idempotency_key: job.idempotency_key,
    stage: job.stage ?? null,
    input: job.input ?? {},
    output: job.output ?? null,
    error: job.error ?? null,
    error_class: job.error_class ?? null,
    next_run_at: job.next_run_at ?? null,
    heartbeat_at: job.heartbeat_at ?? null,
    created_at: job.created_at,
  }

  return Response.json(result)
}
