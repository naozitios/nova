import type { ServiceResult } from './types'

export interface ResolvedMetaConnection {
  accessToken: string
  adAccountId: string | null
  expiresAt: Date | null
}

export interface MetaConnectionPort {
  resolve(workspaceId: string, businessId: string): Promise<ServiceResult<ResolvedMetaConnection>>
}
