import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const keyHex = process.env.META_ENCRYPTION_KEY
  if (!keyHex) {
    throw new Error('META_ENCRYPTION_KEY environment variable is required')
  }
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('META_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)')
  }
  return key
}

export interface EncryptedPayload {
  iv: string
  ciphertext: string
  authTag: string
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: enc:v1:{base64(iv)}:{base64(ciphertext)}:{base64(authTag)}
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
  ciphertext += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  return `enc:v1:${iv.toString('base64')}:${ciphertext}:${authTag.toString('base64')}`
}

/**
 * Decrypt an encrypted payload back to plaintext.
 * Expects format: enc:v1:{base64(iv)}:{base64(ciphertext)}:{base64(authTag)}
 */
export function decrypt(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(':')

  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Invalid encrypted token format')
  }

  const iv = Buffer.from(parts[2], 'base64')
  const ciphertext = parts[3]
  const authTag = Buffer.from(parts[4], 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let plaintext = decipher.update(ciphertext, 'base64', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

/**
 * Check if a string is an encrypted token (starts with enc:v1:).
 */
export function isEncryptedToken(value: string): boolean {
  return value.startsWith('enc:v1:')
}
