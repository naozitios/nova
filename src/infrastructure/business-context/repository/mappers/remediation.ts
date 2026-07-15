import type {
  UploadIntent,
  IdempotencyRecord,
  MetaConnection,
  MetaOAuthState,
  MetaProviderCodeHash,
} from '@/core/business-context/types/remediation-entities'
import type { MetaConnectionStatusResponse } from '@/core/business-context/repository/meta-connection.port'
import { asJsonRecord, type Row } from './helpers'

export function mapUploadIntent(r: Row): UploadIntent {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceId: (r.source_id as string) ?? null,
    sourceType: r.source_type as UploadIntent['sourceType'],
    sourceName: r.source_name as string,
    documentClass: r.document_class as UploadIntent['documentClass'],
    classificationSource: r.classification_source as string,
    fileName: r.file_name as string,
    declaredMimeType: r.declared_mime_type as string,
    expectedSizeBytes: Number(r.expected_size_bytes),
    storagePath: r.storage_path as string,
    createdBy: r.created_by as string,
    status: r.status as UploadIntent['status'],
    malwareScanStatus: r.malware_scan_status as UploadIntent['malwareScanStatus'],
    malwareScanCode: r.malware_scan_code != null ? Number(r.malware_scan_code) : null,
    malwareScannedAt: r.malware_scanned_at ? new Date(r.malware_scanned_at as string) : null,
    expiresAt: new Date(r.expires_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
    createdAt: new Date(r.created_at as string),
  }
}

export function unmapUploadIntent(e: UploadIntent): Row {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    business_id: e.businessId,
    source_id: e.sourceId,
    source_type: e.sourceType,
    source_name: e.sourceName,
    document_class: e.documentClass,
    classification_source: e.classificationSource,
    file_name: e.fileName,
    declared_mime_type: e.declaredMimeType,
    expected_size_bytes: e.expectedSizeBytes,
    storage_path: e.storagePath,
    created_by: e.createdBy,
    status: e.status,
    malware_scan_status: e.malwareScanStatus,
    malware_scan_code: e.malwareScanCode,
    malware_scanned_at: e.malwareScannedAt?.toISOString() ?? null,
    expires_at: e.expiresAt.toISOString(),
    completed_at: e.completedAt?.toISOString() ?? null,
    created_at: e.createdAt.toISOString(),
  }
}

export function mapIdempotencyRecord(r: Row): IdempotencyRecord {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    operation: r.operation as IdempotencyRecord['operation'],
    idempotencyKey: r.idempotency_key as string,
    requestFingerprint: r.request_fingerprint as string,
    state: r.state as IdempotencyRecord['state'],
    resourceType: (r.resource_type as string) ?? null,
    resourceId: (r.resource_id as string) ?? null,
    responseStatus: r.response_status != null ? Number(r.response_status) : null,
    responseBody: r.response_body != null ? asJsonRecord(r.response_body) as IdempotencyRecord['responseBody'] : null,
    expiresAt: new Date(r.expires_at as string),
    createdAt: new Date(r.created_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
  }
}

export function unmapIdempotencyRecord(e: IdempotencyRecord): Row {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    operation: e.operation,
    idempotency_key: e.idempotencyKey,
    request_fingerprint: e.requestFingerprint,
    state: e.state,
    resource_type: e.resourceType,
    resource_id: e.resourceId,
    response_status: e.responseStatus,
    response_body: e.responseBody,
    expires_at: e.expiresAt.toISOString(),
    created_at: e.createdAt.toISOString(),
    completed_at: e.completedAt?.toISOString() ?? null,
  }
}

export function mapMetaConnection(r: Row): MetaConnection {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    connectedBy: r.connected_by as string,
    metaUserId: r.meta_user_id as string,
    encryptedAccessToken: r.encrypted_access_token as string,
    tokenExpiresAt: r.token_expires_at ? new Date(r.token_expires_at as string) : null,
    selectedAdAccountId: (r.selected_ad_account_id as string) ?? null,
    accountMetadata: asJsonRecord(r.account_metadata),
    status: r.status as MetaConnection['status'],
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

export function unmapMetaConnection(e: MetaConnection): Row {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    connected_by: e.connectedBy,
    meta_user_id: e.metaUserId,
    encrypted_access_token: e.encryptedAccessToken,
    token_expires_at: e.tokenExpiresAt?.toISOString() ?? null,
    selected_ad_account_id: e.selectedAdAccountId,
    account_metadata: e.accountMetadata,
    status: e.status,
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  }
}

export function mapMetaConnectionStatus(r: Row): MetaConnectionStatusResponse {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    connectedBy: r.connected_by as string,
    metaUserId: r.meta_user_id as string,
    tokenExpiresAt: r.token_expires_at ? new Date(r.token_expires_at as string) : null,
    selectedAdAccountId: (r.selected_ad_account_id as string) ?? null,
    accountMetadata: asJsonRecord(r.account_metadata),
    status: r.status as MetaConnection['status'],
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

export function mapMetaOAuthState(r: Row): MetaOAuthState {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    createdBy: r.created_by as string,
    stateNonceHash: r.state_nonce_hash as string,
    returnPath: r.return_path as string,
    expiresAt: new Date(r.expires_at as string),
    consumedAt: r.consumed_at ? new Date(r.consumed_at as string) : null,
    providerCodeHash: (r.provider_code_hash as string) ?? null,
    createdAt: new Date(r.created_at as string),
  }
}

export function unmapMetaOAuthState(e: MetaOAuthState): Row {
  return {
    id: e.id,
    workspace_id: e.workspaceId,
    created_by: e.createdBy,
    state_nonce_hash: e.stateNonceHash,
    return_path: e.returnPath,
    expires_at: e.expiresAt.toISOString(),
    consumed_at: e.consumedAt?.toISOString() ?? null,
    provider_code_hash: e.providerCodeHash,
    created_at: e.createdAt.toISOString(),
  }
}

export function mapMetaProviderCodeHash(r: Row): MetaProviderCodeHash {
  return {
    id: r.id as string,
    oauthStateId: r.oauth_state_id as string,
    providerCodeHash: r.provider_code_hash as string,
    createdAt: new Date(r.created_at as string),
  }
}
