// ─── Pure onboarding readiness derivation ────────────────────────────────────
// B37: Persisted input → lifecycle/status, blockers, approval readiness, route stage.
// No repository calls. Stateless. Deterministic.

import type {
  OnboardingSession,
  ContextSource,
  ContextFact,
  ContextConflict,
  ContextJob,
  BusinessProfileVersion,
  QualityGateResult,
  OnboardingStatus,
} from './types'

// ─── Constants ──────────────────────────────────────────────────────────────

const REQUIRED_FACT_KEYS = [
  'business.name',
  'market.primary',
  'advertising.primary_objective',
  'business.primary_outcome',
  'economics.monthly_meta_budget',
]

const UNKNOWN_DISALLOWED_KEYS = ['business.name']

const EVIDENCE_SOURCE_TYPES = [
  'website',
  'brand_deck',
  'brand_playbook',
  'product_document',
  'campaign_brief',
  'research_document',
  'meta',
]

const TERMINAL_SOURCE_STATUSES = ['processed', 'processed_with_warnings']

const SECTION_MAP: Record<string, string> = {
  'business.name': 'business',
  'market.primary': 'market',
  'advertising.primary_objective': 'advertising',
  'business.primary_outcome': 'business',
  'economics.monthly_meta_budget': 'economics',
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type RouteStage = 'business' | 'sources' | 'review' | 'context' | 'complete'

export type SectionStatus = 'ready' | 'incomplete' | 'blocked'

export interface Blocker {
  code: string
  message: string
  entityId?: string | null
  recommendedAction?: string | null
}

export interface SectionReadiness {
  section: string
  status: SectionStatus
  missingFactKeys: string[]
  conflictCount: number
}

export interface OnboardingReadinessInput {
  session: OnboardingSession
  sources: ContextSource[]
  facts: ContextFact[]
  conflicts: ContextConflict[]
  activeJobs: ContextJob[]
  questions: { status: string }[]
  currentVersion: BusinessProfileVersion | null
  qualityGateResults: QualityGateResult[]
}

export interface OnboardingReadinessResult {
  session: {
    id: string
    status: OnboardingStatus
    currentStep: string | null
  }
  routeStage: RouteStage
  blockers: Blocker[]
  sectionReadiness: SectionReadiness[]
  approvalReady: boolean
  currentProfileVersionId: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic: filter superseded/rejected, then highest confidence per key. */
function pickActiveFacts(facts: ContextFact[]): Map<string, ContextFact> {
  const active = new Map<string, ContextFact>()
  for (const f of facts) {
    if (f.verificationStatus === 'superseded' || f.verificationStatus === 'rejected') {
      continue
    }
    const existing = active.get(f.factKey)
    if (!existing || f.confidence > existing.confidence) {
      active.set(f.factKey, f)
    }
  }
  return active
}

function hasEvidenceSource(sources: ContextSource[]): boolean {
  return sources.some(
    (s) =>
      TERMINAL_SOURCE_STATUSES.includes(s.status) &&
      EVIDENCE_SOURCE_TYPES.includes(s.sourceType),
  )
}

function sourceIsTerminal(s: ContextSource): boolean {
  return TERMINAL_SOURCE_STATUSES.includes(s.status)
}

// ─── Section readiness ──────────────────────────────────────────────────────

const ALL_SECTIONS = ['business', 'market', 'advertising', 'economics']

function computeSectionReadiness(
  facts: ContextFact[],
  conflicts: ContextConflict[],
): SectionReadiness[] {
  const activeFacts = pickActiveFacts(facts)

  return ALL_SECTIONS.map((section) => {
    const requiredKeys = REQUIRED_FACT_KEYS.filter((k) => SECTION_MAP[k] === section)
    const missingFactKeys = requiredKeys.filter((k) => {
      const f = activeFacts.get(k)
      if (!f) return true
      if (f.value === null || f.value === undefined) {
        return f.verificationStatus !== 'user_verified'
      }
      return false
    })

    const openConflicts = conflicts.filter(
      (c) => SECTION_MAP[c.factKey] === section && c.status === 'open',
    )

    let status: SectionStatus
    if (openConflicts.length > 0) {
      status = 'blocked'
    } else if (missingFactKeys.length > 0) {
      status = 'incomplete'
    } else {
      status = 'ready'
    }

    return { section, status, missingFactKeys, conflictCount: openConflicts.length }
  })
}

// ─── Blockers ───────────────────────────────────────────────────────────────

function computeBlockers(
  sources: ContextSource[],
  facts: ContextFact[],
  conflicts: ContextConflict[],
  qualityGateResults: QualityGateResult[],
): Blocker[] {
  const blockers: Blocker[] = []
  const activeFacts = pickActiveFacts(facts)

  // E1: No evidence source
  if (!hasEvidenceSource(sources)) {
    blockers.push({
      code: 'EVIDENCE_SOURCE_REQUIRED',
      message:
        'At least one completed website, document, or Meta source is required. User answer and system inference sources cannot satisfy this requirement alone.',
    })
  }

  // E2: Evidence sources still processing (user_answer / system_inference never enter pipeline)
  for (const s of sources) {
    if (EVIDENCE_SOURCE_TYPES.includes(s.sourceType) && !sourceIsTerminal(s)) {
      blockers.push({
        code: 'SOURCE_NOT_PROCESSED',
        message: `Source "${s.sourceName}" (${s.sourceType}) is not yet processed (current status: ${s.status}).`,
        entityId: s.id,
      })
    }
  }

  // E3: Open conflicts
  for (const c of conflicts) {
    if (c.status === 'open') {
      blockers.push({
        code: 'OPEN_CONFLICT',
        message: `Open conflict on fact key "${c.factKey}". Resolve before approval.`,
        entityId: c.id,
      })
    }
  }

  // E4: Required facts must be user_verified (or explicit user-authored unknown)
  for (const key of REQUIRED_FACT_KEYS) {
    const f = activeFacts.get(key)
    if (!f || f.verificationStatus !== 'user_verified') {
      blockers.push({
        code: 'MISSING_REQUIRED_FACT',
        message: `Required fact "${key}" must be user-verified.`,
      })
    }
  }

  // E5: Disallowed key with null value
  for (const key of UNKNOWN_DISALLOWED_KEYS) {
    const f = activeFacts.get(key)
    if (f && (f.value === null || f.value === undefined)) {
      blockers.push({
        code: 'REQUIRED_KEY_UNKNOWN',
        message: `Required fact "${key}" cannot be marked as unknown.`,
      })
    }
  }

  // E6: Quality gate blocking failures
  for (const qg of qualityGateResults) {
    if (qg.status === 'failed_blocking') {
      blockers.push({
        code: 'QUALITY_GATE_BLOCKING',
        message: `Quality gate "${qg.gateName}" failed (blocking). ${qg.reason ?? 'No reason provided.'}`,
        entityId: qg.sourceId,
      })
    }
  }

  return blockers
}

// ─── Route stage ────────────────────────────────────────────────────────────

function computeRouteStage(
  session: OnboardingSession,
  sources: ContextSource[],
  activeJobs: ContextJob[],
  questions: { status: string }[],
  currentVersion: BusinessProfileVersion | null,
): RouteStage {
  // Complete: session approved or version exists
  if (session.status === 'approved' || currentVersion !== null) {
    return 'complete'
  }

  // Context: ready_for_approval
  if (session.status === 'ready_for_approval') {
    return 'context'
  }

  // Review: all sources terminal and session awaiting review/answers
  const allTerminal = sources.length > 0 && sources.every(sourceIsTerminal)
  if (
    allTerminal &&
    (session.status === 'awaiting_review' || session.status === 'awaiting_answers')
  ) {
    return 'review'
  }

  // Review: all sources terminal with open questions
  if (allTerminal && questions.some((q) => q.status === 'open')) {
    return 'review'
  }

  // Sources: sources exist or jobs running
  if (sources.length > 0 || activeJobs.length > 0) {
    return 'sources'
  }

  return 'business'
}

// ─── Main ───────────────────────────────────────────────────────────────────

export function computeOnboardingReadiness(
  input: OnboardingReadinessInput,
): OnboardingReadinessResult {
  const { session, sources, questions, facts, conflicts, activeJobs, currentVersion, qualityGateResults } = input

  const blockers = computeBlockers(sources, facts, conflicts, qualityGateResults)
  const sectionReadiness = computeSectionReadiness(facts, conflicts)
  const routeStage = computeRouteStage(session, sources, activeJobs, questions, currentVersion)

  return {
    session: {
      id: session.id,
      status: session.status,
      currentStep: session.currentStep,
    },
    routeStage,
    blockers,
    sectionReadiness,
    approvalReady: blockers.length === 0,
    currentProfileVersionId: currentVersion?.id ?? null,
  }
}
