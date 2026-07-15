import { describe, it, expect } from 'vitest'
import type { Row } from './helpers'
import { mapIdempotencyRecord, unmapIdempotencyRecord } from './remediation'
import {
  idempotencyRecordRow,
  idempotencyRecordEntity,
  idempotencyRecordRoundTripEntity,
} from './remediation-fixtures'

describe('mapIdempotencyRecord', () => {
  it('maps snake_case row to camelCase entity', () => {
    const entity = mapIdempotencyRecord(idempotencyRecordRow)

    expect(entity.id).toBe(idempotencyRecordRow.id)
    expect(entity.workspaceId).toBe(idempotencyRecordRow.workspace_id)
    expect(entity.operation).toBe('create_upload_intent')
    expect(entity.idempotencyKey).toBe('abc123-key')
    expect(entity.requestFingerprint).toBe('sha256-hash')
    expect(entity.state).toBe('completed')
    expect(entity.resourceType).toBe('upload_intent')
    expect(entity.resourceId).toBe('550e8400-e29b-41d4-a716-446655440005')
    expect(entity.responseStatus).toBe(201)
    expect(entity.responseBody).toEqual({ id: '550e8400-e29b-41d4-a716-446655440005' })
  })

  it('converts date strings to Date objects', () => {
    const entity = mapIdempotencyRecord(idempotencyRecordRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.completedAt).toBeInstanceOf(Date)
  })

  it('handles null optional fields', () => {
    const rowWithNulls: Row = {
      ...idempotencyRecordRow,
      resource_type: null,
      resource_id: null,
      response_status: null,
      response_body: null,
      completed_at: null,
    }

    const entity = mapIdempotencyRecord(rowWithNulls)

    expect(entity.resourceType).toBeNull()
    expect(entity.resourceId).toBeNull()
    expect(entity.responseStatus).toBeNull()
    expect(entity.responseBody).toBeNull()
    expect(entity.completedAt).toBeNull()
  })
})

describe('unmapIdempotencyRecord', () => {
  it('maps camelCase entity to snake_case row', () => {
    const row = unmapIdempotencyRecord(idempotencyRecordEntity)

    expect(row.id).toBe(idempotencyRecordEntity.id)
    expect(row.workspace_id).toBe(idempotencyRecordEntity.workspaceId)
    expect(row.operation).toBe('create_upload_intent')
    expect(row.idempotency_key).toBe('abc123-key')
    expect(row.request_fingerprint).toBe('sha256-hash')
    expect(row.state).toBe('completed')
    expect(row.resource_type).toBe('upload_intent')
    expect(row.resource_id).toBe('550e8400-e29b-41d4-a716-446655440005')
    expect(row.response_status).toBe(201)
    expect(row.response_body).toEqual({ id: '550e8400-e29b-41d4-a716-446655440005' })
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapIdempotencyRecord(idempotencyRecordEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
    expect(typeof row.completed_at).toBe('string')
  })
})

describe('IdempotencyRecord round-trip', () => {
  it('preserves data through map → unmap', () => {
    const row = unmapIdempotencyRecord(idempotencyRecordRoundTripEntity)
    const restored = mapIdempotencyRecord(row)

    expect(restored.id).toBe(idempotencyRecordRoundTripEntity.id)
    expect(restored.workspaceId).toBe(idempotencyRecordRoundTripEntity.workspaceId)
    expect(restored.operation).toBe(idempotencyRecordRoundTripEntity.operation)
    expect(restored.idempotencyKey).toBe(idempotencyRecordRoundTripEntity.idempotencyKey)
    expect(restored.requestFingerprint).toBe(idempotencyRecordRoundTripEntity.requestFingerprint)
    expect(restored.state).toBe(idempotencyRecordRoundTripEntity.state)
    expect(restored.resourceType).toBeNull()
    expect(restored.resourceId).toBeNull()
    expect(restored.responseStatus).toBeNull()
    expect(restored.responseBody).toBeNull()
    expect(restored.expiresAt.toISOString()).toBe(idempotencyRecordRoundTripEntity.expiresAt.toISOString())
    expect(restored.createdAt.toISOString()).toBe(idempotencyRecordRoundTripEntity.createdAt.toISOString())
    expect(restored.completedAt).toBeNull()
  })
})
