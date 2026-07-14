// ─── Fact resolver — normalization, deduplication, precedence, conflict ────
//
// Core business logic for resolving extracted facts against existing facts.
// No infrastructure dependencies — pure functions only.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ContextFact,
  ContextConflict,
  JsonValue,
  OnboardingQuestion,
  VerificationStatus,
} from './types'
import type { ExtractedFact } from './extraction.port'

// ─── Source precedence (lower = higher priority) ────────────────────────────

export const SOURCE_PRECEDENCE: Record<string, number> = {
  user_verified: 0,
  authoritative: 1,
  operational: 2,
  website: 3,
  meta: 4,
  llm: 5,
}

// ─── Fact key normalization ─────────────────────────────────────────────────

export function normalizeFactKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/_/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

// ─── Deduplication ──────────────────────────────────────────────────────────

export function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const byKey = new Map<string, ExtractedFact>()
  for (const fact of facts) {
    const norm = normalizeFactKey(fact.factKey)
    const existing = byKey.get(norm)
    if (!existing || fact.confidence > existing.confidence) {
      byKey.set(norm, fact)
    }
  }
  return Array.from(byKey.values())
}

// ─── Material equality check ────────────────────────────────────────────────

function valuesEqual(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ─── Precedence for verification status ─────────────────────────────────────

function verificationPrecedence(status: VerificationStatus): number {
  switch (status) {
    case 'user_verified': return 0
    case 'extracted': return 2
    case 'inferred': return 3
    case 'rejected': return 4
    case 'superseded': return 5
    default: return 2
  }
}

function precedenceSourceOf(fact: ContextFact): string {
  if (fact.verificationStatus === 'user_verified') return 'user_verified'
  if (fact.verificationStatus === 'rejected') return 'rejected'
  // Default: use source type metadata or fall back to 'llm'
  return 'llm'
}

// ─── Resolution result ──────────────────────────────────────────────────────

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

// ─── Resolve facts ──────────────────────────────────────────────────────────

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

  // Group existing facts by normalized key
  const existingByKey = new Map<string, ContextFact[]>()
  for (const fact of existing) {
    const norm = normalizeFactKey(fact.factKey)
    const arr = existingByKey.get(norm) ?? []
    arr.push(fact)
    existingByKey.set(norm, arr)
  }

  for (const inc of incoming) {
    const norm = normalizeFactKey(inc.factKey)
    const existingFacts = existingByKey.get(norm) ?? []

    if (existingFacts.length === 0) {
      // Brand new fact
      result.toCreate.push(inc)
      continue
    }

    // Find active (non-superseded, non-rejected) existing facts
    const active = existingFacts.filter(
      (f) => f.verificationStatus !== 'superseded' && f.verificationStatus !== 'rejected',
    )

    if (active.length === 0) {
      result.toCreate.push(inc)
      continue
    }

    // Check for matching value (confidence bump)
    const matchingValue = active.find((f) => valuesEqual(f.value, inc.value))
    if (matchingValue) {
      result.toUpdate.push({
        factId: matchingValue.id,
        confidence: Math.min(1, Math.max(matchingValue.confidence, inc.confidence)),
        verificationStatus: matchingValue.verificationStatus,
      })
      continue
    }

    // Check if any existing is user_verified (never supersede)
    const hasVerified = active.some((f) => f.verificationStatus === 'user_verified')
    if (hasVerified) {
      result.conflicts.push({
        factKey: inc.factKey,
        values: [active[0].value, inc.value],
        factIds: [...active.map((f) => f.id)],
      })
      continue
    }

    // Check precedence — incoming supersedes existing
    const incomingPrecedence = SOURCE_PRECEDENCE.llm // Default for extracted facts
    const existingPrecedence = SOURCE_PRECEDENCE[precedenceSourceOf(active[0])] ?? SOURCE_PRECEDENCE.llm

    if (incomingPrecedence < existingPrecedence) {
      // Incoming has higher precedence — supersede all active
      for (const f of active) {
        result.superseded.push({ oldFactId: f.id })
      }
      result.toCreate.push(inc)
    } else if (incomingPrecedence === existingPrecedence) {
      // Same precedence — supersede if incoming confidence is strictly higher
      const maxExistingConfidence = Math.max(...active.map((f) => f.confidence))
      if (inc.confidence > maxExistingConfidence) {
        for (const f of active) {
          result.superseded.push({ oldFactId: f.id })
        }
        result.toCreate.push(inc)
      } else {
        result.conflicts.push({
          factKey: inc.factKey,
          values: [active[0].value, inc.value],
          factIds: [...active.map((f) => f.id)],
        })
      }
    } else {
      // Existing has higher precedence — keep existing, conflict
      result.conflicts.push({
        factKey: inc.factKey,
        values: [active[0].value, inc.value],
        factIds: [...active.map((f) => f.id)],
      })
    }
  }

  return result
}

// ─── Conflict detection across active facts ─────────────────────────────────

export function detectConflicts(facts: ContextFact[]): {
  factKey: string
  factIds: string[]
  values: JsonValue[]
}[] {
  const active = facts.filter(
    (f) => f.verificationStatus !== 'superseded' && f.verificationStatus !== 'rejected',
  )

  const byKey = new Map<string, ContextFact[]>()
  for (const fact of active) {
    const norm = normalizeFactKey(fact.factKey)
    const arr = byKey.get(norm) ?? []
    arr.push(fact)
    byKey.set(norm, arr)
  }

  const conflicts: { factKey: string; factIds: string[]; values: JsonValue[] }[] = []

  for (const [key, group] of byKey) {
    if (group.length < 2) continue

    // Check if all values are the same
    const uniqueValues = new Map<string, JsonValue>()
    for (const f of group) {
      const serialized = JSON.stringify(f.value)
      if (!uniqueValues.has(serialized)) {
        uniqueValues.set(serialized, f.value)
      }
    }

    if (uniqueValues.size > 1) {
      conflicts.push({
        factKey: key,
        factIds: group.map((f) => f.id),
        values: Array.from(uniqueValues.values()),
      })
    }
  }

  return conflicts
}

// ─── Question generation for required gaps ──────────────────────────────────

const GAP_QUESTIONS: Record<string, { question: string; reason: string; type: string }> = {
  'business.name': {
    question: 'What is your business name?',
    reason: 'Required for business profile',
    type: 'text',
  },
  'business.industry': {
    question: 'What industry does your business operate in?',
    reason: 'Helps target the right audience',
    type: 'text',
  },
  'offers.primary': {
    question: 'What is your primary product or service?',
    reason: 'Core offering for ad targeting',
    type: 'text',
  },
  'offers.pricing': {
    question: 'What is your pricing model or price range?',
    reason: 'Affects conversion optimization',
    type: 'text',
  },
  'customers.target_segment': {
    question: 'Who is your target customer?',
    reason: 'Defines audience for campaigns',
    type: 'text',
  },
  'customers.geography': {
    question: 'What geography do you serve?',
    reason: 'Geographic targeting for ads',
    type: 'text',
  },
  'conversion_journey.primary_cta': {
    question: 'What is your primary call to action?',
    reason: 'Conversion path optimization',
    type: 'text',
  },
  'brand.tone': {
    question: 'What tone of voice does your brand use?',
    reason: 'Creative direction for ad copy',
    type: 'text',
  },
}

export function generateQuestionsForGaps(
  gaps: string[],
  businessId: string,
  workspaceId: string,
  sessionId: string,
): Omit<OnboardingQuestion, 'id'>[] {
  return gaps.map((factKey, index) => {
    const template = GAP_QUESTIONS[factKey] ?? {
      question: `Please provide: ${factKey}`,
      reason: 'Required for business profile',
      type: 'text',
    }
    return {
      workspaceId,
      sessionId,
      businessId,
      factKey,
      questionType: template.type,
      question: template.question,
      options: null,
      reason: template.reason,
      priority: 100 - index,
      status: 'open' as const,
      answer: null,
      answeredBy: null,
      answeredAt: null,
    }
  })
}
