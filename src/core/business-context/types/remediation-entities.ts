// ─── Remediation Enums ───────────────────────────────────────────────────────

export const UploadIntentStatus = {
  PENDING: 'pending',
  SCANNING: 'scanning',
  STORING: 'storing',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const

export type UploadIntentStatus =
  (typeof UploadIntentStatus)[keyof typeof UploadIntentStatus]

export const SourceType = {
  UPLOAD: 'upload',
  META: 'meta',
  MANUAL: 'manual',
  PASTE: 'paste',
} as const

export type SourceType = (typeof SourceType)[keyof typeof SourceType]

export const DocumentClass = {
  BRAND_DECK: 'brand_deck',
  PRODUCT_DOCUMENT: 'product_document',
  RESEARCH_DOCUMENT: 'research_document',
  CAMPAIGN_BRIEF: 'campaign_brief',
  WEBSITE_CONTENT: 'website_content',
  OTHER: 'other',
} as const

export type DocumentClass = (typeof DocumentClass)[keyof typeof DocumentClass]

export const MalwareScanStatus = {
  PENDING: 'pending',
  CLEAN: 'clean',
  INFECTED: 'infected',
  ERROR: 'error',
  SKIPPED: 'skipped',
} as const

export type MalwareScanStatus =
  (typeof MalwareScanStatus)[keyof typeof MalwareScanStatus]

export const IdempotencyOperation = {
  CREATE_UPLOAD_INTENT: 'create_upload_intent',
  CHECK_IDEMPOTENCY: 'check_idempotency',
  META_OAUTH_CALLBACK: 'meta_oauth_callback',
  META_ACCOUNT_SELECT: 'meta_account_select',
} as const

export type IdempotencyOperation =
  (typeof IdempotencyOperation)[keyof typeof IdempotencyOperation]

export const IdempotencyState = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type IdempotencyState =
  (typeof IdempotencyState)[keyof typeof IdempotencyState]

export const MetaConnectionStatus = {
  ACTIVE: 'active',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  PENDING_REAUTHORIZATION: 'pending_reauthorization',
} as const

export type MetaConnectionStatus =
  (typeof MetaConnectionStatus)[keyof typeof MetaConnectionStatus]

// ─── Remediation Entity Interfaces ───────────────────────────────────────────

export interface UploadIntent {
  id: string
  workspaceId: string
  businessId: string
  sourceId: string | null
  sourceType: SourceType
  sourceName: string
  documentClass: DocumentClass
  classificationSource: string
  fileName: string
  declaredMimeType: string
  expectedSizeBytes: number
  storagePath: string
  createdBy: string
  status: UploadIntentStatus
  malwareScanStatus: MalwareScanStatus
  malwareScanCode: number | null
  malwareScannedAt: Date | null
  expiresAt: Date
  completedAt: Date | null
  createdAt: Date
}

export interface IdempotencyRecord {
  id: string
  workspaceId: string
  operation: IdempotencyOperation
  idempotencyKey: string
  requestFingerprint: string
  state: IdempotencyState
  resourceType: string | null
  resourceId: string | null
  responseStatus: number | null
  responseBody: Record<string, unknown> | null
  expiresAt: Date
  createdAt: Date
  completedAt: Date | null
}

export interface MetaConnection {
  id: string
  workspaceId: string
  connectedBy: string
  metaUserId: string
  encryptedAccessToken: string
  tokenExpiresAt: Date | null
  selectedAdAccountId: string | null
  accountMetadata: Record<string, unknown>
  status: MetaConnectionStatus
  createdAt: Date
  updatedAt: Date
}

export interface MetaOAuthState {
  id: string
  workspaceId: string
  createdBy: string
  stateNonceHash: string
  returnPath: string
  expiresAt: Date
  consumedAt: Date | null
  providerCodeHash: string | null
  createdAt: Date
}

export interface MetaProviderCodeHash {
  id: string
  oauthStateId: string
  providerCodeHash: string
  createdAt: Date
}
