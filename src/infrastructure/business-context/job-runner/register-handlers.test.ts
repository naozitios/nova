import { describe, it, expect } from 'vitest'
import type { JobHandler } from './handlers/extract.handler'
import { registerHandlers } from './register-handlers'
import { EXTRACTION_JOB_TYPES } from './handlers/extract.handler'

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

  it('registers every EXTRACTION_JOB_TYPES member', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    for (const jobType of EXTRACTION_JOB_TYPES) {
      expect(handlers.has(jobType)).toBe(true)
      expect(typeof handlers.get(jobType)).toBe('function')
    }
  })

  it('registers quality_gate_check handler', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    expect(handlers.has('quality_gate_check')).toBe(true)
    expect(typeof handlers.get('quality_gate_check')).toBe('function')
  })

  it('registers all expected job types (source_processing + extraction + quality_gate)', () => {
    const handlers = new Map<string, JobHandler>()
    registerHandlers(handlers)

    const expected = [
      'source_processing',
      ...EXTRACTION_JOB_TYPES,
      'quality_gate_check',
    ]
    expect(handlers.size).toBe(expected.length)
    for (const jobType of expected) {
      expect(handlers.has(jobType)).toBe(true)
    }
  })
})
