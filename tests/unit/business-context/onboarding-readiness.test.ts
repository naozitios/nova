import { describe, expect, it } from 'vitest'
import {
  computeOnboardingReadiness,
  type OnboardingReadinessInput,
} from '@/core/business-context/onboarding-readiness'
import type {
  OnboardingSession,
  ContextSource,
  ContextFact,
  ContextConflict,
  BusinessProfileVersion,
} from '@/core/business-context/types'

// ─── Fixtures ───────────────────────────────────────────────────────────────

function session(overrides: Partial<OnboardingSession> = {}): OnboardingSession {
  return {
    id: 'sess-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    status: 'created',
    currentStep: null,
    startedBy: 'user-1',
    startedAt: new Date('2025-01-01'),
    completedAt: null,
    error: null,
    ...overrides,
  }
}

function fact(overrides: Partial<ContextFact> = {}): ContextFact {
  return {
    id: 'f-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    factKey: 'business.name',
    value: 'Acme',
    sourceId: 'src-1',
    sourceDocumentId: null,
    sourceExcerpt: 'Acme',
    evidenceLocator: null,
    confidence: 0.9,
    verificationStatus: 'extracted',
    supersedesFactId: null,
    validFrom: new Date('2025-01-01'),
    validTo: null,
    createdBy: 'system',
    createdAt: new Date('2025-01-01'),
    ...overrides,
  }
}

function input(overrides: Partial<OnboardingReadinessInput> = {}): OnboardingReadinessInput {
  return {
    session: session(),
    sources: [],
    questions: [],
    facts: [],
    conflicts: [],
    activeJobs: [],
    currentVersion: null,
    qualityGateResults: [],
    ...overrides,
  }
}

function processedSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: 's-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceType: 'website',
    sourceName: 'example.com',
    externalReference: null,
    status: 'processed',
    currentStage: null,
    terminalOutcome: 'processed',
    metadata: {},
    collectedAt: new Date(),
    ...overrides,
  }
}

function conflict(overrides: Partial<ContextConflict> = {}): ContextConflict {
  return {
    id: 'c-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    factKey: 'business.name',
    factIds: ['f-1', 'f-2'],
    status: 'open',
    resolutionFactId: null,
    resolutionNote: null,
    resolvedBy: null,
    createdAt: new Date(),
    resolvedAt: null,
    ...overrides,
  }
}

const ALL_FACTS = [
  fact({ factKey: 'business.name', value: 'Acme' }),
  fact({ id: 'f-2', factKey: 'market.primary', value: 'B2B' }),
  fact({ id: 'f-3', factKey: 'advertising.primary_objective', value: 'leads' }),
  fact({ id: 'f-4', factKey: 'business.primary_outcome', value: 'revenue' }),
  fact({ id: 'f-5', factKey: 'economics.monthly_meta_budget', value: 5000 }),
]

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('computeOnboardingReadiness', () => {
  describe('deterministic active-fact selection', () => {
    it('newer null fact does NOT block older non-null fact for same key', () => {
      const older = fact({ id: 'f-older', value: 'Acme', createdAt: new Date('2025-01-01') })
      const newerNull = fact({ id: 'f-newer', value: null, createdAt: new Date('2025-06-01') })
      const result = computeOnboardingReadiness(input({ facts: [older, newerNull] }))
      const biz = result.sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.missingFactKeys).not.toContain('business.name')
    })

    it('superseded facts are excluded from active-fact selection', () => {
      const active = fact({ id: 'f-active', value: 'Active', verificationStatus: 'extracted' })
      const superseded = fact({ id: 'f-sup', value: 'Old', verificationStatus: 'superseded' })
      const result = computeOnboardingReadiness(input({ facts: [active, superseded] }))
      const biz = result.sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.missingFactKeys).not.toContain('business.name')
    })

    it('rejected facts are excluded from active-fact selection', () => {
      const rejected = fact({ id: 'f-rej', value: null, verificationStatus: 'rejected' })
      const result = computeOnboardingReadiness(input({ facts: [rejected] }))
      const biz = result.sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.missingFactKeys).toContain('business.name')
    })
  })

  describe('route stage', () => {
    it('returns business when no sources/jobs', () => {
      expect(computeOnboardingReadiness(input()).routeStage).toBe('business')
    })

    it('returns sources when source processing is incomplete', () => {
      expect(computeOnboardingReadiness(input({ sources: [processedSource({ status: 'processing', terminalOutcome: null })] })).routeStage).toBe('sources')
    })

    it('returns review when all sources terminal and session awaiting review', () => {
      const result = computeOnboardingReadiness(
        input({ sources: [processedSource()], session: session({ status: 'awaiting_review' }) }),
      )
      expect(result.routeStage).toBe('review')
    })

    it('returns context when ready_for_approval', () => {
      const result = computeOnboardingReadiness(input({ session: session({ status: 'ready_for_approval' }) }))
      expect(result.routeStage).toBe('context')
    })

    it('returns complete when approved or currentVersion exists', () => {
      expect(computeOnboardingReadiness(input({ session: session({ status: 'approved' }) })).routeStage).toBe('complete')
      const v: BusinessProfileVersion = {
        id: 'v-1', workspaceId: 'ws-1', businessId: 'biz-1', version: 1,
        profile: {}, profileMarkdown: null, status: 'current', changeSummary: null,
        createdBy: 'user-1', createdAt: new Date(), approvedBy: 'user-1', approvedAt: new Date(),
      }
      expect(computeOnboardingReadiness(input({ currentVersion: v })).routeStage).toBe('complete')
    })
  })

  describe('blockers', () => {
    it('E1: missing evidence source', () => {
      expect(computeOnboardingReadiness(input()).blockers.map((b) => b.code)).toContain('EVIDENCE_SOURCE_REQUIRED')
    })

    it('E3: open conflict blocks', () => {
      expect(computeOnboardingReadiness(input({ conflicts: [conflict()] })).blockers.map((b) => b.code)).toContain('OPEN_CONFLICT')
    })

    it('E4: missing required fact', () => {
      expect(computeOnboardingReadiness(input()).blockers.map((b) => b.code)).toContain('MISSING_REQUIRED_FACT')
    })

    it('E5: disallowed key with null value', () => {
      expect(computeOnboardingReadiness(input({ facts: [fact({ value: null })] })).blockers.map((b) => b.code)).toContain('REQUIRED_KEY_UNKNOWN')
    })

    it('no blockers when all required facts user_verified with evidence source', () => {
      const verifiedFacts = ALL_FACTS.map((f) => ({
        ...f,
        verificationStatus: 'user_verified' as const,
      }))
      const result = computeOnboardingReadiness(input({ sources: [processedSource()], facts: verifiedFacts }))
      expect(result.blockers).toHaveLength(0)
      expect(result.approvalReady).toBe(true)
    })

    it('no blockers when processed meta source satisfies evidence requirement', () => {
      const verifiedFacts = ALL_FACTS.map((f) => ({
        ...f,
        verificationStatus: 'user_verified' as const,
      }))
      const result = computeOnboardingReadiness(
        input({ sources: [processedSource({ sourceType: 'meta' })], facts: verifiedFacts }),
      )
      expect(result.blockers.map((b) => b.code)).not.toContain('EVIDENCE_SOURCE_REQUIRED')
      expect(result.approvalReady).toBe(true)
    })

    it('extracted facts do NOT make approval ready', () => {
      const extractedFacts = ALL_FACTS.map((f) => ({
        ...f,
        verificationStatus: 'extracted' as const,
      }))
      const result = computeOnboardingReadiness(input({ sources: [processedSource()], facts: extractedFacts }))
      expect(result.approvalReady).toBe(false)
      expect(result.blockers.map((b) => b.code)).toContain('MISSING_REQUIRED_FACT')
    })

    it('user-verified null unknown for non-name required key accepted when other facts verified', () => {
      const verifiedFacts = ALL_FACTS.map((f) => ({
        ...f,
        verificationStatus: 'user_verified' as const,
      }))
      // Override market.primary with user-verified null (explicit "unknown")
      const withUnknownMarket = verifiedFacts.map((f) =>
        f.factKey === 'market.primary' ? { ...f, value: null, verificationStatus: 'user_verified' as const } : f,
      )
      const result = computeOnboardingReadiness(input({ sources: [processedSource()], facts: withUnknownMarket }))
      // market.primary null is accepted — no MISSING_REQUIRED_FACT for it
      expect(result.blockers.map((b) => b.code)).not.toContain('MISSING_REQUIRED_FACT')
      // business.name verified with real value — no REQUIRED_KEY_UNKNOWN
      expect(result.blockers.map((b) => b.code)).not.toContain('REQUIRED_KEY_UNKNOWN')
      expect(result.approvalReady).toBe(true)
    })

    it('user-verified null unknown for business.name still blocked', () => {
      const verifiedFacts = ALL_FACTS.map((f) => ({
        ...f,
        verificationStatus: 'user_verified' as const,
      }))
      const withNullName = verifiedFacts.map((f) =>
        f.factKey === 'business.name' ? { ...f, value: null } : f,
      )
      const result = computeOnboardingReadiness(input({ sources: [processedSource()], facts: withNullName }))
      expect(result.blockers.map((b) => b.code)).toContain('REQUIRED_KEY_UNKNOWN')
    })

    it('processed user_answer alone leaves EVIDENCE_SOURCE_REQUIRED', () => {
      const result = computeOnboardingReadiness(
        input({ sources: [processedSource({ sourceType: 'user_answer' })] }),
      )
      expect(result.blockers.map((b) => b.code)).toContain('EVIDENCE_SOURCE_REQUIRED')
    })

    it('processed_with_warnings website clears evidence blocker', () => {
      const result = computeOnboardingReadiness(
        input({ sources: [processedSource({ status: 'processed_with_warnings' })] }),
      )
      expect(result.blockers.map((b) => b.code)).not.toContain('EVIDENCE_SOURCE_REQUIRED')
    })

    it('processing website yields SOURCE_NOT_PROCESSED', () => {
      const result = computeOnboardingReadiness(
        input({ sources: [processedSource({ status: 'processing', terminalOutcome: null })] }),
      )
      expect(result.blockers.map((b) => b.code)).toContain('SOURCE_NOT_PROCESSED')
    })
  })

  describe('section readiness', () => {
    it('returns all four sections', () => {
      expect(computeOnboardingReadiness(input()).sectionReadiness.map((s) => s.section)).toEqual(
        ['business', 'market', 'advertising', 'economics'],
      )
    })

    it('section is incomplete when required fact missing', () => {
      const biz = computeOnboardingReadiness(input()).sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.status).toBe('incomplete')
      expect(biz.missingFactKeys).toContain('business.name')
    })

    it('section is blocked by open conflict', () => {
      const biz = computeOnboardingReadiness(input({ conflicts: [conflict()] })).sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.status).toBe('blocked')
    })

    it('section is ready when all required facts present and no open conflicts', () => {
      const facts = [fact({ factKey: 'business.name', value: 'Acme' }), fact({ id: 'f-2', factKey: 'business.primary_outcome', value: 'revenue' })]
      const biz = computeOnboardingReadiness(input({ facts })).sectionReadiness.find((s) => s.section === 'business')!
      expect(biz.status).toBe('ready')
      expect(biz.missingFactKeys).toHaveLength(0)
    })
  })

  describe('session and approval', () => {
    it('returns session status and id', () => {
      const result = computeOnboardingReadiness(input({ session: session({ status: 'awaiting_review' }) }))
      expect(result.session.id).toBe('sess-1')
      expect(result.session.status).toBe('awaiting_review')
    })

    it('approvalReady tracks blockers', () => {
      expect(computeOnboardingReadiness(input()).approvalReady).toBe(false)
    })
  })
})
