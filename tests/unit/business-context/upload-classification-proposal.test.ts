import { describe, it, expect } from 'vitest'
import {
  createClassificationProposal,
  acceptClassificationProposal,
  type ClassificationProposalInput,
  type ClassificationProposalConfig,
  type ClassificationProposalRejection,
} from '@/core/business-context/upload-classification-proposal'

const SECRET = 'test-signing-secret-32chars-minimum!!'
const NOW = 1_700_000_000_000
const TTL_MS = 5 * 60 * 1000 // 5 minutes

const config: ClassificationProposalConfig = {
  signingSecret: SECRET,
  ttlMs: TTL_MS,
  nowFn: () => NOW,
}

function input(overrides?: Partial<ClassificationProposalInput>): ClassificationProposalInput {
  return {
    workspaceId: 'ws-001',
    businessId: 'biz-001',
    filename: 'Brand Deck.PDF',
    mimeType: 'application/pdf',
    documentClass: 'brand_deck',
    ...overrides,
  }
}

describe('createClassificationProposal', () => {
  it('produces a signed proposal with bound fields', () => {
    const proposal = createClassificationProposal(input(), config)

    expect(proposal.workspaceId).toBe('ws-001')
    expect(proposal.businessId).toBe('biz-001')
    expect(proposal.normalizedFilename).toBe('brand deck.pdf')
    expect(proposal.mimeType).toBe('application/pdf')
    expect(proposal.documentClass).toBe('brand_deck')
    expect(proposal.issuedAt).toBe(NOW)
    expect(proposal.expiresAt).toBe(NOW + TTL_MS)
    expect(proposal.signature).toMatch(/^[a-f0-9]{64}$/)
  })

  it('normalizes filename (lowercase, trimmed)', () => {
    const proposal = createClassificationProposal(input({ filename: '  Report.DOCX  ' }), config)
    expect(proposal.normalizedFilename).toBe('report.docx')
  })
})

describe('acceptClassificationProposal', () => {
  it('accepts a valid proposal', () => {
    const proposal = createClassificationProposal(input(), config)
    const result = acceptClassificationProposal(proposal, config)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.documentClass).toBe('brand_deck')
      expect(result.data.classificationSource).toBe('system_proposed')
    }
  })

  it('rejects forged signature (wrong secret)', () => {
    const proposal = createClassificationProposal(input(), {
      ...config,
      signingSecret: 'wrong-secret-!!!!!!!!!!!!!!!!!!!',
    })

    // Accept with correct secret — should fail because sig was made with wrong secret
    const result = acceptClassificationProposal(proposal, config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_FORGED')
    }
  })

  it('rejects expired proposal', () => {
    const proposal = createClassificationProposal(input(), config)
    // Simulate time passing beyond TTL
    const expiredConfig: ClassificationProposalConfig = {
      ...config,
      nowFn: () => NOW + TTL_MS + 1,
    }
    const result = acceptClassificationProposal(proposal, expiredConfig)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_EXPIRED')
    }
  })

  it('rejects cross-workspace proposal', () => {
    const proposal = createClassificationProposal(input(), config)
    // Attempt to accept from a different workspace
    const result = acceptClassificationProposal(proposal, config, { workspaceId: 'ws-999' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_CROSS_WORKSPACE')
    }
  })

  it('rejects cross-business proposal', () => {
    const proposal = createClassificationProposal(input(), config)
    const result = acceptClassificationProposal(proposal, config, { businessId: 'biz-999' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_CROSS_BUSINESS')
    }
  })

  it('does not expose normalizedFilename in acceptance — provenance opaque to consumer', () => {
    const proposal = createClassificationProposal(input({ filename: '  Brand Deck.PDF  ' }), config)
    const result = acceptClassificationProposal(proposal, config)
    expect(result.ok).toBe(true)
    if (result.ok) {
      // Consumer receives documentClass + classificationSource but NOT the
      // server-derived normalizedFilename used to compute the signature.
      // This means a client cannot independently verify which normalized
      // filename the server used for provenance; it must trust the proposal
      // blob or query a separate audit trail.
      const keys = Object.keys(result.data) as string[]
      expect(keys).not.toContain('normalizedFilename')
      expect(result.data).toEqual({
        documentClass: 'brand_deck',
        classificationSource: 'system_proposed',
      })
    }
  })

  it('acceptance is replayable — same proposal accepted twice without idempotency', () => {
    const proposal = createClassificationProposal(input(), config)
    const first = acceptClassificationProposal(proposal, config)
    const second = acceptClassificationProposal(proposal, config)
    // Both succeed — no acceptance token, nonce, or idempotency key returned
    // to deduplicate. Downstream must implement its own dedup via
    // proposal.signature or normalizedFilename + businessId composite key.
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.data).toEqual(second.data)
      // No acceptanceId or token to distinguish first from second
      expect(first.data).not.toHaveProperty('acceptanceId')
      expect(first.data).not.toHaveProperty('token')
    }
  })
})
