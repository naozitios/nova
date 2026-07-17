import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  jsonResponse,
  errorResponse,
  createdResponse,
} from '@/app/api/businesses/_shared'
import { Container } from '@/di/container'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'

const StartConnectionSchema = z.object({
  workspace_id: z.string().uuid(),
  return_path: z.string().max(512).default('/settings'),
})

// ─── GET /api/meta/connections — sanitized status ──────────────────────────

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')

  if (!workspaceId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id query parameter is required')
  }

  const authz = await requireAuthz(req, workspaceId, 'editor')
  if (!authz.ok) return authz.response

  const repo = Container.getMetaConnectionRepository()
  const result = await repo.getActiveConnection(workspaceId)

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  if (!result.data) {
    return jsonResponse({
      connected: false,
      connection: null,
    })
  }

  const conn = result.data
  return jsonResponse({
    connected: true,
    connection: {
      id: conn.id,
      workspace_id: conn.workspaceId,
      connected_by: conn.connectedBy,
      meta_user_id: conn.metaUserId,
      token_expires_at: conn.tokenExpiresAt?.toISOString() ?? null,
      selected_ad_account_id: conn.selectedAdAccountId,
      status: conn.status,
      created_at: conn.createdAt.toISOString(),
      updated_at: conn.updatedAt.toISOString(),
    },
  })
}

// ─── POST /api/meta/connections — start OAuth flow ─────────────────────────

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    const body = await req.clone().json().catch(() => null)
    if (!body) {
      return errorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
    }

    const validation = StartConnectionSchema.safeParse(body)
    if (!validation.success) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request data', validation.error.flatten().fieldErrors)
    }

    const { workspace_id: workspaceId, return_path: returnPath } = validation.data

    const authz = await requireAuthz(req, workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const crypto = await import('crypto')
    const nonce = crypto.randomBytes(32).toString('hex')
    const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex')
    const state = crypto.randomBytes(16).toString('hex')

    const repo = Container.getMetaConnectionRepository()
    const stateResult = await repo.createOAuthState({
      workspaceId,
      createdBy: authz.ctx.userId,
      stateNonceHash: nonceHash,
      returnPath,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      consumedAt: null,
      providerCodeHash: null,
    })

    if (!stateResult.ok) {
      return errorResponse(500, stateResult.error.code, stateResult.error.message)
    }

    const adapter = Container.getMetaOAuthAdapter()
    const authUrl = adapter.getAuthorizationUrl(`${state}:${nonce}`)

    return createdResponse({
      authorization_url: authUrl,
      state_id: stateResult.data.id,
      expires_at: stateResult.data.expiresAt.toISOString(),
    })
  }, { operation: 'meta_start_connection' as const })
}
