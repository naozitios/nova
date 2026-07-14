import type { AuditLog, ServiceResult } from '../types'
import type { PaginationParams, SortParams } from './repository.port'

export interface AuditLogFilter {
  workspaceId: string
  businessId?: string
  entityType?: string
  entityId?: string
  createdAfter?: Date
  createdBefore?: Date
}

export interface AuditRepositoryPort {
  createAuditLog(
    data: Omit<AuditLog, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<AuditLog>>

  listAuditLogs(
    filter: AuditLogFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt'>,
  ): Promise<ServiceResult<{ items: AuditLog[]; total: number }>>
}
