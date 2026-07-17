import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse } from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { MetaTokenVault } from '@/infrastructure/meta/token-vault'
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter'

const repo = new SupabaseMetaRepository()

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')

  if (!workspaceId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id query parameter is required')
  }

  const authz = await requireAuthz(req, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const connResult = await repo.getConnectionWithToken(workspaceId)
  if (!connResult.ok) {
    return errorResponse(500, connResult.error.code, connResult.error.message)
  }
  if (!connResult.data) {
    return errorResponse(409, 'META_NOT_CONNECTED', 'Meta account is not connected for this workspace')
  }

  const connection = connResult.data
  const vault = new MetaTokenVault()
  const token = vault.decrypt(connection.encryptedAccessToken)

  const adapter = new MetaApiAdapter()
  let accounts
  try {
    accounts = await adapter.listAccessibleAdAccounts(token)
  } catch (error) {
    return errorResponse(502, 'META_API_ERROR', error instanceof Error ? error.message : 'Failed to fetch ad accounts from Meta')
  }

  const upsertResult = await repo.upsertAdAccounts({
    workspaceId,
    connectionId: connection.id,
    accounts,
  })
  if (!upsertResult.ok) {
    return errorResponse(500, upsertResult.error.code, upsertResult.error.message)
  }

  return jsonResponse({ accounts: upsertResult.data })
}
