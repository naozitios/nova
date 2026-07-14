import { z } from 'zod'
import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  parseJsonBody,
  validateWithSchema,
  errorResponse,
  jsonResponse,
} from '../../../_shared'
import { submitAnswers, type SubmitAnswersInput } from '@/core/business-context/service'
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

const AnswerSchema = z.object({
  answers: z.array(
    z.object({
      factKey: z.string().min(1),
      answer: z.unknown(),
    }),
  ).min(1),
})

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

    const body = await parseJsonBody(req)
    if (!body.ok) return body.response

    const validated = validateWithSchema(AnswerSchema, body.data)
    if (!validated.ok) return validated.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await submitAnswers(
      repo,
      businessId,
      wsResult.workspaceId,
      authz.ctx.userId,
      validated.data as SubmitAnswersInput,
    )
    if (!result.ok) {
      return errorResponse(500, result.error.code, result.error.message)
    }

    return jsonResponse({ ok: true })
  })
}
