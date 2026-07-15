import { describe, it, expect } from 'vitest'
import { mapMetaProviderCodeHash } from './remediation'
import { metaProviderCodeHashRow } from './remediation-fixtures'

describe('mapMetaProviderCodeHash', () => {
  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaProviderCodeHash(metaProviderCodeHashRow)

    expect(entity.id).toBe(metaProviderCodeHashRow.id)
    expect(entity.oauthStateId).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(entity.providerCodeHash).toBe('sha256-code')
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaProviderCodeHash(metaProviderCodeHashRow)

    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.createdAt.toISOString()).toBe('2026-07-15T12:05:00.000Z')
  })
})
