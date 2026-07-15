import { describe, expect, it } from 'vitest'
import {
  getClassPrompt,
  getUnsupportedClassError,
  listSupportedClasses,
  type PromptCatalogClass,
} from '@/infrastructure/business-context/extraction/prompt-catalog'

// ─── Supported class → prompt ─────────────────────────────────────────────

describe('getClassPrompt', () => {
  it('returns a system prompt string for every supported extraction class', () => {
    for (const cls of listSupportedClasses()) {
      const prompt = getClassPrompt(cls)
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    }
  })

  it('includes JSON output schema instruction', () => {
    const prompt = getClassPrompt('extract_business_offers')
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('facts')
    expect(prompt).toContain('conflicts')
    expect(prompt).toContain('warnings')
  })

  it('includes evidence and confidence instructions', () => {
    const prompt = getClassPrompt('extract_customers')
    expect(prompt).toContain('confidence')
    expect(prompt).toContain('sourceExcerpt')
  })

  it('includes untrusted-content warning', () => {
    const prompt = getClassPrompt('extract_conversion_journey')
    expect(prompt).toMatch(/untrusted/i)
  })

  it('embeds catalog version from core catalog', () => {
    const prompt = getClassPrompt('extract_brand_proof_claims')
    expect(prompt).toContain('v')
    expect(prompt).toMatch(/catalog version/i)
  })

  it('extract_business_offers maps to business and offers sections', () => {
    const prompt = getClassPrompt('extract_business_offers')
    expect(prompt).toContain('business.name')
    expect(prompt).toContain('offers.product_names')
  })

  it('extract_customers maps to customers section', () => {
    const prompt = getClassPrompt('extract_customers')
    expect(prompt).toContain('customers.primary_persona')
  })

  it('extract_conversion_journey maps to conversion_journey section', () => {
    const prompt = getClassPrompt('extract_conversion_journey')
    expect(prompt).toContain('conversion_journey.funnel_stages')
  })

  it('extract_brand_proof_claims maps to brand section', () => {
    const prompt = getClassPrompt('extract_brand_proof_claims')
    expect(prompt).toContain('brand.positioning_statement')
  })
})

// ─── Unsupported class error ──────────────────────────────────────────────

describe('getUnsupportedClassError', () => {
  it('returns a stable error object for any unsupported class', () => {
    const err = getUnsupportedClassError('extract_future_thing' as PromptCatalogClass)
    expect(err.code).toBe('UNSUPPORTED_EXTRACTION_CLASS')
    expect(err.message).toContain('extract_future_thing')
    expect(err.supported).toEqual(listSupportedClasses())
  })

  it('error object is stable across calls', () => {
    const a = getUnsupportedClassError('nope' as PromptCatalogClass)
    const b = getUnsupportedClassError('nope' as PromptCatalogClass)
    expect(a).toEqual(b)
  })
})

// ─── listSupportedClasses ─────────────────────────────────────────────────

describe('listSupportedClasses', () => {
  it('returns the canonical extraction class names', () => {
    const classes = listSupportedClasses()
    expect(classes).toContain('extract_business_offers')
    expect(classes).toContain('extract_customers')
    expect(classes).toContain('extract_conversion_journey')
    expect(classes).toContain('extract_brand_proof_claims')
    expect(classes).toContain('extract_gaps_contradictions')
    expect(classes).toContain('synthesize_profile')
    expect(classes.length).toBeGreaterThan(0)
  })
})
