// ─── Source precedence + per-incoming decision rules ────────────────────────

import type { ContextFact, JsonValue, VerificationStatus } from '../types'
import type { ExtractedFact } from '../extraction.port'
import { valuesEqual } from './normalize'

export const SOURCE_PRECEDENCE: Record<string, number> = {
  user_verified: 0,
  authoritative: 1,
  operational: 2,
  website: 3,
  meta: 4,
  llm: 5,
}

export function verificationPrecedence(status: VerificationStatus): number {
  switch (status) {
    case 'user_verified': return 0
    case 'extracted': return 2
    case 'inferred': return 3
    case 'rejected': return 4
    case 'superseded': return 5
    default: return 2
  }
}

export function precedenceSourceOf(fact: ContextFact): string {
  if (fact.verificationStatus === 'user_verified') return 'user_verified'
  if (fact.verificationStatus === 'rejected') return 'rejected'
  return 'llm'
}

export type ProposedDecision =
  | { kind: 'create' }
  | {
      kind: 'update'
      factId: string
      confidence: number
      verificationStatus: VerificationStatus
    }
  | { kind: 'supersede'; oldFactIds: string[] }
  | {
      kind: 'conflict'
      factKey: string
      values: JsonValue[]
      factIds: string[]
    }

export function decideProposed(
  inc: ExtractedFact,
  active: ContextFact[],
): ProposedDecision {
  if (active.length === 0) {
    return { kind: 'create' }
  }

  const matchingValue = active.find((f) => valuesEqual(f.value, inc.value))
  if (matchingValue) {
    return {
      kind: 'update',
      factId: matchingValue.id,
      confidence: Math.min(1, Math.max(matchingValue.confidence, inc.confidence)),
      verificationStatus: matchingValue.verificationStatus,
    }
  }

  if (active.some((f) => f.verificationStatus === 'user_verified')) {
    return {
      kind: 'conflict',
      factKey: inc.factKey,
      values: [active[0].value, inc.value],
      factIds: active.map((f) => f.id),
    }
  }

  const incomingPrecedence = SOURCE_PRECEDENCE.llm
  const existingPrecedence =
    SOURCE_PRECEDENCE[precedenceSourceOf(active[0])] ?? SOURCE_PRECEDENCE.llm

  if (incomingPrecedence < existingPrecedence) {
    return { kind: 'supersede', oldFactIds: active.map((f) => f.id) }
  }
  if (incomingPrecedence === existingPrecedence) {
    const maxExistingConfidence = Math.max(...active.map((f) => f.confidence))
    if (inc.confidence > maxExistingConfidence) {
      return { kind: 'supersede', oldFactIds: active.map((f) => f.id) }
    }
    return {
      kind: 'conflict',
      factKey: inc.factKey,
      values: [active[0].value, inc.value],
      factIds: active.map((f) => f.id),
    }
  }
  return {
    kind: 'conflict',
    factKey: inc.factKey,
    values: [active[0].value, inc.value],
    factIds: active.map((f) => f.id),
  }
}
