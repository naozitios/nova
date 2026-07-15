import type { IdempotencyPort } from '@/core/business-context/idempotency.port'
import type { IdempotencyRepositoryPort } from '@/core/business-context/idempotency-repository.port'
import type { ServiceResult } from '@/core/business-context/types'

export class IdempotencyService implements IdempotencyPort {
  constructor(private readonly repo: IdempotencyRepositoryPort) {}

  async check(key: string): Promise<ServiceResult<{ exists: boolean; result?: Record<string, unknown> }>> {
    const record = await this.repo.get(key)
    if (!record.ok) return record
    if (!record.data) return { ok: true, data: { exists: false } }
    return { ok: true, data: { exists: true, result: record.data.result ?? undefined } }
  }

  async record(key: string, workspaceId: string, result?: Record<string, unknown>): Promise<ServiceResult<void>> {
    const res = await this.repo.set(key, workspaceId, result ?? null)
    if (!res.ok) return res
    return { ok: true, data: undefined }
  }
}
