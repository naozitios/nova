import { describe, it, expect } from 'vitest'
import {
  createClassificationProposal,
  acceptClassificationProposal,
  encodeProposalToken,
  decodeProposalToken,
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

describe('createClassificationProposal — proposalId', () => {
  it('generates a proposalId string', () => {
    const proposal = createClassificationProposal(input(), config)
    expect(typeof proposal.proposalId).toBe('string')
    expect(proposal.proposalId.length).toBeGreaterThan(0)
  })

  it('uses deterministic proposalId from config when generateProposalId provided', () => {
    const deterministicConfig: ClassificationProposalConfig = {
      ...config,
      generateProposalId: () => 'fixed-proposal-001',
    }
    const proposal = createClassificationProposal(input(), deterministicConfig)
    expect(proposal.proposalId).toBe('fixed-proposal-001')
  })

  it('different inputs produce different proposalIds when using default generator', () => {
    const proposalA = createClassificationProposal(input(), config)
    const proposalB = createClassificationProposal(input({ businessId: 'biz-002' }), config)
    expect(proposalA.proposalId).not.toBe(proposalB.proposalId)
  })

  it('preserves existing create/accept behavior with proposalId added', () => {
    const proposal = createClassificationProposal(input(), config)
    expect(proposal.workspaceId).toBe('ws-001')
    expect(proposal.documentClass).toBe('brand_deck')
    const result = acceptClassificationProposal(proposal, config)
    expect(result.ok).toBe(true)
  })
})

describe('encodeProposalToken', () => {
  it('encodes a proposal into a base64url token string', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
    // Should be base64url-safe (no +, /, or = padding issues)
    expect(token).not.toMatch(/[+/=]/)
  })

  it('token decodes to a valid JSON object with all required fields', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    expect(decoded).toHaveProperty('proposalId')
    expect(decoded).toHaveProperty('documentClass')
    expect(decoded).toHaveProperty('normalizedFilename')
    expect(decoded).toHaveProperty('mimeType')
    expect(decoded).toHaveProperty('workspaceId')
    expect(decoded).toHaveProperty('businessId')
    expect(decoded).toHaveProperty('issuedAt')
    expect(decoded).toHaveProperty('expiresAt')
    expect(decoded).toHaveProperty('signature')
  })

  it('preserves all proposal fields in the token', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    expect(decoded.proposalId).toBe(proposal.proposalId)
    expect(decoded.documentClass).toBe(proposal.documentClass)
    expect(decoded.normalizedFilename).toBe(proposal.normalizedFilename)
    expect(decoded.mimeType).toBe(proposal.mimeType)
    expect(decoded.workspaceId).toBe(proposal.workspaceId)
    expect(decoded.businessId).toBe(proposal.businessId)
    expect(decoded.issuedAt).toBe(proposal.issuedAt)
    expect(decoded.expiresAt).toBe(proposal.expiresAt)
    expect(decoded.signature).toBe(proposal.signature)
  })
})

describe('decodeProposalToken', () => {
  it('decodes a valid token back to a ClassificationProposal', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const result = decodeProposalToken(token, config)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.proposalId).toBe(proposal.proposalId)
      expect(result.data.workspaceId).toBe('ws-001')
      expect(result.data.businessId).toBe('biz-001')
      expect(result.data.documentClass).toBe('brand_deck')
      expect(result.data.normalizedFilename).toBe('brand deck.pdf')
      expect(result.data.mimeType).toBe('application/pdf')
      expect(result.data.issuedAt).toBe(NOW)
      expect(result.data.expiresAt).toBe(NOW + TTL_MS)
      expect(result.data.signature).toMatch(/^[a-f0-9]{64}$/)
    }
  })

  it('rejects a malformed (non-base64url) token with stable error', () => {
    const result = decodeProposalToken('!!!not-a-valid-token!!!', config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_TOKEN_INVALID')
      expect(typeof result.error.message).toBe('string')
      expect(result.error.message.length).toBeGreaterThan(0)
    }
  })

  it('rejects a token with corrupted signature (tampered payload)', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    // Decode, tamper with a field, re-encode — valid JSON but signature mismatch
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    decoded.documentClass = 'other' // tamper
    const tampered = Buffer.from(JSON.stringify(decoded)).toString('base64url')

    const result = decodeProposalToken(tampered, config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_FORGED')
    }
  })

  it('rejects a token with a tampered proposal id', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    decoded.proposalId = 'attacker-controlled-id'

    const result = decodeProposalToken(
      Buffer.from(JSON.stringify(decoded)).toString('base64url'),
      config,
    )

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROPOSAL_FORGED')
  })

  it('rejects a token with wrong signing secret', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const wrongSecretConfig: ClassificationProposalConfig = {
      ...config,
      signingSecret: 'wrong-secret-!!!!!!!!!!!!!!!!!!!',
    }
    const result = decodeProposalToken(token, wrongSecretConfig)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_FORGED')
    }
  })

  it('rejects an expired token', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const expiredConfig: ClassificationProposalConfig = {
      ...config,
      nowFn: () => NOW + TTL_MS + 1,
    }
    const result = decodeProposalToken(token, expiredConfig)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_EXPIRED')
    }
  })

  it('rejects a token with mismatched workspace binding', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const result = decodeProposalToken(token, config, { workspaceId: 'ws-999' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_CROSS_WORKSPACE')
    }
  })

  it('rejects a token with mismatched business binding', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const result = decodeProposalToken(token, config, { businessId: 'biz-999' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_CROSS_BUSINESS')
    }
  })

  it('returns error (not throw) on completely empty string', () => {
    const result = decodeProposalToken('', config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_TOKEN_INVALID')
    }
  })

  it('returns error (not throw) on arbitrary garbage', () => {
    const result = decodeProposalToken('garbage-data-that-is-not-base64url', config)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROPOSAL_TOKEN_INVALID')
    }
  })

  it('accepts a valid token without binding constraints', () => {
    const proposal = createClassificationProposal(input(), config)
    const token = encodeProposalToken(proposal)
    const result = decodeProposalToken(token, config)
    expect(result.ok).toBe(true)
  })

  it('round-trips proposalId through encode/decode', () => {
    const deterministicConfig: ClassificationProposalConfig = {
      ...config,
      generateProposalId: () => 'rt-proposal-42',
    }
    const proposal = createClassificationProposal(input(), deterministicConfig)
    const token = encodeProposalToken(proposal)
    const result = decodeProposalToken(token, deterministicConfig)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.proposalId).toBe('rt-proposal-42')
    }
  })
})
