import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { compareVersions } from '@/core/business-context/service'

const CompareQuerySchema = z.object({
  from: z.string().uuid(),
  to: z.string().uuid(),
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function flattenChanges(
  section: string,
  before: unknown,
  after: unknown,
  path = section,
): Array<Record<string, unknown>> {
  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    return [...keys].flatMap((key) =>
      flattenChanges(section, before[key], after[key], `${path}.${key}`),
    )
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return []
  return [{
    section,
    fact_key: path,
    previous_value: before === undefined ? null : before,
    proposed_value: after === undefined ? null : after,
    source_id: null,
    source_name: null,
    reason: 'Profile field changed between immutable versions',
  }]
}

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

// GET /api/businesses/{id}/context/versions/compare?from=X&to=Y
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const query = CompareQuerySchema.safeParse({
    from: req.nextUrl.searchParams.get('from'),
    to: req.nextUrl.searchParams.get('to'),
  })
  if (!query.success) {
    return errorResponse(400, 'VALIDATION_ERROR', 'from and to query parameters are required')
  }
  const { from, to } = query.data

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await compareVersions(repo, businessId, wsResult.workspaceId, from, to)

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') {
      return errorResponse(404, 'NOT_FOUND', result.error.message)
    }
    return errorResponse(500, result.error.code, result.error.message)
  }

  const changes = Object.entries(result.data.diffs).flatMap(([key, diff]) =>
    flattenChanges(key, diff.before, diff.after),
  )

  return jsonResponse({
    base_version_id: result.data.fromVersionId,
    draft_version_id: result.data.toVersionId,
    changes,
  })
}
