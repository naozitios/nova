import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse } from '../../../_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const client = getSupabaseServiceClient()
  const { data: business, error: bizError } = await client
    .from('businesses')
    .select('workspace_id')
    .eq('id', businessId)
    .single()

  if (bizError || !business) {
    return errorResponse(404, 'NOT_FOUND', 'Business not found')
  }

  const workspaceId = business.workspace_id as string
  const authz = await requireAuthz(req, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const { data, error } = await client
    .from('meta_ad_accounts')
    .select('id, account_id, meta_account_id, name, currency, timezone_name, status:connection_id, is_selected')
    .eq('workspace_id', workspaceId)
    .order('name')

  if (error) {
    return errorResponse(500, 'AD_ACCOUNTS_QUERY_FAILED', error.message)
  }

  const accounts = (data ?? []).map((row: { account_id: string; name: string; currency: string | null; timezone_name: string | null }) => ({
    id: row.account_id,
    name: row.name,
    currency: row.currency ?? 'USD',
    timezone: row.timezone_name ?? 'UTC',
    status: 'active',
  }))

  return jsonResponse({ accounts })
}
