import { describe, expect, it } from 'vitest'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'
import { canRun, getClient, TEST_BUSINESS, TEST_USER, TEST_WORKSPACE } from '../business-context/supabase-helpers'

const itDb = canRun ? it : it.skip

describe('SupabaseMetaRepository', () => {
  itDb('consumes OAuth state once and rejects provider code replay', async () => {
    const repo = new SupabaseMetaRepository(getClient())
    const nonceHash = `nonce-${crypto.randomUUID()}`
    const providerCodeHash = `code-${crypto.randomUUID()}`

    const created = await repo.createOAuthState({
      workspaceId: TEST_WORKSPACE,
      createdBy: TEST_USER,
      nonceHash,
      returnPath: '/settings?tab=meta',
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const consumed = await repo.consumeOAuthState({
      stateId: created.data.id,
      nonceHash,
      providerCodeHash,
      now: new Date(),
    })
    expect(consumed.ok).toBe(true)

    const replayedState = await repo.consumeOAuthState({
      stateId: created.data.id,
      nonceHash,
      providerCodeHash: `code-${crypto.randomUUID()}`,
      now: new Date(),
    })
    expect(replayedState.ok).toBe(false)
    if (replayedState.ok) return
    expect(replayedState.error.code).toBe('OAUTH_CALLBACK_REPLAYED')

    const second = await repo.createOAuthState({
      workspaceId: TEST_WORKSPACE,
      createdBy: TEST_USER,
      nonceHash: `nonce-${crypto.randomUUID()}`,
      returnPath: '/settings?tab=meta',
      expiresAt: new Date(Date.now() + 60_000),
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    const replayedCode = await repo.consumeOAuthState({
      stateId: second.data.id,
      nonceHash: second.data.nonceHash,
      providerCodeHash,
      now: new Date(),
    })
    expect(replayedCode.ok).toBe(false)
    if (replayedCode.ok) return
    expect(replayedCode.error.code).toBe('CODE_REPLAYED')
  })

  itDb('upserts connection, returns sanitized status, and binds selected account to business', async () => {
    const repo = new SupabaseMetaRepository(getClient())
    const metaUserId = `meta-user-${crypto.randomUUID()}`
    const metaAccountId = `act_${crypto.randomUUID()}`

    const connection = await repo.upsertConnection({
      workspaceId: TEST_WORKSPACE,
      connectedBy: TEST_USER,
      metaUserId,
      encryptedAccessToken: 'encrypted-token-value',
      grantedScopes: ['ads_read'],
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    })
    expect(connection.ok, JSON.stringify(connection)).toBe(true)
    if (!connection.ok) return

    await expect(repo.getStatus(TEST_WORKSPACE)).resolves.toMatchObject({
      ok: true,
      data: expect.arrayContaining([
        expect.objectContaining({
          id: connection.data.id,
          workspaceId: TEST_WORKSPACE,
          metaUserId,
          selectedAdAccountId: null,
        }),
      ]),
    })

    const savedAccounts = await repo.upsertAdAccounts({
      workspaceId: TEST_WORKSPACE,
      connectionId: connection.data.id,
      accounts: [
        {
          id: metaAccountId,
          accountId: metaAccountId.replace('act_', ''),
          name: 'NOVA Test Account',
          currency: 'USD',
          timezoneName: 'America/New_York',
          businessId: null,
          businessName: null,
          rawMetadata: { source: 'test' },
        },
      ],
    })
    expect(savedAccounts.ok).toBe(true)

    const selected = await repo.selectAdAccount({
      workspaceId: TEST_WORKSPACE,
      metaAccountId,
      businessId: TEST_BUSINESS,
    })
    expect(selected.ok).toBe(true)
    if (!selected.ok) return
    expect(selected.data).toMatchObject({ accountId: metaAccountId.replace('act_', ''), businessId: TEST_BUSINESS, isSelected: true })

    const accounts = await repo.listAdAccounts(TEST_WORKSPACE, connection.data.id)
    expect(accounts.ok).toBe(true)
    if (!accounts.ok) return
    expect(accounts.data).toEqual([
      expect.objectContaining({ name: 'NOVA Test Account', businessId: TEST_BUSINESS, isSelected: true }),
    ])
  })
})
