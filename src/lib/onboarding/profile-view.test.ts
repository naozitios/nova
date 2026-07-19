import { describe, expect, it } from 'vitest'
import { toProfileSections } from './profile-view'

const testProfile = {
  business: {
    name: 'Acme Corp',
    industry: 'Technology',
  },
  offers: {
    product: 'Widget Platform',
    pricing: ['Basic', 'Pro', 'Enterprise'],
  },
  customers: {
    segments: ['SMB', 'Enterprise'],
  },
  _provenance: {
    meta: [{ sourceDocumentId: 'doc-1' }],
  },
}

describe('toProfileSections', () => {
  it('returns sections for present profile keys', () => {
    const sections = toProfileSections(testProfile)

    expect(sections.length).toBeGreaterThanOrEqual(3)

    const businessSection = sections.find((s) => s.key === 'business')
    expect(businessSection).toBeDefined()
    expect(businessSection!.title).toBe('Business')
    expect(businessSection!.fields.length).toBe(2)
    expect(businessSection!.fields[0].label).toBe('Name')
    expect(businessSection!.fields[0].value).toBe('Acme Corp')
  })

  it('omits _provenance from fields', () => {
    const sections = toProfileSections(testProfile)
    for (const section of sections) {
      for (const field of section.fields) {
        expect(field.label).not.toBe('_provenance')
        expect(field.label).not.toBe('Provenance')
      }
    }
  })

  it('preserves arrays as values', () => {
    const sections = toProfileSections(testProfile)
    const offers = sections.find((s) => s.key === 'offers')
    expect(offers).toBeDefined()
    const pricing = offers!.fields.find((f) => f.label === 'Pricing')
    expect(pricing).toBeDefined()
    expect(Array.isArray(pricing!.value)).toBe(true)
    expect((pricing!.value as string[])).toEqual(['Basic', 'Pro', 'Enterprise'])
  })

  it('uses REQUIRED_PROFILE_SECTIONS ordering', () => {
    const sections = toProfileSections(testProfile)
    const keys = sections.map((s) => s.key)
    const businessIdx = keys.indexOf('business')
    const offersIdx = keys.indexOf('offers')
    const customersIdx = keys.indexOf('customers')
    expect(businessIdx).toBeLessThan(offersIdx)
    expect(offersIdx).toBeLessThan(customersIdx)
  })

  it('skips sections with no data', () => {
    const sparse = { business: { name: 'Test' } }
    const sections = toProfileSections(sparse)
    expect(sections.length).toBe(1)
    expect(sections[0].key).toBe('business')
  })

  it('skips missing sections entirely', () => {
    const sections = toProfileSections({})
    expect(sections).toHaveLength(0)
  })

  it('does not mutate the input profile', () => {
    const frozen = Object.freeze({ ...testProfile })
    expect(() => toProfileSections(frozen)).not.toThrow()
  })

  it('handles humanizes dotted keys correctly', () => {
    const profile = {
      business: {
        'primary_contact': 'Jane',
        'employee_count': 150,
      },
    }
    const sections = toProfileSections(profile)
    const business = sections[0]
    expect(business.fields[0].label).toBe('Primary Contact')
    expect(business.fields[1].label).toBe('Employee Count')
  })
})
