import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { DocumentClass } from './types/remediation-entities'
import type { ServiceResult } from './types/service'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ClassificationProposalInput {
  workspaceId: string
  businessId: string
  filename: string
  mimeType: string
  documentClass: DocumentClass
}

export interface ClassificationProposalConfig {
  signingSecret: string
  ttlMs: number
  nowFn?: () => number
  generateProposalId?: () => string
}

export interface ClassificationProposal {
  proposalId: string
  workspaceId: string
  businessId: string
  normalizedFilename: string
  mimeType: string
  documentClass: DocumentClass
  issuedAt: number
  expiresAt: number
  signature: string
}

export type ClassificationProposalRejection =
  | 'PROPOSAL_FORGED'
  | 'PROPOSAL_EXPIRED'
  | 'PROPOSAL_CROSS_WORKSPACE'
  | 'PROPOSAL_CROSS_BUSINESS'

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizeFilename(filename: string): string {
  return filename.trim().toLowerCase()
}

function computeSignature(
  secret: string,
  proposalId: string,
  workspaceId: string,
  businessId: string,
  normalizedFilename: string,
  mimeType: string,
  documentClass: string,
  issuedAt: number,
  expiresAt: number,
): string {
  const payload = [
    proposalId,
    workspaceId,
    businessId,
    normalizedFilename,
    mimeType,
    documentClass,
    issuedAt,
    expiresAt,
  ].join('\n')
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function verifySignature(
  secret: string,
  proposal: ClassificationProposal,
): boolean {
  const expected = computeSignature(
    secret,
    proposal.proposalId,
    proposal.workspaceId,
    proposal.businessId,
    proposal.normalizedFilename,
    proposal.mimeType,
    proposal.documentClass,
    proposal.issuedAt,
    proposal.expiresAt,
  )
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(proposal.signature, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ── Public API ─────────────────────────────────────────────────────────────

export function createClassificationProposal(
  input: ClassificationProposalInput,
  config: ClassificationProposalConfig,
): ClassificationProposal {
  const now = (config.nowFn ?? Date.now)()
  const proposalId = (config.generateProposalId ?? randomUUID)()
  const normalizedFilename = normalizeFilename(input.filename)
  const expiresAt = now + config.ttlMs
  const signature = computeSignature(
    config.signingSecret,
    proposalId,
    input.workspaceId,
    input.businessId,
    normalizedFilename,
    input.mimeType,
    input.documentClass,
    now,
    expiresAt,
  )

  return {
    proposalId,
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    normalizedFilename,
    mimeType: input.mimeType,
    documentClass: input.documentClass,
    issuedAt: now,
    expiresAt,
    signature,
  }
}

export function acceptClassificationProposal(
  proposal: ClassificationProposal,
  config: ClassificationProposalConfig,
  binding?: { workspaceId?: string; businessId?: string },
): ServiceResult<{ documentClass: DocumentClass; classificationSource: 'system_proposed' }> {
  const now = (config.nowFn ?? Date.now)()

  if (!verifySignature(config.signingSecret, proposal)) {
    return { ok: false, error: { code: 'PROPOSAL_FORGED', message: 'Invalid proposal signature' } }
  }

  if (now > proposal.expiresAt) {
    return { ok: false, error: { code: 'PROPOSAL_EXPIRED', message: 'Proposal has expired' } }
  }

  if (binding?.workspaceId && binding.workspaceId !== proposal.workspaceId) {
    return {
      ok: false,
      error: { code: 'PROPOSAL_CROSS_WORKSPACE', message: 'Proposal belongs to a different workspace' },
    }
  }

  if (binding?.businessId && binding.businessId !== proposal.businessId) {
    return {
      ok: false,
      error: { code: 'PROPOSAL_CROSS_BUSINESS', message: 'Proposal belongs to a different business' },
    }
  }

  return {
    ok: true,
    data: {
      documentClass: proposal.documentClass,
      classificationSource: 'system_proposed',
    },
  }
}

// ── Token encode/decode ──────────────────────────────────────────────────────

export function encodeProposalToken(proposal: ClassificationProposal): string {
  const payload = {
    proposalId: proposal.proposalId,
    documentClass: proposal.documentClass,
    normalizedFilename: proposal.normalizedFilename,
    mimeType: proposal.mimeType,
    workspaceId: proposal.workspaceId,
    businessId: proposal.businessId,
    issuedAt: proposal.issuedAt,
    expiresAt: proposal.expiresAt,
    signature: proposal.signature,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export function decodeProposalToken(
  token: string,
  config: ClassificationProposalConfig,
  binding?: { workspaceId?: string; businessId?: string },
): ServiceResult<ClassificationProposal> {
  let decoded: Record<string, unknown>
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8')
    decoded = JSON.parse(json)
  } catch {
    return { ok: false, error: { code: 'PROPOSAL_TOKEN_INVALID', message: 'Malformed proposal token' } }
  }

  if (
    typeof decoded.proposalId !== 'string' ||
    typeof decoded.documentClass !== 'string' ||
    typeof decoded.normalizedFilename !== 'string' ||
    typeof decoded.mimeType !== 'string' ||
    typeof decoded.workspaceId !== 'string' ||
    typeof decoded.businessId !== 'string' ||
    typeof decoded.issuedAt !== 'number' ||
    typeof decoded.expiresAt !== 'number' ||
    typeof decoded.signature !== 'string'
  ) {
    return { ok: false, error: { code: 'PROPOSAL_TOKEN_INVALID', message: 'Malformed proposal token' } }
  }

  const proposal: ClassificationProposal = {
    proposalId: decoded.proposalId,
    workspaceId: decoded.workspaceId,
    businessId: decoded.businessId,
    normalizedFilename: decoded.normalizedFilename,
    mimeType: decoded.mimeType,
    documentClass: decoded.documentClass as DocumentClass,
    issuedAt: decoded.issuedAt,
    expiresAt: decoded.expiresAt,
    signature: decoded.signature,
  }

  const now = (config.nowFn ?? Date.now)()

  if (!verifySignature(config.signingSecret, proposal)) {
    return { ok: false, error: { code: 'PROPOSAL_FORGED', message: 'Invalid proposal signature' } }
  }

  if (now > proposal.expiresAt) {
    return { ok: false, error: { code: 'PROPOSAL_EXPIRED', message: 'Proposal has expired' } }
  }

  if (binding?.workspaceId && binding.workspaceId !== proposal.workspaceId) {
    return {
      ok: false,
      error: { code: 'PROPOSAL_CROSS_WORKSPACE', message: 'Proposal belongs to a different workspace' },
    }
  }

  if (binding?.businessId && binding.businessId !== proposal.businessId) {
    return {
      ok: false,
      error: { code: 'PROPOSAL_CROSS_BUSINESS', message: 'Proposal belongs to a different business' },
    }
  }

  return { ok: true, data: proposal }
}
