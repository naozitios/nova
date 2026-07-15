import type {
  IdempotencyRecord,
  IdempotencyRepositoryPort,
} from '@/core/business-context/idempotency-repository.port'
import type { ServiceResult } from '@/core/business-context/types'

export class InMemoryIdempotencyRepository implements IdempotencyRepositoryPort {
  private records = new Map<string, IdempotencyRecord>()

  async get(key: string): Promise<ServiceResult<IdempotencyRecord | null>> {
    const record = this.records.get(key)
    if (record && record.expiresAt > new Date()) {
      return { ok: true, data: record }
    }
    return { ok: true, data: null }
  }

  async set(key: string, workspaceId: string, result: Record<string, unknown> | null, ttlMs?: number): Promise<ServiceResult<IdempotencyRecord>> {
    const now = new Date()
    const record: IdempotencyRecord = {
      id: `idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      idempotencyKey: key,
      workspaceId,
      result,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (ttlMs ?? 86_400_000)),
    }
    this.records.set(key, record)
    return { ok: true, data: record }
  }

  async delete(key: string): Promise<ServiceResult<void>> {
    this.records.delete(key)
    return { ok: true, data: undefined }
  }
}
