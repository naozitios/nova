import type {
  BusinessProfileVersion,
  ServiceResult,
} from '../types'
import type { PaginationParams } from './repository.port'

export interface ProfileVersionFilter {
  workspaceId: string
  businessId: string
  status?: string
}

export interface ProfileRepositoryPort {
  createProfileVersion(
    data: Omit<BusinessProfileVersion, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<BusinessProfileVersion>>

  getProfileVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>>

  listProfileVersions(
    filter: ProfileVersionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: BusinessProfileVersion[]; total: number }>>

  getCurrentProfileVersion(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>>

  supersedeProfileVersions(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<void>>

  approveProfileVersion(
    workspaceId: string,
    versionId: string,
    approvedBy: string,
  ): Promise<ServiceResult<BusinessProfileVersion>>

  restoreProfileVersion(
    workspaceId: string,
    versionId: string,
    restoredBy: string,
    note?: string,
  ): Promise<ServiceResult<BusinessProfileVersion>>
}
