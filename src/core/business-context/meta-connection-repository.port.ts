import type { ServiceResult } from './types'

export interface MetaConnection {
  id: string
  workspaceId: string
  businessId: string
  accessToken: string
  adAccountId: string | null
  expiresAt: Date | null
  createdAt: Date
}

export interface MetaConnectionRepositoryPort {
  getActiveConnection(workspaceId: string, businessId: string): Promise<ServiceResult<MetaConnection | null>>
  upsertConnection(data: Omit<MetaConnection, 'id' | 'createdAt'>): Promise<ServiceResult<MetaConnection>>
  deleteConnection(workspaceId: string, businessId: string): Promise<ServiceResult<void>>
}
