import type {
  MetaConnection,
  MetaConnectionStatus,
  MetaOAuthState,
  MetaProviderCodeHash,
} from '../types/remediation-entities'
import type { ServiceResult } from '../types'
import type { PaginationParams, SortParams } from './repository.port'

// ─── Filters ────────────────────────────────────────────────────────────────

export interface MetaConnectionFilter {
  workspaceId: string
  status?: MetaConnectionStatus
}

// ─── Sanitized Response ─────────────────────────────────────────────────────

export interface MetaConnectionStatusResponse {
  id: string
  workspaceId: string
  connectedBy: string
  metaUserId: string
  tokenExpiresAt: Date | null
  selectedAdAccountId: string | null
  accountMetadata: Record<string, unknown>
  status: MetaConnectionStatus
  createdAt: Date
  updatedAt: Date
}

// ─── Port ───────────────────────────────────────────────────────────────────

export interface MetaConnectionRepositoryPort {
  createConnection(
    data: Omit<MetaConnection, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<MetaConnection>>

  getActiveConnection(
    workspaceId: string,
  ): Promise<ServiceResult<MetaConnection | null>>

  getConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<ServiceResult<MetaConnection | null>>

  listConnections(
    filter: MetaConnectionFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<{ items: MetaConnectionStatusResponse[]; total: number }>>

  updateConnectionStatus(
    workspaceId: string,
    connectionId: string,
    status: MetaConnectionStatus,
    additionalFields?: Partial<Pick<MetaConnection, 'tokenExpiresAt' | 'selectedAdAccountId' | 'accountMetadata'>>,
  ): Promise<ServiceResult<MetaConnection>>

  deleteConnection(
    workspaceId: string,
    connectionId: string,
  ): Promise<ServiceResult<void>>

  deactivateAllForWorkspace(
    workspaceId: string,
  ): Promise<ServiceResult<number>>

  // ── OAuth State ──────────────────────────────────────────────────────────

  createOAuthState(
    data: Omit<MetaOAuthState, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<MetaOAuthState>>

  getOAuthState(
    workspaceId: string,
    stateId: string,
  ): Promise<ServiceResult<MetaOAuthState | null>>

  consumeOAuthState(
    workspaceId: string,
    stateId: string,
    providerCodeHash: string,
  ): Promise<ServiceResult<MetaOAuthState>>

  deleteExpiredOAuthStates(): Promise<ServiceResult<number>>

  // ── Provider Code Hash ───────────────────────────────────────────────────

  createProviderCodeHash(
    data: Omit<MetaProviderCodeHash, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<MetaProviderCodeHash>>

  getProviderCodeHash(
    oauthStateId: string,
  ): Promise<ServiceResult<MetaProviderCodeHash | null>>
}
