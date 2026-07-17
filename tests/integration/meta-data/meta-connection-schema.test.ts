import { describe, expect } from 'vitest'
import {
  columnExists,
  indexExists,
  itDb,
  requireEnv,
  tableExists,
  query,
} from '../business-context/db-introspect-helpers'

describe('Meta connection schema', () => {
  requireEnv()

  itDb('creates connection, OAuth state, ad account tables, and sanitized status view', async () => {
    await expect(tableExists('meta_connections')).resolves.toBe(true)
    await expect(tableExists('meta_oauth_states')).resolves.toBe(true)
    await expect(tableExists('meta_ad_accounts')).resolves.toBe(true)

    const views = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.views
       WHERE table_schema = 'public' AND table_name = 'v_meta_connection_status'`,
    )
    expect(views).toHaveLength(1)
  })

  itDb('creates required connection columns without exposing plaintext tokens', async () => {
    for (const column of [
      'workspace_id',
      'connected_by',
      'meta_user_id',
      'encrypted_access_token',
      'granted_scopes',
      'token_expires_at',
      'selected_ad_account_id',
      'selected_business_id',
      'status',
    ]) {
      await expect(columnExists('meta_connections', column)).resolves.toBe(true)
    }
    await expect(columnExists('meta_connections', 'access_token')).resolves.toBe(false)
  })

  itDb('creates required OAuth state columns', async () => {
    for (const column of [
      'workspace_id',
      'created_by',
      'state_nonce_hash',
      'return_path',
      'expires_at',
      'consumed_at',
      'provider_code_hash',
    ]) {
      await expect(columnExists('meta_oauth_states', column)).resolves.toBe(true)
    }
  })

  itDb('creates required ad account columns and selection indexes', async () => {
    for (const column of [
      'workspace_id',
      'connection_id',
      'business_id',
      'meta_account_id',
      'account_id',
      'name',
      'currency',
      'timezone_name',
      'meta_business_id',
      'meta_business_name',
      'is_selected',
      'raw_metadata',
    ]) {
      await expect(columnExists('meta_ad_accounts', column)).resolves.toBe(true)
    }

    await expect(indexExists('meta_connections', 'idx_meta_connections_one_active_user')).resolves.toBe(true)
    await expect(indexExists('meta_ad_accounts', 'idx_meta_ad_accounts_one_selected_business')).resolves.toBe(true)
  })
})
