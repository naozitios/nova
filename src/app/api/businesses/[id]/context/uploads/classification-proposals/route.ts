import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  requireAuthz,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  validateWithSchema,
} from '../../../_shared'
import { createClassificationProposal } from '@/core/business-context/upload-classification-proposal'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'

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

const ProposalSchema = z.object({
  source_name: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
})

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

  const validation = validateWithSchema(ProposalSchema, bodyResult.data)
  if (!validation.ok) return validation.response

  const proposal = createClassificationProposal(
    {
      workspaceId: wsResult.workspaceId,
      businessId,
      filename: validation.data.file_name,
      mimeType: validation.data.mime_type,
      documentClass: 'other',
    },
    {
      signingSecret: process.env.UPLOAD_SIGNING_SECRET ?? '',
      ttlMs: 300_000,
    },
  )

  return jsonResponse({
    proposal_token: proposal.signature,
    document_class: proposal.documentClass,
    expires_at: new Date(proposal.expiresAt).toISOString(),
  })
}
