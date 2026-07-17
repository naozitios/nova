import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  jsonResponse,
  errorResponse,
  parseJsonBody,
  validateWithSchema,
} from '../../../_shared'
import { completeUploadIntent } from '@/core/business-context/service/upload.service'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { UploadRepository } from '@/infrastructure/business-context/repository/upload.repository'
import { SupabaseUploadStorage } from '@/infrastructure/business-context/supabase-upload.storage'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { ClamavMalwareScanner } from '@/infrastructure/business-context/clamav-malware.scanner'

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

const CompleteUploadSchema = z.object({
  storage_path: z.string().min(1),
  checksum_sha256: z.string().nullable().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> },
) {
  const { id: businessId, uploadId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  return withIdempotency(req, async () => {
    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const bodyResult = await parseJsonBody(req)
    if (!bodyResult.ok) return bodyResult.response

    const validation = validateWithSchema(CompleteUploadSchema, bodyResult.data)
    if (!validation.ok) return validation.response

    const client = getSupabaseServiceClient()
    const uploadRepo = new UploadRepository(client)
    const bcRepo = new SupabaseRepository(client)
    const storage = new SupabaseUploadStorage()
    const scanner = new ClamavMalwareScanner()

    const validator = async (
      buffer: Buffer,
      declaredMimeType: string,
      fileName: string,
    ) => {
      const { createHash } = await import('node:crypto')
      const contentHash = createHash('sha256').update(buffer).digest('hex')
      return {
        ok: true as const,
        data: { contentHash, detectedMimeType: declaredMimeType },
      }
    }

    const result = await completeUploadIntent(
      uploadRepo,
      bcRepo,
      storage,
      scanner,
      validator,
      { workspaceId: wsResult.workspaceId, businessId, intentId: uploadId },
      {
        storageBucket: process.env.UPLOAD_STORAGE_BUCKET ?? 'uploads',
        sourceProcessingStageTimeoutSeconds: 30,
      },
    )

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        INTENT_NOT_FOUND: 404,
        INTENT_CROSS_BUSINESS: 403,
        INTENT_EXPIRED: 409,
        INTENT_NOT_PENDING: 409,
        SIZE_MISMATCH: 400,
        MALWARE_DETECTED: 400,
        SCAN_FAILED: 503,
      }
      const status = statusMap[result.error.code] ?? 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const { intent, source, document, job } = result.data
    return jsonResponse({
      upload: {
        id: intent.id,
        document_class: intent.documentClass,
        classification_source: intent.classificationSource,
        upload_url: null,
        expires_at: intent.expiresAt.toISOString(),
        status: intent.status,
        malware_scan_status: intent.malwareScanStatus,
        malware_scan_code: intent.malwareScanCode,
      },
      source: {
        id: source.id,
        source_type: source.sourceType,
        source_name: source.sourceName,
        document_class: intent.documentClass,
        status: source.status,
        current_stage: source.currentStage,
        terminal_outcome: source.terminalOutcome,
        retryable: false,
        added_at: source.collectedAt.toISOString(),
        effective_at: null,
        counts: { documents: 0, facts: 0, warnings: 0, pages: 0, slides: 0 },
      },
      job: job ? {
        id: job.id,
        business_id: job.businessId,
        source_id: source.id,
        processing_run_id: null,
        status: job.status,
        attempts: job.attemptCount,
        max_attempts: job.maxAttempts,
        retryable: true,
        next_run_at: null,
        heartbeat_at: null,
        created_at: job.createdAt.toISOString(),
        failure: null,
      } : null,
    }, 202)
  }, { operation: 'complete_upload' as const, workspaceId: wsResult.workspaceId })
}
