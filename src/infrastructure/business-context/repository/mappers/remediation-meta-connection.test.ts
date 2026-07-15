import { describe, it, expect } from 'vitest'
import type { Row } from './helpers'
import { mapMetaConnection, unmapMetaConnection } from './remediation'
import {
  metaConnectionRow,
  metaConnectionEntity,
  metaConnectionRoundTripEntity,
} from './remediation-fixtures'

describe('mapMetaConnection', () => {
  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaConnection(metaConnectionRow)

    expect(entity.id).toBe(metaConnectionRow.id)
    expect(entity.workspaceId).toBe(metaConnectionRow.workspace_id)
    expect(entity.connectedBy).toBe(metaConnectionRow.connected_by)
    expect(entity.metaUserId).toBe('meta-user-123')
    expect(entity.encryptedAccessToken).toBe('enc:v1:ciphertext')
    expect(entity.selectedAdAccountId).toBe('act_123456789')
    expect(entity.accountMetadata).toEqual({ name: 'My Account' })
    expect(entity.status).toBe('active')
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaConnection(metaConnectionRow)

    expect(entity.tokenExpiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.updatedAt).toBeInstanceOf(Date)
  })

  it('handles null optional fields', () => {
    const rowWithNulls: Row = {
      ...metaConnectionRow,
      token_expires_at: null,
      selected_ad_account_id: null,
    }

    const entity = mapMetaConnection(rowWithNulls)

    expect(entity.tokenExpiresAt).toBeNull()
    expect(entity.selectedAdAccountId).toBeNull()
  })
})

describe('unmapMetaConnection', () => {
  it('maps camelCase entity to snake_case row', () => {
    const row = unmapMetaConnection(metaConnectionEntity)

    expect(row.id).toBe(metaConnectionEntity.id)
    expect(row.workspace_id).toBe(metaConnectionEntity.workspaceId)
    expect(row.connected_by).toBe(metaConnectionEntity.connectedBy)
    expect(row.meta_user_id).toBe('meta-user-123')
    expect(row.encrypted_access_token).toBe('enc:v1:ciphertext')
    expect(row.selected_ad_account_id).toBe('act_123456789')
    expect(row.account_metadata).toEqual({ name: 'My Account' })
    expect(row.status).toBe('active')
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapMetaConnection(metaConnectionEntity)

    expect(typeof row.token_expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
    expect(typeof row.updated_at).toBe('string')
  })
})

describe('MetaConnection round-trip', () => {
  it('preserves data through map → unmap', () => {
    const row = unmapMetaConnection(metaConnectionRoundTripEntity)
    const restored = mapMetaConnection(row)

    expect(restored.id).toBe(metaConnectionRoundTripEntity.id)
    expect(restored.workspaceId).toBe(metaConnectionRoundTripEntity.workspaceId)
    expect(restored.connectedBy).toBe(metaConnectionRoundTripEntity.connectedBy)
    expect(restored.metaUserId).toBe(metaConnectionRoundTripEntity.metaUserId)
    expect(restored.encryptedAccessToken).toBe(metaConnectionRoundTripEntity.encryptedAccessToken)
    expect(restored.tokenExpiresAt?.toISOString()).toBe(metaConnectionRoundTripEntity.tokenExpiresAt?.toISOString())
    expect(restored.selectedAdAccountId).toBe(metaConnectionRoundTripEntity.selectedAdAccountId)
    expect(restored.accountMetadata).toEqual(metaConnectionRoundTripEntity.accountMetadata)
    expect(restored.status).toBe(metaConnectionRoundTripEntity.status)
    expect(restored.createdAt.toISOString()).toBe(metaConnectionRoundTripEntity.createdAt.toISOString())
    expect(restored.updatedAt.toISOString()).toBe(metaConnectionRoundTripEntity.updatedAt.toISOString())
  })
})
