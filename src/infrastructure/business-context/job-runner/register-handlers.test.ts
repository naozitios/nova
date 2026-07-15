import { describe, it, expect } from 'vitest'
import type { JobHandler } from './handlers/extract.handler'
import { registerHandlers } from './register-handlers'

describe('registerHandlers', () => {
  it('is a real function', () => {
    expect(typeof registerHandlers).toBe('function')
  })

  it('registers a handler for source_processing job type', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    expect(handlers.has('source_processing')).toBe(true)
  })

  it('registered handler can be looked up by type', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    const handler = handlers.get('source_processing')
    expect(handler).toBeDefined()
    expect(handler).not.toBeNull()
  })

  it('handler has correct interface (is a process function)', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    const handler = handlers.get('source_processing')!
    expect(typeof handler).toBe('function')
  })

  it('multiple handlers can be registered without conflict', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    const handlerCount = handlers.size
    expect(handlerCount).toBeGreaterThanOrEqual(1)

    registerHandlers(handlers)
    expect(handlers.size).toBe(handlerCount)
  })

  it('unknown job types return undefined from get', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    const handler = handlers.get('nonexistent_job_type')
    expect(handler).toBeUndefined()
  })
})
