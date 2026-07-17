import { afterEach, describe, expect, it } from 'vitest'
import { MetaTokenVault } from '@/infrastructure/meta/token-vault'

const previousKey = process.env.META_ENCRYPTION_KEY

afterEach(() => {
  if (previousKey === undefined) {
    delete process.env.META_ENCRYPTION_KEY
  } else {
    process.env.META_ENCRYPTION_KEY = previousKey
  }
})

describe('MetaTokenVault', () => {
  it('encrypts without exposing plaintext and decrypts the token', () => {
    process.env.META_ENCRYPTION_KEY = 'test-encryption-key-with-enough-entropy'
    const vault = new MetaTokenVault()

    const encrypted = vault.encrypt('meta-access-token')

    expect(encrypted).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/)
    expect(encrypted).not.toContain('meta-access-token')
    expect(vault.decrypt(encrypted)).toBe('meta-access-token')
  })

  it('uses a random iv for each encryption', () => {
    process.env.META_ENCRYPTION_KEY = 'test-encryption-key-with-enough-entropy'
    const vault = new MetaTokenVault()

    expect(vault.encrypt('same-token')).not.toBe(vault.encrypt('same-token'))
  })

  it('rejects missing encryption key', () => {
    delete process.env.META_ENCRYPTION_KEY

    expect(() => new MetaTokenVault()).toThrow('META_ENCRYPTION_KEY is required')
  })

  it('rejects short encryption key', () => {
    process.env.META_ENCRYPTION_KEY = 'short'

    expect(() => new MetaTokenVault()).toThrow('META_ENCRYPTION_KEY must be at least 32 characters')
  })

  it('does not echo malformed ciphertext in errors', () => {
    process.env.META_ENCRYPTION_KEY = 'test-encryption-key-with-enough-entropy'
    const vault = new MetaTokenVault()

    expect(() => vault.decrypt('meta-access-token')).toThrow('Unsupported ciphertext format')
    try {
      vault.decrypt('meta-access-token')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).not.toContain('meta-access-token')
    }
  })
})
