import { NextRequest } from 'next/server'
import { randomBytes, createHash } from 'node:crypto'
import { requireAuthz, errorResponse, createdResponse } from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'
import { encodeMetaOAuthState } from '@/core/meta-data/oauth-state'

const adapter = new MetaOAuthAdapter()
const repo = new SupabaseMetaRepository()

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return errorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
  }

  const workspaceId: string | undefined = body.workspace_id
  const returnPath: string = body.return_path ?? '/settings'
  if (!workspaceId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id is required')
  }

  const authz = await requireAuthz(req, workspaceId, 'editor')
  if (!authz.ok) return authz.response

  const nonce = randomBytes(32).toString('hex')
  const nonceHash = createHash('sha256').update(nonce).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  const stateResult = await repo.createOAuthState({
    workspaceId,
    createdBy: authz.ctx.userId,
    nonceHash,
    returnPath,
    expiresAt,
  })

  if (!stateResult.ok) {
    return errorResponse(500, stateResult.error.code, stateResult.error.message)
  }

  const statePayload = encodeMetaOAuthState({
    stateId: stateResult.data.id,
    workspaceId,
    userId: authz.ctx.userId,
    nonce,
    returnPath,
  })

  const authorization_url = adapter.getAuthorizationUrl(statePayload)

  return createdResponse({
    authorization_url,
    state_id: stateResult.data.id,
    expires_at: expiresAt.toISOString(),
  })
}
