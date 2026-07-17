export type MetaConnectionStatus = 'pending' | 'connected' | 'degraded' | 'reconnect_required' | 'disconnected'

export interface MetaOAuthStatePayload {
  stateId: string
  workspaceId: string
  userId: string
  nonce: string
  returnPath: string
}

export interface MetaConnectionStatusView {
  id: string
  workspaceId: string
  connectedBy: string
  metaUserId: string
  status: MetaConnectionStatus
  grantedScopes: string[]
  tokenExpiresAt: Date | null
  selectedAdAccountId: string | null
  selectedBusinessId: string | null
  lastVerifiedAt: Date | null
  reconnectReason: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MetaAdAccountSummary {
  id: string
  accountId: string
  name: string
  currency: string | null
  timezoneName: string | null
  businessId: string | null
  businessName: string | null
  isSelected: boolean
}
