import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../../_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { DEMO_BUSINESS_ID, DEMO_WORKSPACE_ID } from '@/lib/demo-user'

const MOCK_AD_ACCOUNTS = [
  {
    meta_account_id: 'act_822109301847123',
    account_id: 'act_822109301847123',
    name: 'Nova Media Growth',
    currency: 'USD',
    timezone_name: 'America/New_York',
    meta_business_id: 'biz_demo_001',
    meta_business_name: 'Demo Agency',
  },
  {
    meta_account_id: 'act_774512908265441',
    account_id: 'act_774512908265441',
    name: 'Nova Sandbox',
    currency: 'USD',
    timezone_name: 'America/Los_Angeles',
    meta_business_id: 'biz_demo_001',
    meta_business_name: 'Demo Agency',
  },
]

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  if (businessId !== DEMO_BUSINESS_ID) {
    return errorResponse(403, 'NOT_DEMO_BUSINESS', 'Demo connect is only available for the demo business')
  }

  const authz = await requireAuthz(req, DEMO_WORKSPACE_ID, 'editor')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()

  const { data: existing } = await client
    .from('meta_connections')
    .select('id')
    .eq('workspace_id', DEMO_WORKSPACE_ID)
    .in('status', ['pending', 'connected', 'degraded', 'reconnect_required'])
    .maybeSingle()

  let connectionId = existing?.id as string | undefined
  if (!connectionId) {
    const { data: created, error: createErr } = await client
      .from('meta_connections')
      .insert({
        workspace_id: DEMO_WORKSPACE_ID,
        connected_by: authz.ctx.userId,
        meta_user_id: 'demo_meta_user_001',
        encrypted_access_token: 'demo://token-placeholder',
        granted_scopes: ['ads_read', 'ads_management', 'business_management'],
        status: 'connected',
        last_verified_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (createErr || !created) {
      return errorResponse(500, 'DEMO_CONNECT_FAILED', createErr?.message ?? 'Failed to create demo connection')
    }
    connectionId = created.id
  }

  for (const account of MOCK_AD_ACCOUNTS) {
    await client.from('meta_ad_accounts').upsert(
      {
        workspace_id: DEMO_WORKSPACE_ID,
        connection_id: connectionId,
        business_id: businessId,
        ...account,
        raw_metadata: {},
      },
      { onConflict: 'workspace_id,connection_id,meta_account_id' },
    )
  }

  return jsonResponse({
    status: 'connected',
    connection_id: connectionId,
    ad_accounts: MOCK_AD_ACCOUNTS,
  })
}
