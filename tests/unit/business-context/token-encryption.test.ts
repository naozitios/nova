import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { encrypt, decrypt, isEncryptedToken } from '@/infrastructure/business-context/token-encryption'

const KEY_A = 'a'.repeat(64)
const KEY_B = 'b'.repeat(64)

beforeAll(() => {
  process.env.META_ENCRYPTION_KEY = KEY_A
})

afterEach(() => {
  process.env.META_ENCRYPTION_KEY = KEY_A
})

describe('token-encryption', () => {
  describe('encrypt', () => {
    it('returns enc:v1: prefixed string', () => {
      const result = encrypt('my-secret-token')
      expect(result).toMatch(/^enc:v1:/)
    })

    it('produces different ciphertext for same input (random IV)', () => {
      const a = encrypt('same-input')
      const b = encrypt('same-input')
      expect(a).not.toBe(b)
    })
  })

  describe('decrypt', () => {
    it('round-trips plaintext through encrypt → decrypt', () => {
      const plaintext = 'EAAxxxxxxxxxxxxxxxxxx'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('round-trips empty string', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe('')
    })

    it('round-trips unicode content', () => {
      const plaintext = '🔐 token with émojis and ñ'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      expect(decrypted).toBe(plaintext)
    })

    it('throws on invalid format (not enc:v1:)', () => {
      expect(() => decrypt('garbage')).toThrow('Invalid encrypted token format')
    })

    it('throws on wrong key (tampered ciphertext)', () => {
      const encrypted = encrypt('secret')
      // Tamper with the ciphertext portion
      const parts = encrypted.split(':')
      const tampered = parts.slice(0, 3).join(':') + ':XXXXXX' + ':' + parts[4]
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws on auth-tag tampering', () => {
      const encrypted = encrypt('auth-tag-test')
      const parts = encrypted.split(':')
      // Flip last char of auth tag
      const tag = Buffer.from(parts[4], 'base64')
      tag[tag.length - 1] ^= 0xff
      const tampered = parts.slice(0, 4).join(':') + ':' + tag.toString('base64')
      expect(() => decrypt(tampered)).toThrow()
    })

    it('throws when decrypting under a different valid key', () => {
      const encryptedWithA = encrypt('key-isolation-test')
      process.env.META_ENCRYPTION_KEY = KEY_B
      expect(() => decrypt(encryptedWithA)).toThrow()
    })
  })

  describe('isEncryptedToken', () => {
    it('returns true for enc:v1: prefixed strings', () => {
      expect(isEncryptedToken('enc:v1:abc')).toBe(true)
    })

    it('returns false for non-encrypted strings', () => {
      expect(isEncryptedToken('plain-token')).toBe(false)
      expect(isEncryptedToken('enc:v2:abc')).toBe(false)
    })
  })
})
