import type { ServiceResult } from './types'

export interface IdempotencyPort {
  check(key: string): Promise<ServiceResult<{ exists: boolean; result?: Record<string, unknown> }>>
  record(key: string, workspaceId: string, result?: Record<string, unknown>): Promise<ServiceResult<void>>
}
