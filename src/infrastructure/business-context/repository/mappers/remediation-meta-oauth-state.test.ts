import { describe, it, expect } from 'vitest'
import type { Row } from './helpers'
import { mapMetaOAuthState, unmapMetaOAuthState } from './remediation'
import {
  metaOAuthStateRow,
  metaOAuthStateEntity,
  metaOAuthStateRoundTripEntity,
} from './remediation-fixtures'

describe('mapMetaOAuthState', () => {
  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaOAuthState(metaOAuthStateRow)

    expect(entity.id).toBe(metaOAuthStateRow.id)
    expect(entity.workspaceId).toBe(metaOAuthStateRow.workspace_id)
    expect(entity.createdBy).toBe(metaOAuthStateRow.created_by)
    expect(entity.stateNonceHash).toBe('sha256-nonce')
    expect(entity.returnPath).toBe('/settings/meta')
    expect(entity.consumedAt).toBeNull()
    expect(entity.providerCodeHash).toBeNull()
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaOAuthState(metaOAuthStateRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
  })

  it('handles consumed state', () => {
    const consumedRow: Row = {
      ...metaOAuthStateRow,
      consumed_at: '2026-07-15T12:05:00Z',
      provider_code_hash: 'sha256-code',
    }

    const entity = mapMetaOAuthState(consumedRow)

    expect(entity.consumedAt).toBeInstanceOf(Date)
    expect(entity.providerCodeHash).toBe('sha256-code')
  })
})

describe('unmapMetaOAuthState', () => {
  it('maps camelCase entity to snake_case row', () => {
    const row = unmapMetaOAuthState(metaOAuthStateEntity)

    expect(row.id).toBe(metaOAuthStateEntity.id)
    expect(row.workspace_id).toBe(metaOAuthStateEntity.workspaceId)
    expect(row.created_by).toBe(metaOAuthStateEntity.createdBy)
    expect(row.state_nonce_hash).toBe('sha256-nonce')
    expect(row.return_path).toBe('/settings/meta')
    expect(row.consumed_at).toBeNull()
    expect(row.provider_code_hash).toBeNull()
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapMetaOAuthState(metaOAuthStateEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
  })
})

describe('MetaOAuthState round-trip', () => {
  it('preserves data through map → unmap', () => {
    const row = unmapMetaOAuthState(metaOAuthStateRoundTripEntity)
    const restored = mapMetaOAuthState(row)

    expect(restored.id).toBe(metaOAuthStateRoundTripEntity.id)
    expect(restored.workspaceId).toBe(metaOAuthStateRoundTripEntity.workspaceId)
    expect(restored.createdBy).toBe(metaOAuthStateRoundTripEntity.createdBy)
    expect(restored.stateNonceHash).toBe(metaOAuthStateRoundTripEntity.stateNonceHash)
    expect(restored.returnPath).toBe(metaOAuthStateRoundTripEntity.returnPath)
    expect(restored.expiresAt.toISOString()).toBe(metaOAuthStateRoundTripEntity.expiresAt.toISOString())
    expect(restored.consumedAt?.toISOString()).toBe(metaOAuthStateRoundTripEntity.consumedAt?.toISOString())
    expect(restored.providerCodeHash).toBe(metaOAuthStateRoundTripEntity.providerCodeHash)
    expect(restored.createdAt.toISOString()).toBe(metaOAuthStateRoundTripEntity.createdAt.toISOString())
  })
})
