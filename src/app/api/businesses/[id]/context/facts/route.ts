import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  parseJsonBody,
  errorResponse,
  jsonResponse,
  createdResponse,
} from '@/app/api/businesses/_shared'
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

interface FactsPatchBody {
  facts: Array<{
    factKey: string
    value: unknown
    sourceId: string
  }>
}

// PATCH /api/businesses/{id}/context/facts — upsert user-verified facts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params
  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  return withIdempotency(req, async () => {
    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const body = await parseJsonBody<FactsPatchBody>(req)
    if (!body.ok) return body.response

    if (!body.data.facts || !Array.isArray(body.data.facts) || body.data.facts.length === 0) {
      return errorResponse(400, 'VALIDATION_ERROR', 'facts array required')
    }

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const created = []
    for (const fact of body.data.facts) {
      const result = await repo.createContextFact({
        workspaceId: wsResult.workspaceId,
        businessId,
        factKey: fact.factKey,
        value: fact.value as import('@/core/business-context/types').JsonValue,
        sourceId: fact.sourceId,
        sourceDocumentId: null,
        sourceExcerpt: null,
        evidenceLocator: null,
        confidence: 1.0,
        verificationStatus: 'user_verified',
        supersedesFactId: null,
        validFrom: new Date(),
        validTo: null,
        createdBy: authz.ctx.userId,
      })
      if (!result.ok) {
        return errorResponse(500, result.error.code, result.error.message)
      }
      created.push(result.data)
    }

    return createdResponse({ facts: created })
  }, { operation: 'patch_facts' as const, workspaceId: wsResult.workspaceId })
}
