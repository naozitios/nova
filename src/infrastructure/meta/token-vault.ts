import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { TokenVaultPort } from '@/core/meta-data/token-vault.port'

const IV_LENGTH = 12
const FORMAT_PREFIX = 'v1'

export class MetaTokenVault implements TokenVaultPort {
  private readonly rawKey: string

  constructor() {
    const key = process.env.META_ENCRYPTION_KEY
    if (!key) {
      throw new Error('META_ENCRYPTION_KEY is required')
    }
    if (key.length < 32) {
      throw new Error('META_ENCRYPTION_KEY must be at least 32 characters')
    }
    this.rawKey = key
  }

  private deriveKey(): Buffer {
    return createHash('sha256').update(this.rawKey).digest()
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH)
    const key = this.deriveKey()
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${FORMAT_PREFIX}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':')
    if (parts.length !== 4 || parts[0] !== FORMAT_PREFIX) {
      throw new Error('Unsupported ciphertext format')
    }
    const [, ivBase64url, tagBase64url, cipherBase64url] = parts
    if (!ivBase64url || !tagBase64url || !cipherBase64url) {
      throw new Error('Malformed ciphertext')
    }
    const key = this.deriveKey()
    const iv = Buffer.from(ivBase64url, 'base64url')
    const tag = Buffer.from(tagBase64url, 'base64url')
    const encrypted = Buffer.from(cipherBase64url, 'base64url')
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
  }
}
