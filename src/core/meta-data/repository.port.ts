import type { ServiceResult } from '@/core/business-context/types'
import type { MetaAdAccountSummary, MetaConnectionStatusView } from './entities'

export interface MetaOAuthStateRecord {
  id: string
  workspaceId: string
  createdBy: string
  nonceHash: string
  returnPath: string
  expiresAt: Date
  consumedAt: Date | null
  providerCodeHash: string | null
  createdAt: Date
}

export interface MetaConnectionRecord extends MetaConnectionStatusView {
  encryptedAccessToken: string
}

export interface CreateOAuthStateInput {
  workspaceId: string
  createdBy: string
  nonceHash: string
  returnPath: string
  expiresAt: Date
}

export interface ConsumeOAuthStateInput {
  stateId: string
  nonceHash: string
  providerCodeHash: string
  now: Date
}

export interface UpsertConnectionInput {
  workspaceId: string
  connectedBy: string
  metaUserId: string
  encryptedAccessToken: string
  grantedScopes: string[]
  tokenExpiresAt: Date | null
}

export interface UpsertMetaAdAccountInput {
  id: string
  accountId: string
  name: string
  currency: string | null
  timezoneName: string | null
  businessId: string | null
  businessName: string | null
  rawMetadata: Record<string, unknown>
}

export interface UpsertAdAccountsInput {
  workspaceId: string
  connectionId: string
  accounts: UpsertMetaAdAccountInput[]
}

export interface SelectAdAccountInput {
  workspaceId: string
  metaAccountId: string
  businessId: string
}

export interface MetaRepositoryPort {
  createOAuthState(input: CreateOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>>
  consumeOAuthState(input: ConsumeOAuthStateInput): Promise<ServiceResult<MetaOAuthStateRecord>>
  upsertConnection(input: UpsertConnectionInput): Promise<ServiceResult<MetaConnectionRecord>>
  getConnectionWithToken(workspaceId: string): Promise<ServiceResult<MetaConnectionRecord | null>>
  getStatus(workspaceId: string): Promise<ServiceResult<MetaConnectionStatusView[]>>
  upsertAdAccounts(input: UpsertAdAccountsInput): Promise<ServiceResult<MetaAdAccountSummary[]>>
  listAdAccounts(workspaceId: string, connectionId?: string): Promise<ServiceResult<MetaAdAccountSummary[]>>
  selectAdAccount(input: SelectAdAccountInput): Promise<ServiceResult<MetaAdAccountSummary>>
}
