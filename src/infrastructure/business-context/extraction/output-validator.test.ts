import { describe, it, expect } from 'vitest'
import {
  validateOutput,
  repairOutput,
  type LlmRawOutput,
} from './output-validator'
import type { ExtractedFact } from '../../../core/business-context/extraction.port'
import type { EvidenceLocator, JsonValue } from '../../../core/business-context/types/entities'

// ─── Fake LLM response ──────────────────────────────────────────────────────

function makeLlmOutput(overrides?: Partial<LlmRawOutput>): LlmRawOutput {
  return {
    facts: [
      {
        factKey: 'business.name',
        value: 'Acme Corp',
        confidence: 0.95,
        sourceExcerpt: 'Acme Corp was founded in 2020.',
        evidenceLocator: { url: 'https://example.com/about', page: 1 },
      },
    ],
    conflicts: [],
    warnings: [],
    ...overrides,
  }
}

function makeBrokenOutput(): LlmRawOutput {
  return {
    facts: [
      {
        factKey: 'offers.pricing',
        value: { monthly: 99 },
        confidence: 0.75,
        sourceExcerpt: null,
        evidenceLocator: null,
      },
    ],
    conflicts: [],
    warnings: [],
  }
}

// ─── Tests: strict key validation ────────────────────────────────────────────

describe('validateOutput — strict keys', () => {
  it('accepts output with all required top-level keys', () => {
    const result = validateOutput(makeLlmOutput())
    expect(result.valid).toBe(true)
  })

  it('rejects output missing facts array', () => {
    const raw = { conflicts: [], warnings: [] } as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_KEY', field: 'facts' }),
    )
  })

  it('rejects output missing conflicts array', () => {
    const raw = { facts: [], warnings: [] } as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_KEY', field: 'conflicts' }),
    )
  })

  it('rejects output missing warnings array', () => {
    const raw = { facts: [], conflicts: [] } as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_KEY', field: 'warnings' }),
    )
  })

  it('rejects extra top-level keys', () => {
    const raw = { ...makeLlmOutput(), extra: true } as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_KEY', field: 'extra' }),
    )
  })
})

// ─── Tests: strict type validation ───────────────────────────────────────────

describe('validateOutput — strict types', () => {
  it('rejects fact with empty factKey', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: '',
          value: 'Acme',
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: null,
        },
      ],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'facts[0].factKey' }),
    )
  })

  it('rejects fact with non-string factKey', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: 123 as unknown as string,
          value: 'Acme',
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: null,
        },
      ],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'facts[0].factKey' }),
    )
  })

  it('rejects fact with non-number confidence', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: 'business.name',
          value: 'Acme',
          confidence: 'high' as unknown as number,
          sourceExcerpt: null,
          evidenceLocator: null,
        },
      ],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'facts[0].confidence' }),
    )
  })

  it('rejects fact with missing value', () => {
    const raw = {
      facts: [{ factKey: 'business.name', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null }],
      conflicts: [],
      warnings: [],
    } as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'MISSING_KEY', field: 'facts[0].value' }),
    )
  })

  it('rejects conflict with non-string factKey', () => {
    const raw = makeLlmOutput({
      conflicts: [{ factKey: 42 as unknown as string, values: ['a', 'b'] }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'conflicts[0].factKey' }),
    )
  })

  it('rejects conflict with non-array values', () => {
    const raw = makeLlmOutput({
      conflicts: [{ factKey: 'business.name', values: 'not-an-array' as unknown as JsonValue[] }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'conflicts[0].values' }),
    )
  })

  it('rejects warning with non-string element', () => {
    const raw = makeLlmOutput({
      warnings: [123 as unknown as string],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'INVALID_TYPE', field: 'warnings[0]' }),
    )
  })
})

// ─── Tests: confidence bounds ────────────────────────────────────────────────

describe('validateOutput — confidence bounds', () => {
  it('rejects confidence below 0', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: -0.1, sourceExcerpt: null, evidenceLocator: null }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'OUT_OF_RANGE', field: 'facts[0].confidence' }),
    )
  })

  it('rejects confidence above 1', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: 1.5, sourceExcerpt: null, evidenceLocator: null }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'OUT_OF_RANGE', field: 'facts[0].confidence' }),
    )
  })

  it('accepts confidence at boundary 0', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: 0, sourceExcerpt: null, evidenceLocator: null }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(true)
  })

  it('accepts confidence at boundary 1', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: 1, sourceExcerpt: null, evidenceLocator: null }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(true)
  })
})

// ─── Tests: evidence validation ──────────────────────────────────────────────

describe('validateOutput — evidence presence', () => {
  it('warns when evidenceLocator is null', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: 0.9, sourceExcerpt: 'text', evidenceLocator: null }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'MISSING_EVIDENCE', field: 'facts[0].evidenceLocator' }),
    )
  })

  it('warns when sourceExcerpt is null', () => {
    const raw = makeLlmOutput({
      facts: [{ factKey: 'business.name', value: 'X', confidence: 0.9, sourceExcerpt: null, evidenceLocator: { url: 'https://example.com' } }],
    })
    const result = validateOutput(raw)
    expect(result.valid).toBe(true)
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: 'MISSING_EVIDENCE', field: 'facts[0].sourceExcerpt' }),
    )
  })

  it('no warning when both evidence fields present', () => {
    const raw = makeLlmOutput()
    const result = validateOutput(raw)
    const evidenceWarnings = result.warnings.filter((w) => w.code === 'MISSING_EVIDENCE')
    expect(evidenceWarnings).toHaveLength(0)
  })
})

// ─── Tests: repair ──────────────────────────────────────────────────────────

describe('repairOutput — single repair attempt', () => {
  it('repairs output with missing warnings key', () => {
    const broken = { facts: makeBrokenOutput().facts, conflicts: [] } as unknown as LlmRawOutput
    const repaired = repairOutput(broken)
    expect(repaired).toHaveProperty('warnings')
    expect(Array.isArray(repaired!.warnings)).toBe(true)
  })

  it('repairs fact with confidence out of range', () => {
    const broken = makeBrokenOutput()
    broken.facts[0].confidence = 2.5
    const repaired = repairOutput(broken)
    expect(repaired!.facts[0].confidence).toBeLessThanOrEqual(1)
  })

  it('repairs output by coercing non-array conflicts to array', () => {
    const broken = { ...makeBrokenOutput(), conflicts: 'not-an-array' } as unknown as LlmRawOutput
    const repaired = repairOutput(broken)
    expect(Array.isArray(repaired!.conflicts)).toBe(true)
  })

  it('returns null when repair is impossible', () => {
    const impossible = null as unknown as LlmRawOutput
    const repaired = repairOutput(impossible)
    expect(repaired).toBeNull()
  })
})

// ─── Tests: regression — nested unknown key path + numeric OUT_OF_RANGE ────

describe('validateOutput — regression: nested unknown key path', () => {
  it('returns full dotted path for unknown key inside fact object', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: 'business.name',
          value: 'X',
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: null,
          typo_field: 'oops',
        } as unknown as ExtractedFact,
      ],
    }) as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_KEY', field: 'facts[0].typo_field' }),
    )
  })

  it('returns full dotted path for unknown key inside evidenceLocator', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: 'business.name',
          value: 'X',
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: { url: 'https://example.com', bogus: 123 } as unknown as EvidenceLocator,
        },
      ],
    }) as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'UNKNOWN_KEY', field: 'facts[0].evidenceLocator.bogus' }),
    )
  })
})

describe('validateOutput — regression: numeric OUT_OF_RANGE for non-confidence fields', () => {
  it('returns OUT_OF_RANGE for evidenceLocator.page below 0', () => {
    const raw = makeLlmOutput({
      facts: [
        {
          factKey: 'business.name',
          value: 'X',
          confidence: 0.9,
          sourceExcerpt: null,
          evidenceLocator: { url: 'https://example.com', page: -1 },
        },
      ],
    }) as unknown as LlmRawOutput
    const result = validateOutput(raw)
    expect(result.valid).toBe(false)
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'OUT_OF_RANGE', field: 'facts[0].evidenceLocator.page' }),
    )
  })
})
