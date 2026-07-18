import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { MetaOAuthStatePayload } from './entities'

const HMAC_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'

/** Sign a payload string with HMAC-SHA256. Returns the signature as a base64url string. */
function signOAuthPayload(payload: string): string {
  return createHmac('sha256', HMAC_SECRET).update(payload, 'utf-8').digest('base64url')
}

/** Verify an HMAC-SHA256 signature. Returns the payload and validity, or null if format is invalid. */
export function verifyOAuthSignature(signedPayload: string): { payload: string; valid: boolean } | null {
  const dotIndex = signedPayload.lastIndexOf('.')
  if (dotIndex === -1) return null

  const payload = signedPayload.slice(0, dotIndex)
  const signature = signedPayload.slice(dotIndex + 1)

  if (!payload || !signature) return null

  const expectedSignature = signOAuthPayload(payload)
  try {
    const expectedBuf = Buffer.from(expectedSignature, 'base64url')
    const actualBuf = Buffer.from(signature, 'base64url')
    const valid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
    return { payload, valid }
  } catch {
    return null
  }
}

/** Encode a Meta OAuth state payload as a signed base64url string. Format: payload.signature */
export function encodeMetaOAuthState(input: MetaOAuthStatePayload): string {
  const json = JSON.stringify(input)
  const base64Payload = Buffer.from(json, 'utf-8').toString('base64url')
  const signature = signOAuthPayload(base64Payload)
  return `${base64Payload}.${signature}`
}

/** Decode a signed base64url-encoded Meta OAuth state string. Returns null if signature is invalid or missing required fields. */
export function decodeMetaOAuthState(raw: string): MetaOAuthStatePayload | null {
  try {
    const verification = verifyOAuthSignature(raw)
    if (!verification || !verification.valid) return null

    const json = Buffer.from(verification.payload, 'base64url').toString('utf-8')
    const parsed = JSON.parse(json)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof parsed.stateId !== 'string' ||
      typeof parsed.workspaceId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.nonce !== 'string' ||
      typeof parsed.returnPath !== 'string'
    ) {
      return null
    }
    return parsed as MetaOAuthStatePayload
  } catch {
    return null
  }
}

/** SHA-256 hash of a nonce, returned as a hex string. */
export function hashMetaOAuthNonce(nonce: string): string {
  return createHash('sha256').update(nonce, 'utf-8').digest('hex')
}
