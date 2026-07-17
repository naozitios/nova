import { describe, expect, expectTypeOf, it } from 'vitest'
import { decodeMetaOAuthState, encodeMetaOAuthState, hashMetaOAuthNonce } from '@/core/meta-data/oauth-state'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from '@/core/meta-data/entities'

describe('Meta OAuth state helpers', () => {
  it('round-trips workspace, user, nonce, and return path', () => {
    const encoded = encodeMetaOAuthState({
      stateId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      nonce: 'nonce-value',
      returnPath: '/settings?tab=meta',
    })

    expect(decodeMetaOAuthState(encoded)).toEqual({
      stateId: '11111111-1111-4111-8111-111111111111',
      workspaceId: '22222222-2222-4222-8222-222222222222',
      userId: '33333333-3333-4333-8333-333333333333',
      nonce: 'nonce-value',
      returnPath: '/settings?tab=meta',
    })
  })

  it('returns null for invalid state', () => {
    expect(decodeMetaOAuthState('not-valid-base64')).toBeNull()
  })

  it('hashes nonce with sha256 hex', () => {
    expect(hashMetaOAuthNonce('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('exposes planned connection status view fields', () => {
    expectTypeOf<MetaConnectionStatusView>().toEqualTypeOf<{
      id: string
      workspaceId: string
      connectedBy: string
      metaUserId: string
      status: 'pending' | 'connected' | 'degraded' | 'reconnect_required' | 'disconnected'
      grantedScopes: string[]
      tokenExpiresAt: Date | null
      selectedAdAccountId: string | null
      selectedBusinessId: string | null
      lastVerifiedAt: Date | null
      reconnectReason: string | null
      createdAt: Date
      updatedAt: Date
    }>()
  })

  it('exposes planned ad account summary fields', () => {
    expectTypeOf<MetaAdAccountSummary>().toEqualTypeOf<{
      id: string
      accountId: string
      name: string
      currency: string | null
      timezoneName: string | null
      businessId: string | null
      businessName: string | null
      isSelected: boolean
    }>()
  })
})
