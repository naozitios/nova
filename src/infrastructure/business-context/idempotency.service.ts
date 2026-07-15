import type { IdempotencyPort } from '@/core/business-context/idempotency.port'
import type { IdempotencyRepositoryPort } from '@/core/business-context/repository/idempotency.port'
import type { ServiceResult } from '@/core/business-context/types'
import { IdempotencyOperation, IdempotencyState } from '@/core/business-context/types/remediation-entities'

export class IdempotencyService implements IdempotencyPort {
  constructor(private readonly repo: IdempotencyRepositoryPort) {}

  async check(key: string): Promise<ServiceResult<{ exists: boolean; result?: Record<string, unknown> }>> {
    const record = await this.repo.findByKey('', IdempotencyOperation.CHECK_IDEMPOTENCY, key)
    if (!record.ok) return record
    if (!record.data) return { ok: true, data: { exists: false } }
    return { ok: true, data: { exists: true, result: record.data.responseBody ?? undefined } }
  }

  async record(key: string, workspaceId: string, result?: Record<string, unknown>): Promise<ServiceResult<void>> {
    const res = await this.repo.createRecord({
      workspaceId,
      operation: IdempotencyOperation.CHECK_IDEMPOTENCY,
      idempotencyKey: key,
      requestFingerprint: key,
      state: IdempotencyState.COMPLETED,
      resourceType: null,
      resourceId: null,
      responseStatus: null,
      responseBody: result ?? null,
      expiresAt: new Date(Date.now() + 86_400_000),
      completedAt: new Date(),
    })
    if (!res.ok) return res
    return { ok: true, data: undefined }
  }
}
