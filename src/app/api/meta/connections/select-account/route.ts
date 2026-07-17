import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { Container } from '@/di/container'

export async function POST(req: NextRequest) {
  return withIdempotency(
    req,
    async () => {
      const body = await req.json()
      const { workspace_id, connection_id, ad_account_id } = body ?? {}

      if (!workspace_id || !connection_id || !ad_account_id) {
        return errorResponse(
          400,
          'VALIDATION_ERROR',
          'workspace_id, connection_id, and ad_account_id are required',
        )
      }

      // Require editor or admin role
      const authz = await requireAuthz(req, workspace_id, 'editor')
      if (!authz.ok) return authz.response

      // Validate workspace ownership via getConnection
      const metaRepo = Container.getMetaConnectionRepository()
      const connection = await metaRepo.getConnection(workspace_id, connection_id)
      if (!connection.ok) {
        return errorResponse(500, 'INTERNAL_ERROR', connection.error.message)
      }
      if (!connection.data) {
        return errorResponse(404, 'NOT_FOUND', 'Connection not found')
      }

      // Update selected ad account on connection
      const updateResult = await metaRepo.updateConnectionStatus(
        workspace_id,
        connection_id,
        connection.data.status,
        { selectedAdAccountId: ad_account_id },
      )
      if (!updateResult.ok) {
        return errorResponse(500, 'INTERNAL_ERROR', updateResult.error.message)
      }

      // Return sanitized response — never include tokens
      const updated = updateResult.data
      return jsonResponse({
        id: updated.id,
        workspace_id: updated.workspaceId,
        connected_by: updated.connectedBy,
        meta_user_id: updated.metaUserId,
        token_expires_at: updated.tokenExpiresAt?.toISOString() ?? null,
        selected_ad_account: updated.selectedAdAccountId,
        status: updated.status,
        created_at: updated.createdAt.toISOString(),
        updated_at: updated.updatedAt.toISOString(),
      })
    },
    { operation: 'meta_account_select' as const },
  )
}
