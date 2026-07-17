import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  WORKSPACE_A,
  WORKSPACE_B,
  authedClient,
  cleanupUsers,
  createAuthUser,
  getServiceClient,
  initServiceClient,
  run,
  seedWorkspaces,
} from '../business-context/remediation-isolation-fixtures'

describe.skipIf(!run)('RLS — Meta connection foundation', () => {
  beforeAll(() => initServiceClient())
  afterAll(() => cleanupUsers())

  it('does not expose encrypted tokens to authenticated workspace members', async () => {
    await seedWorkspaces()
    const svc = getServiceClient()
    const member = await createAuthUser(`meta-008a-${Date.now()}@test.example`)
    await svc.from('workspace_members').upsert({ workspace_id: WORKSPACE_A, user_id: member.id, role: 'owner' })

    const { data: connection, error: insertError } = await svc
      .from('meta_connections')
      .insert({
        workspace_id: WORKSPACE_A,
        connected_by: member.id,
        meta_user_id: 'meta-user-008a',
        encrypted_access_token: 'encrypted-secret-token',
        granted_scopes: ['ads_read'],
        status: 'connected',
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const client = authedClient(member.jwt)
    const directRead = await client.from('meta_connections').select('encrypted_access_token').eq('id', connection!.id)
    expect(!directRead.data || directRead.data.length === 0 || directRead.error !== null).toBe(true)

    const statusRead = await client.from('v_meta_connection_status').select('*').eq('id', connection!.id).single()
    expect(statusRead.error).toBeNull()
    expect(statusRead.data).toMatchObject({ meta_user_id: 'meta-user-008a', status: 'connected' })
    expect(statusRead.data).not.toHaveProperty('encrypted_access_token')
  })

  it('isolates sanitized status by workspace', async () => {
    await seedWorkspaces()
    const svc = getServiceClient()
    const ownerB = await createAuthUser(`meta-008a-b-${Date.now()}@test.example`)
    await svc.from('workspace_members').upsert({ workspace_id: WORKSPACE_B, user_id: ownerB.id, role: 'owner' })

    const { data: connection, error: insertError } = await svc
      .from('meta_connections')
      .insert({
        workspace_id: WORKSPACE_A,
        connected_by: '00000000-0000-0000-0000-000000000001',
        meta_user_id: 'meta-user-cross-workspace',
        encrypted_access_token: 'encrypted-secret-token',
        granted_scopes: ['ads_read'],
        status: 'connected',
      })
      .select('id')
      .single()
    expect(insertError).toBeNull()

    const client = authedClient(ownerB.jwt)
    const { data, error } = await client.from('v_meta_connection_status').select('*').eq('id', connection!.id)
    expect(!data || data.length === 0 || error !== null).toBe(true)
  })
})
