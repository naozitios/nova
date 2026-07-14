import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  createdResponse,
  errorResponse,
  jsonResponse,
  parseJsonBody,
  validateWithSchema,
} from '../../../_shared'
import {
  registerSource,
  listSources,
} from '@/core/business-context/service'
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

const RegisterSourceSchema = z.object({
  source_type: z.string().min(1),
  source_name: z.string().min(1),
  external_reference: z.string().url().optional(),
})

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

  const result = await listSources(repo, businessId, wsResult.workspaceId)
  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  return jsonResponse({
    sources: result.data.items.map((s) => ({
      id: s.id,
      workspace_id: s.workspaceId,
      business_id: s.businessId,
      source_type: s.sourceType,
      source_name: s.sourceName,
      external_reference: s.externalReference,
      status: s.status,
      current_stage: s.currentStage,
      terminal_outcome: s.terminalOutcome,
      metadata: s.metadata,
      collected_at: s.collectedAt.toISOString(),
    })),
    total: result.data.total,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response

    const validation = validateWithSchema(RegisterSourceSchema, bodyResult.data)
    if (!validation.ok) return validation.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await registerSource(repo, businessId, wsResult.workspaceId, {
      sourceType: validation.data.source_type,
      sourceName: validation.data.source_name,
      externalReference: validation.data.external_reference,
    })

    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const s = result.data
    return createdResponse({
      id: s.id,
      workspace_id: s.workspaceId,
      business_id: s.businessId,
      source_type: s.sourceType,
      source_name: s.sourceName,
      external_reference: s.externalReference,
      status: s.status,
      current_stage: s.currentStage,
      terminal_outcome: s.terminalOutcome,
      metadata: s.metadata,
      collected_at: s.collectedAt.toISOString(),
    })
  })
}
