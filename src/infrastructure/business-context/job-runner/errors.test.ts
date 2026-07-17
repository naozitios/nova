import { describe, expect, it } from 'vitest'
import { extractErrorClass, sanitizeError } from './errors'

describe('extractErrorClass', () => {
  it('maps legacy Office parser errors to non-retryable unsupported_file class', () => {
    const error = Object.assign(new Error('Legacy Office format is unsupported'), {
      code: 'LEGACY_FORMAT_UNSUPPORTED',
    })

    expect(extractErrorClass(error)).toBe('unsupported_file')
  })
})

describe('sanitizeError', () => {
  it('redacts nested sensitive keys and values', () => {
    const sanitized = sanitizeError({
      message: 'provider failed',
      config: {
        apiKey: 'secret-value',
        endpoint: 'https://example.test',
        nested: { serviceRoleKey: 'do-not-persist' },
      },
      attempts: [{ token: 'abc', status: 'failed' }],
    })

    expect(sanitized).toEqual({
      message: 'provider failed',
      config: {
        endpoint: 'https://example.test',
        nested: {},
      },
      attempts: [{ status: 'failed' }],
    })
  })
})
