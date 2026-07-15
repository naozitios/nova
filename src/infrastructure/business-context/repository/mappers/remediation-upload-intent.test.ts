import { describe, it, expect } from 'vitest'
import type { UploadIntent } from '@/core/business-context/types/remediation-entities'
import { mapUploadIntent, unmapUploadIntent } from './remediation'
import type { Row } from './helpers'
import {
  UUID,
  uploadIntentRow,
  uploadIntentEntity,
  uploadIntentRoundTripEntity,
} from './remediation-fixtures'

describe('mapUploadIntent', () => {
  it('maps snake_case row to camelCase entity', () => {
    const entity = mapUploadIntent(uploadIntentRow)

    expect(entity.id).toBe(uploadIntentRow.id)
    expect(entity.workspaceId).toBe(uploadIntentRow.workspace_id)
    expect(entity.businessId).toBe(uploadIntentRow.business_id)
    expect(entity.sourceId).toBeNull()
    expect(entity.sourceType).toBe('upload')
    expect(entity.sourceName).toBe('brand-deck.pdf')
    expect(entity.documentClass).toBe('brand_deck')
    expect(entity.classificationSource).toBe('user_declared')
    expect(entity.fileName).toBe('brand-deck.pdf')
    expect(entity.declaredMimeType).toBe('application/pdf')
    expect(entity.expectedSizeBytes).toBe(2048000)
    expect(entity.storagePath).toBe('uploads/550e8400/brand-deck.pdf')
    expect(entity.createdBy).toBe(uploadIntentRow.created_by)
    expect(entity.status).toBe('pending')
    expect(entity.malwareScanStatus).toBe('pending')
    expect(entity.malwareScanCode).toBeNull()
    expect(entity.malwareScannedAt).toBeNull()
    expect(entity.completedAt).toBeNull()
  })

  it('converts date strings to Date objects', () => {
    const entity = mapUploadIntent(uploadIntentRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.expiresAt.toISOString()).toBe('2026-08-15T00:00:00.000Z')
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.createdAt.toISOString()).toBe('2026-07-15T12:00:00.000Z')
  })

  it('handles non-null optional fields', () => {
    const rowWithOptionals: Row = {
      ...uploadIntentRow,
      source_id: UUID.resourceId,
      malware_scan_code: 0,
      malware_scanned_at: '2026-07-15T12:01:00Z',
      completed_at: '2026-07-15T12:05:00Z',
    }

    const entity = mapUploadIntent(rowWithOptionals)

    expect(entity.sourceId).toBe(UUID.resourceId)
    expect(entity.malwareScanCode).toBe(0)
    expect(entity.malwareScannedAt).toBeInstanceOf(Date)
    expect(entity.completedAt).toBeInstanceOf(Date)
  })
})

describe('unmapUploadIntent', () => {
  it('maps camelCase entity to snake_case row', () => {
    const row = unmapUploadIntent(uploadIntentEntity)

    expect(row.id).toBe(uploadIntentEntity.id)
    expect(row.workspace_id).toBe(uploadIntentEntity.workspaceId)
    expect(row.business_id).toBe(uploadIntentEntity.businessId)
    expect(row.source_id).toBeNull()
    expect(row.source_type).toBe('upload')
    expect(row.source_name).toBe('brand-deck.pdf')
    expect(row.document_class).toBe('brand_deck')
    expect(row.classification_source).toBe('user_declared')
    expect(row.file_name).toBe('brand-deck.pdf')
    expect(row.declared_mime_type).toBe('application/pdf')
    expect(row.expected_size_bytes).toBe(2048000)
    expect(row.storage_path).toBe('uploads/550e8400/brand-deck.pdf')
    expect(row.created_by).toBe(uploadIntentEntity.createdBy)
    expect(row.status).toBe('pending')
    expect(row.malware_scan_status).toBe('pending')
    expect(row.malware_scan_code).toBeNull()
    expect(row.malware_scanned_at).toBeNull()
    expect(row.completed_at).toBeNull()
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapUploadIntent(uploadIntentEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(row.expires_at).toBe('2026-08-15T00:00:00.000Z')
    expect(typeof row.created_at).toBe('string')
    expect(row.created_at).toBe('2026-07-15T12:00:00.000Z')
  })
})

describe('UploadIntent round-trip', () => {
  it('preserves data through map → unmap', () => {
    const row = unmapUploadIntent(uploadIntentRoundTripEntity)
    const restored = mapUploadIntent(row)

    expect(restored.id).toBe(uploadIntentRoundTripEntity.id)
    expect(restored.workspaceId).toBe(uploadIntentRoundTripEntity.workspaceId)
    expect(restored.businessId).toBe(uploadIntentRoundTripEntity.businessId)
    expect(restored.sourceId).toBe(uploadIntentRoundTripEntity.sourceId)
    expect(restored.sourceType).toBe(uploadIntentRoundTripEntity.sourceType)
    expect(restored.sourceName).toBe(uploadIntentRoundTripEntity.sourceName)
    expect(restored.documentClass).toBe(uploadIntentRoundTripEntity.documentClass)
    expect(restored.classificationSource).toBe(uploadIntentRoundTripEntity.classificationSource)
    expect(restored.fileName).toBe(uploadIntentRoundTripEntity.fileName)
    expect(restored.declaredMimeType).toBe(uploadIntentRoundTripEntity.declaredMimeType)
    expect(restored.expectedSizeBytes).toBe(uploadIntentRoundTripEntity.expectedSizeBytes)
    expect(restored.storagePath).toBe(uploadIntentRoundTripEntity.storagePath)
    expect(restored.createdBy).toBe(uploadIntentRoundTripEntity.createdBy)
    expect(restored.status).toBe(uploadIntentRoundTripEntity.status)
    expect(restored.malwareScanStatus).toBe(uploadIntentRoundTripEntity.malwareScanStatus)
    expect(restored.malwareScanCode).toBe(uploadIntentRoundTripEntity.malwareScanCode)
    expect(restored.malwareScannedAt?.toISOString()).toBe(uploadIntentRoundTripEntity.malwareScannedAt?.toISOString())
    expect(restored.expiresAt.toISOString()).toBe(uploadIntentRoundTripEntity.expiresAt.toISOString())
    expect(restored.completedAt?.toISOString()).toBe(uploadIntentRoundTripEntity.completedAt?.toISOString())
    expect(restored.createdAt.toISOString()).toBe(uploadIntentRoundTripEntity.createdAt.toISOString())
  })
})
