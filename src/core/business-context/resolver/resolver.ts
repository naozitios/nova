// ─── Fact resolution facade ─────────────────────────────────────────────────

import type { ContextFact, JsonValue, VerificationStatus } from '../types'
import type { ExtractedFact } from '../extraction.port'
import { groupByNormalizedKey, normalizeFactKey } from './normalize'
import { decideProposed } from './precedence'

export interface ResolutionResult {
  superseded: { oldFactId: string }[]
  toCreate: ExtractedFact[]
  toUpdate: {
    factId: string
    confidence: number
    verificationStatus: VerificationStatus
  }[]
  conflicts: {
    factKey: string
    values: JsonValue[]
    factIds: string[]
  }[]
}

function isActive(f: ContextFact): boolean {
  return f.verificationStatus !== 'superseded' && f.verificationStatus !== 'rejected'
}

export function resolveFacts(
  existing: ContextFact[],
  incoming: ExtractedFact[],
): ResolutionResult {
  const result: ResolutionResult = {
    superseded: [],
    toCreate: [],
    toUpdate: [],
    conflicts: [],
  }
  const byKey = groupByNormalizedKey(existing)
  for (const inc of incoming) {
    const active = (byKey.get(normalizeFactKey(inc.factKey)) ?? []).filter(isActive)
    const d = decideProposed(inc, active)
    switch (d.kind) {
      case 'create':
        result.toCreate.push(inc)
        break
      case 'update':
        result.toUpdate.push({
          factId: d.factId,
          confidence: d.confidence,
          verificationStatus: d.verificationStatus,
        })
        break
      case 'supersede':
        for (const id of d.oldFactIds) result.superseded.push({ oldFactId: id })
        result.toCreate.push(inc)
        break
      case 'conflict':
        result.conflicts.push({
          factKey: d.factKey,
          values: d.values,
          factIds: d.factIds,
        })
        break
    }
  }
  return result
}
