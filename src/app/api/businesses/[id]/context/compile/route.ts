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
import { compileContextForPurpose } from '@/core/business-context/service'
import { ContextPurpose } from '@/core/business-context/types'
import { z } from 'zod'

const compileBodySchema = z.object({
  purpose: z.enum([
    ContextPurpose.CAMPAIGN_SETUP,
    ContextPurpose.PERFORMANCE_ANALYSIS,
    ContextPurpose.OPTIMIZATION,
    ContextPurpose.HYPOTHESIS_GENERATION,
    ContextPurpose.CREATIVE_BRIEF,
    ContextPurpose.TRACKING_AUDIT,
  ]),
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

// POST /api/businesses/{id}/context/compile — compile purpose-scoped context
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
  if (!authz.ok) return authz.response

  const bodyResult = await parseJsonBody(req)
  if (!bodyResult.ok) return bodyResult.response

  const validated = validateWithSchema(compileBodySchema, bodyResult.data)
  if (!validated.ok) return validated.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await compileContextForPurpose(
    repo,
    businessId,
    wsResult.workspaceId,
    validated.data.purpose,
  )
  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  return jsonResponse(result.data)
}
