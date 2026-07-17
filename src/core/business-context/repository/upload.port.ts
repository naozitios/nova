import type {
  UploadIntent,
  UploadIntentStatus,
} from '../types/remediation-entities'
import type { ServiceResult } from '../types'
import type { PaginationParams, SortParams } from './repository.port'

// ─── Filters ────────────────────────────────────────────────────────────────

export interface UploadIntentFilter {
  workspaceId: string
  businessId?: string
  status?: UploadIntentStatus
}

// ─── Port ───────────────────────────────────────────────────────────────────

export interface UploadRepositoryPort {
  createUploadIntent(
    data: Omit<UploadIntent, 'createdAt'>,
  ): Promise<ServiceResult<UploadIntent>>

  getUploadIntent(
    workspaceId: string,
    intentId: string,
  ): Promise<ServiceResult<UploadIntent | null>>

  getUploadIntentByStoragePath(
    storagePath: string,
  ): Promise<ServiceResult<UploadIntent | null>>

  listUploadIntents(
    filter: UploadIntentFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt' | 'expiresAt'>,
  ): Promise<ServiceResult<{ items: UploadIntent[]; total: number }>>

  updateUploadIntentStatus(
    workspaceId: string,
    intentId: string,
    status: UploadIntentStatus,
    additionalFields?: Partial<Pick<UploadIntent, 'completedAt' | 'malwareScanStatus' | 'malwareScanCode' | 'malwareScannedAt'>>,
  ): Promise<ServiceResult<UploadIntent>>

  deleteUploadIntent(
    workspaceId: string,
    intentId: string,
  ): Promise<ServiceResult<void>>

  expireStaleIntents(): Promise<ServiceResult<number>>
}
