import type {
  IdempotencyRecord,
  IdempotencyOperation,
  IdempotencyState,
} from '../types/remediation-entities'
import type { ServiceResult } from '../types'

// ─── Port ───────────────────────────────────────────────────────────────────

export interface IdempotencyRepositoryPort {
  createRecord(
    data: Omit<IdempotencyRecord, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<IdempotencyRecord>>

  findByKey(
    workspaceId: string,
    operation: IdempotencyOperation,
    idempotencyKey: string,
  ): Promise<ServiceResult<IdempotencyRecord | null>>

  updateState(
    workspaceId: string,
    recordId: string,
    state: IdempotencyState,
    additionalFields?: Partial<Pick<IdempotencyRecord, 'resourceType' | 'resourceId' | 'responseStatus' | 'responseBody' | 'completedAt'>>,
  ): Promise<ServiceResult<IdempotencyRecord>>

  deleteRecord(
    workspaceId: string,
    recordId: string,
  ): Promise<ServiceResult<void>>

  deleteExpired(): Promise<ServiceResult<number>>
}
