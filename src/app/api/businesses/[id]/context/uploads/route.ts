import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  createdResponse,
  errorResponse,
  parseJsonBody,
  validateWithSchema,
} from '../../../_shared'
import { createSignedUploadIntent } from '@/core/business-context/service/upload.service'
import { createClassificationProposal } from '@/core/business-context/upload-classification-proposal'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { UploadRepository } from '@/infrastructure/business-context/repository/upload.repository'
import { SupabaseUploadStorage } from '@/infrastructure/business-context/supabase-upload.storage'
import { DocumentClass } from '@/core/business-context/types/remediation-entities'

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

const UploadCreateSchema = z.object({
  source_type: z.string().min(1),
  source_name: z.string().min(1),
  document_class: z.nativeEnum(DocumentClass),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive().max(52_428_800),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  return withIdempotency(req, async () => {
    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response

    const validation = validateWithSchema(UploadCreateSchema, bodyResult.data)
    if (!validation.ok) return validation.response

    const proposal = createClassificationProposal(
      {
        workspaceId: wsResult.workspaceId,
        businessId,
        filename: validation.data.file_name,
        mimeType: validation.data.mime_type,
        documentClass: validation.data.document_class,
      },
      {
        signingSecret: process.env.UPLOAD_SIGNING_SECRET ?? '',
        ttlMs: 300_000,
      },
    )

    const repo = new UploadRepository(getSupabaseServiceClient())
    const storage = new SupabaseUploadStorage()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: wsResult.workspaceId,
      businessId,
      proposal,
      expectedSizeBytes: validation.data.size_bytes,
      sourceType: validation.data.source_type as 'upload',
      sourceName: validation.data.source_name,
      createdBy: authz.ctx.userId,
    }, {
      signingSecret: process.env.UPLOAD_SIGNING_SECRET ?? '',
      ttlMs: 300_000,
      storageBucket: process.env.UPLOAD_STORAGE_BUCKET ?? 'uploads',
    })

    if (!result.ok) {
      const status = result.error.code.startsWith('PROPOSAL_') ? 400 : 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const intent = result.data.intent
    return createdResponse({
      id: intent.id,
      document_class: intent.documentClass,
      classification_source: intent.classificationSource,
      upload_url: result.data.signedUrl,
      expires_at: intent.expiresAt.toISOString(),
      status: intent.status,
      malware_scan_status: intent.malwareScanStatus,
      malware_scan_code: intent.malwareScanCode,
    })
  }, { operation: 'create_upload_intent' as const, workspaceId: wsResult.workspaceId })
}
