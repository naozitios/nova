import type {
  UploadIntent,
  IdempotencyRecord,
  MetaConnection,
  MetaOAuthState,
} from '@/core/business-context/types/remediation-entities'
import type { Row } from './helpers'

// ─── Shared UUIDs ──────────────────────────────────────────────────────────

export const UUID = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  workspaceId: '550e8400-e29b-41d4-a716-446655440001',
  businessId: '550e8400-e29b-41d4-a716-446655440002',
  resourceId: '550e8400-e29b-41d4-a716-446655440005',
  createdBy: '550e8400-e29b-41d4-a716-446655440099',
  connectedBy: '550e8400-e29b-41d4-a716-446655440099',
  oauthStateId: '550e8400-e29b-41d4-a716-446655440001',
} as const

// ─── UploadIntent fixtures ─────────────────────────────────────────────────

export const uploadIntentRow: Row = {
  id: UUID.id,
  workspace_id: UUID.workspaceId,
  business_id: UUID.businessId,
  source_id: null,
  source_type: 'upload',
  source_name: 'brand-deck.pdf',
  document_class: 'brand_deck',
  classification_source: 'user_declared',
  file_name: 'brand-deck.pdf',
  declared_mime_type: 'application/pdf',
  expected_size_bytes: 2048000,
  storage_path: 'uploads/550e8400/brand-deck.pdf',
  created_by: UUID.createdBy,
  status: 'pending',
  malware_scan_status: 'pending',
  malware_scan_code: null,
  malware_scanned_at: null,
  expires_at: '2026-08-15T00:00:00Z',
  completed_at: null,
  created_at: '2026-07-15T12:00:00Z',
}

export const uploadIntentEntity: UploadIntent = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  businessId: UUID.businessId,
  sourceId: null,
  sourceType: 'upload',
  sourceName: 'brand-deck.pdf',
  documentClass: 'brand_deck',
  classificationSource: 'user_declared',
  fileName: 'brand-deck.pdf',
  declaredMimeType: 'application/pdf',
  expectedSizeBytes: 2048000,
  storagePath: 'uploads/550e8400/brand-deck.pdf',
  createdBy: UUID.createdBy,
  status: 'pending',
  malwareScanStatus: 'pending',
  malwareScanCode: null,
  malwareScannedAt: null,
  expiresAt: new Date('2026-08-15T00:00:00Z'),
  completedAt: null,
  createdAt: new Date('2026-07-15T12:00:00Z'),
}

export const uploadIntentRoundTripEntity: UploadIntent = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  businessId: UUID.businessId,
  sourceId: UUID.resourceId,
  sourceType: 'upload',
  sourceName: 'report.pdf',
  documentClass: 'research_document',
  classificationSource: 'auto_detected',
  fileName: 'report.pdf',
  declaredMimeType: 'application/pdf',
  expectedSizeBytes: 1024,
  storagePath: 'uploads/report.pdf',
  createdBy: UUID.createdBy,
  status: 'completed',
  malwareScanStatus: 'clean',
  malwareScanCode: 0,
  malwareScannedAt: new Date('2026-07-15T12:01:00Z'),
  expiresAt: new Date('2026-08-15T00:00:00Z'),
  completedAt: new Date('2026-07-15T12:05:00Z'),
  createdAt: new Date('2026-07-15T12:00:00Z'),
}

// ─── IdempotencyRecord fixtures ────────────────────────────────────────────

export const idempotencyRecordRow: Row = {
  id: UUID.id,
  workspace_id: UUID.workspaceId,
  operation: 'create_upload_intent',
  idempotency_key: 'abc123-key',
  request_fingerprint: 'sha256-hash',
  state: 'completed',
  resource_type: 'upload_intent',
  resource_id: UUID.resourceId,
  response_status: 201,
  response_body: { id: UUID.resourceId },
  expires_at: '2026-07-22T12:00:00Z',
  created_at: '2026-07-15T12:00:00Z',
  completed_at: '2026-07-15T12:00:01Z',
}

export const idempotencyRecordEntity: IdempotencyRecord = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  operation: 'create_upload_intent',
  idempotencyKey: 'abc123-key',
  requestFingerprint: 'sha256-hash',
  state: 'completed',
  resourceType: 'upload_intent',
  resourceId: UUID.resourceId,
  responseStatus: 201,
  responseBody: { id: UUID.resourceId },
  expiresAt: new Date('2026-07-22T12:00:00Z'),
  createdAt: new Date('2026-07-15T12:00:00Z'),
  completedAt: new Date('2026-07-15T12:00:01Z'),
}

export const idempotencyRecordRoundTripEntity: IdempotencyRecord = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  operation: 'meta_oauth_callback',
  idempotencyKey: 'xyz789',
  requestFingerprint: 'sha256-body',
  state: 'in_progress',
  resourceType: null,
  resourceId: null,
  responseStatus: null,
  responseBody: null,
  expiresAt: new Date('2026-07-22T12:00:00Z'),
  createdAt: new Date('2026-07-15T12:00:00Z'),
  completedAt: null,
}

// ─── MetaConnection fixtures ───────────────────────────────────────────────

export const metaConnectionRow: Row = {
  id: UUID.id,
  workspace_id: UUID.workspaceId,
  connected_by: UUID.connectedBy,
  meta_user_id: 'meta-user-123',
  encrypted_access_token: 'enc:v1:ciphertext',
  token_expires_at: '2026-07-16T12:00:00Z',
  selected_ad_account_id: 'act_123456789',
  account_metadata: { name: 'My Account' },
  status: 'active',
  created_at: '2026-07-15T12:00:00Z',
  updated_at: '2026-07-15T12:00:00Z',
}

export const metaConnectionEntity: MetaConnection = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  connectedBy: UUID.connectedBy,
  metaUserId: 'meta-user-123',
  encryptedAccessToken: 'enc:v1:ciphertext',
  tokenExpiresAt: new Date('2026-07-16T12:00:00Z'),
  selectedAdAccountId: 'act_123456789',
  accountMetadata: { name: 'My Account' },
  status: 'active',
  createdAt: new Date('2026-07-15T12:00:00Z'),
  updatedAt: new Date('2026-07-15T12:00:00Z'),
}

export const metaConnectionRoundTripEntity: MetaConnection = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  connectedBy: UUID.connectedBy,
  metaUserId: 'meta-user-123',
  encryptedAccessToken: 'enc:v1:ciphertext',
  tokenExpiresAt: new Date('2026-07-16T12:00:00Z'),
  selectedAdAccountId: 'act_123456789',
  accountMetadata: { name: 'My Account', id: '123' },
  status: 'active',
  createdAt: new Date('2026-07-15T12:00:00Z'),
  updatedAt: new Date('2026-07-15T12:00:00Z'),
}

// ─── MetaOAuthState fixtures ───────────────────────────────────────────────

export const metaOAuthStateRow: Row = {
  id: UUID.id,
  workspace_id: UUID.workspaceId,
  created_by: UUID.createdBy,
  state_nonce_hash: 'sha256-nonce',
  return_path: '/settings/meta',
  expires_at: '2026-07-15T13:00:00Z',
  consumed_at: null,
  provider_code_hash: null,
  created_at: '2026-07-15T12:00:00Z',
}

export const metaOAuthStateEntity: MetaOAuthState = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  createdBy: UUID.createdBy,
  stateNonceHash: 'sha256-nonce',
  returnPath: '/settings/meta',
  expiresAt: new Date('2026-07-15T13:00:00Z'),
  consumedAt: null,
  providerCodeHash: null,
  createdAt: new Date('2026-07-15T12:00:00Z'),
}

export const metaOAuthStateRoundTripEntity: MetaOAuthState = {
  id: UUID.id,
  workspaceId: UUID.workspaceId,
  createdBy: UUID.createdBy,
  stateNonceHash: 'sha256-nonce',
  returnPath: '/settings/meta',
  expiresAt: new Date('2026-07-15T13:00:00Z'),
  consumedAt: new Date('2026-07-15T12:05:00Z'),
  providerCodeHash: 'sha256-code',
  createdAt: new Date('2026-07-15T12:00:00Z'),
}

// ─── MetaProviderCodeHash fixtures ─────────────────────────────────────────

export const metaProviderCodeHashRow: Row = {
  id: UUID.id,
  oauth_state_id: UUID.oauthStateId,
  provider_code_hash: 'sha256-code',
  created_at: '2026-07-15T12:05:00Z',
}
