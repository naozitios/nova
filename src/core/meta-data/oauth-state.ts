import { createHash } from 'node:crypto'
import type { MetaOAuthStatePayload } from './entities'

/** Encode a Meta OAuth state payload as a base64url string. */
export function encodeMetaOAuthState(input: MetaOAuthStatePayload): string {
  const json = JSON.stringify(input)
  return Buffer.from(json, 'utf-8')
    .toString('base64url')
}

/** Decode a base64url-encoded Meta OAuth state string. Returns null if invalid or missing required fields. */
export function decodeMetaOAuthState(raw: string): MetaOAuthStatePayload | null {
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf-8')
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
