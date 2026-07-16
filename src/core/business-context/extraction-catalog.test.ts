import { describe, it, expect } from 'vitest'
import {
  ExtractionCatalog,
  getCatalog,
  getCatalogVersion,
  listFactKeys,
  validateFactKey,
  buildPromptTemplate,
  REQUIRED_SECTIONS,
  type CatalogEntry,
} from './extraction-catalog'

describe('ExtractionCatalog — versioned taxonomy', () => {
  it('returns a catalog with version string', () => {
    const catalog = getCatalog()
    expect(catalog).toBeDefined()
    expect(catalog.version).toBeDefined()
    expect(typeof catalog.version).toBe('string')
  })

  it('returns the current catalog version', () => {
    const version = getCatalogVersion()
    expect(version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('catalog has entries for all required profile sections', () => {
    const catalog = getCatalog()
    for (const section of REQUIRED_SECTIONS) {
      expect(catalog.entries).toHaveProperty(section)
      expect(catalog.entries[section]).toBeDefined()
    }
  })

  it('each catalog entry has version, factKeys, and prompt hint', () => {
    const catalog = getCatalog()
    for (const [section, entry] of Object.entries(catalog.entries)) {
      expect(entry).toHaveProperty('factKeys')
      expect(Array.isArray(entry.factKeys)).toBe(true)
      expect(entry.factKeys.length).toBeGreaterThan(0)
      expect(typeof entry.promptHint).toBe('string')
      expect(entry.promptHint.length).toBeGreaterThan(0)
    }
  })

  it('factKeys are unique within a section', () => {
    const catalog = getCatalog()
    for (const [section, entry] of Object.entries(catalog.entries)) {
      const unique = new Set(entry.factKeys)
      expect(unique.size).toBe(entry.factKeys.length)
    }
  })
})

describe('ExtractionCatalog — fact key validation', () => {
  it('accepts a valid dotted fact key', () => {
    const result = validateFactKey('business.name')
    expect(result.valid).toBe(true)
  })

  it('accepts a deeply nested fact key', () => {
    const result = validateFactKey('offers.pricing.tier_count')
    expect(result.valid).toBe(true)
  })

  it('rejects empty fact key', () => {
    const result = validateFactKey('')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.reason).toBeDefined()
    }
  })

  it('rejects fact key with leading/trailing dot', () => {
    const result = validateFactKey('.business.name')
    expect(result.valid).toBe(false)
  })

  it('rejects fact key with uppercase', () => {
    const result = validateFactKey('Business.Name')
    expect(result.valid).toBe(false)
  })

  it('rejects fact key with spaces', () => {
    const result = validateFactKey('business . name')
    expect(result.valid).toBe(false)
  })

  it('rejects fact key with double dots', () => {
    const result = validateFactKey('business..name')
    expect(result.valid).toBe(false)
  })
})

describe('ExtractionCatalog — listFactKeys', () => {
  it('returns all registered fact keys across sections', () => {
    const keys = listFactKeys()
    expect(keys.length).toBeGreaterThan(0)
    for (const k of keys) {
      expect(typeof k).toBe('string')
      expect(k.length).toBeGreaterThan(0)
    }
  })

  it('fact keys match the catalog entries', () => {
    const catalog = getCatalog()
    const keys = listFactKeys()
    const expected = Object.values(catalog.entries).flatMap((e) => e.factKeys)
    expect(keys.sort()).toEqual(expected.sort())
  })
})

describe('ExtractionCatalog — versioned entries', () => {
  it('catalog entry version matches catalog version', () => {
    const catalog = getCatalog()
    for (const [section, entry] of Object.entries(catalog.entries)) {
      expect(entry.version).toBe(catalog.version)
    }
  })

  it('returns empty factKeys for unknown section', () => {
    const catalog = getCatalog()
    const entry = catalog.entries['nonexistent_section' as keyof typeof catalog.entries]
    expect(entry).toBeUndefined()
  })
})

describe('ExtractionCatalog — prompt template', () => {
  it('generates a prompt template string', () => {
    const template = buildPromptTemplate('business')
    expect(typeof template).toBe('string')
    expect(template.length).toBeGreaterThan(0)
  })

  it('template mentions the section name', () => {
    const template = buildPromptTemplate('business')
    expect(template.toLowerCase()).toContain('business')
  })

  it('template includes fact key list', () => {
    const template = buildPromptTemplate('offers')
    expect(template).toContain('factKey')
  })

  it('returns empty string for unknown section', () => {
    const template = buildPromptTemplate('nonexistent')
    expect(template).toBe('')
  })

  it('template includes confidence instruction', () => {
    const template = buildPromptTemplate('customers')
    expect(template.toLowerCase()).toContain('confidence')
  })
})

describe('ExtractionCatalog — REQUIRED_SECTIONS constant', () => {
  it('matches the profile sections', () => {
    expect(REQUIRED_SECTIONS).toContain('business')
    expect(REQUIRED_SECTIONS).toContain('offers')
    expect(REQUIRED_SECTIONS).toContain('customers')
    expect(REQUIRED_SECTIONS).toContain('conversion_journey')
    expect(REQUIRED_SECTIONS).toContain('economics')
    expect(REQUIRED_SECTIONS).toContain('brand')
    expect(REQUIRED_SECTIONS).toContain('creative_capacity')
    expect(REQUIRED_SECTIONS).toContain('measurement')
  })

  it('has exactly 8 sections', () => {
    expect(REQUIRED_SECTIONS).toHaveLength(8)
  })
})
