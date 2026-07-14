// US5: Task-specific context compilation (FR-030).

import type { RepositoryPort } from '../repository.port'
import type { ContextPurpose } from '../types'
import {
  compileContextForPurpose as compilePurpose,
  type CompiledContext,
} from '../context-purpose-compiler'

/**
 * Compile task-specific context from current profile version.
 * Returns only sections relevant to the given purpose.
 */
export async function compileContextForPurpose(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  purpose: ContextPurpose,
): Promise<{ ok: true; data: CompiledContext } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  const currentResult = await repo.getCurrentProfileVersion(workspaceId, businessId)
  if (!currentResult.ok) return currentResult
  if (!currentResult.data) {
    return {
      ok: false,
      error: { code: 'NO_CURRENT_VERSION', message: 'No approved profile version exists' },
    }
  }

  return compilePurpose(currentResult.data, purpose)
}
