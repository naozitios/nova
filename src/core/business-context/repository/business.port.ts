import type { Business, ServiceResult } from '../types'
import type { PaginationParams, SortParams } from './repository.port'

export interface BusinessFilter {
  workspaceId: string
  status?: string
}

export interface BusinessRepositoryPort {
  createBusiness(
    data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<Business>>

  getBusiness(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<Business | null>>

  listBusinesses(
    filter: BusinessFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'name' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<{ items: Business[]; total: number }>>

  updateBusiness(
    workspaceId: string,
    businessId: string,
    data: Partial<Pick<Business, 'name' | 'websiteUrl' | 'status'>>,
  ): Promise<ServiceResult<Business>>
}
