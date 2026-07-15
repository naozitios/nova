import type { ServiceResult } from './types'

export interface IdempotencyRecord {
  id: string
  idempotencyKey: string
  workspaceId: string
  result: Record<string, unknown> | null
  createdAt: Date
  expiresAt: Date
}

export interface IdempotencyRepositoryPort {
  get(key: string): Promise<ServiceResult<IdempotencyRecord | null>>
  set(key: string, workspaceId: string, result: Record<string, unknown> | null, ttlMs?: number): Promise<ServiceResult<IdempotencyRecord>>
  delete(key: string): Promise<ServiceResult<void>>
}
