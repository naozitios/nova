import { NextRequest } from 'next/server'
import { withIdempotency, requireAuthz, errorResponse, notFound } from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'

const RETRYABLE_STATUSES = new Set([
  'failed_retryable',
  'stalled',
  'dead_lettered',
])

// POST /api/context-jobs/{id}/retry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: jobId } = await params
    const client = getSupabaseServiceClient()

    // Fetch job by ID to get workspaceId
    const { data: job, error } = await client
      .from('context_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return notFound('Job not found')
    }

    const workspaceId = job.workspace_id as string
    const authz = await requireAuthz(req, workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const currentStatus = job.status as string
    if (!RETRYABLE_STATUSES.has(currentStatus)) {
      return errorResponse(
        409,
        'NOT_RETRYABLE',
        `Job status '${currentStatus}' is not eligible for retry`,
      )
    }

    // Reset job to queued for reprocessing
    const now = new Date().toISOString()
    const { error: updateErr } = await client
      .from('context_jobs')
      .update({
        status: 'queued',
        attempt_count: 0,
        locked_by: null,
        locked_at: null,
        heartbeat_at: null,
        next_run_at: now,
      })
      .eq('id', jobId)
      .eq('workspace_id', workspaceId)

    if (updateErr) {
      return errorResponse(500, 'UPDATE_FAILED', updateErr.message)
    }

    return Response.json({ ok: true, status: 'queued' }, { status: 202 })
  })
}
