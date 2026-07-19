import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { OnboardingReview } from '@/lib/onboarding/api'
import { BusinessContextReview } from './BusinessContextReview'

const mockReview: OnboardingReview = {
  profile: {
    business: { name: 'Acme Corp', industry: 'Technology' },
    offers: { product: 'Widget Platform', pricing: ['Basic', 'Pro'] },
  },
  unresolvedFields: [],
  warnings: [],
  sources: [
    { id: 'src-1', name: 'Company Website', type: 'website', status: 'processed' },
  ],
  questions: [
    { factKey: 'offers.pricing', question: 'What pricing model?', answer: null },
  ],
}

function render(review: OnboardingReview, canApprove = true) {
  return renderToStaticMarkup(
    <BusinessContextReview review={review} canApprove={canApprove} />,
  )
}

describe('BusinessContextReview', () => {
  it('renders profile sections with field labels and values', () => {
    const html = render(mockReview)
    expect(html).toContain('Business')
    expect(html).toContain('Acme Corp')
    expect(html).toContain('Offers')
    expect(html).toContain('Widget Platform')
  })

  it('renders array values as list items', () => {
    const html = render(mockReview)
    expect(html).toContain('<li>Basic</li>')
    expect(html).toContain('<li>Pro</li>')
  })

  it('renders source name, type, and status', () => {
    const html = render(mockReview)
    expect(html).toContain('Company Website')
    expect(html).toContain('website — processed')
  })

  it('renders warnings list', () => {
    const review = { ...mockReview, warnings: ['Low confidence for offers.pricing'] }
    const html = render(review)
    expect(html).toContain('Warnings')
    expect(html).toContain('Low confidence for offers.pricing')
  })

  it('renders clarifying question', () => {
    const html = render(mockReview)
    expect(html).toContain('Clarifying Questions')
    expect(html).toContain('What pricing model?')
  })

  it('renders empty state when no profile sections', () => {
    const emptyReview = {
      profile: {},
      unresolvedFields: [],
      warnings: [],
      sources: [],
      questions: [],
    }
    const html = render(emptyReview)
    expect(html).toContain('No business context compiled yet.')
  })

  it('renders approval-required notice when canApprove is false', () => {
    const html = render(mockReview, false)
    expect(html).toContain('Workspace admin approval is required')
  })

  it('does not render approval-required notice when canApprove is true', () => {
    const html = render(mockReview, true)
    expect(html).not.toContain('Workspace admin approval is required')
  })

  it('renders Missing Information section for unresolvedFields with humanized dotted keys', () => {
    const review = {
      ...mockReview,
      unresolvedFields: ['offers.pricing_model', 'business.industry'],
    }
    const html = render(review)
    expect(html).toContain('Missing Information')
    expect(html).toContain('Offers / Pricing Model')
    expect(html).toContain('Business / Industry')
  })

  it('renders null profile value as No data', () => {
    const review = {
      ...mockReview,
      profile: { business: { name: null, industry: 'Tech' } },
    }
    const html = render(review)
    expect(html).toContain('No data')
  })

  it('renders question with answer when provided', () => {
    const review = {
      ...mockReview,
      questions: [{ factKey: 'offers.pricing', question: 'Pricing?', answer: 'Tiered' }],
    }
    const html = render(review)
    expect(html).toContain('Tiered')
  })

  it('renders question answer false', () => {
    const review = {
      ...mockReview,
      questions: [{ factKey: 'flag', question: 'Active?', answer: false }],
    }
    const html = render(review)
    expect(html).toContain('false')
  })

  it('renders question answer 0', () => {
    const review = {
      ...mockReview,
      questions: [{ factKey: 'count', question: 'Items?', answer: 0 }],
    }
    const html = render(review)
    expect(html).toContain('Items?')
    expect(html).toMatch(/>0</)
  })

  it('renders object items in profile arrays as JSON', () => {
    const review = {
      ...mockReview,
      profile: {
        offers: { tiers: [{ name: 'A', price: 10 }, { name: 'B', price: 20 }] },
      },
    }
    const html = render(review)
    expect(html).toContain('{&quot;name&quot;:&quot;A&quot;,&quot;price&quot;:10}')
    expect(html).toContain('{&quot;name&quot;:&quot;B&quot;,&quot;price&quot;:20}')
  })

  it('renders object items in question answer arrays as JSON', () => {
    const review = {
      ...mockReview,
      questions: [
        {
          factKey: 'items',
          question: 'List items?',
          answer: [{ id: 1 }, { id: 2 }],
        },
      ],
    }
    const html = render(review)
    expect(html).toContain('{&quot;id&quot;:1}')
    expect(html).toContain('{&quot;id&quot;:2}')
  })

  it('hides null question answers', () => {
    const review = {
      ...mockReview,
      questions: [{ factKey: 'x', question: 'Q?', answer: null }],
    }
    const html = render(review)
    expect(html).not.toMatch(/Q\?[\s\S]*<p[^>]*class="mt-2/)
  })

  it('renders multiple sources', () => {
    const review = {
      ...mockReview,
      sources: [
        { id: 's1', name: 'Website', type: 'website', status: 'processed' },
        { id: 's2', name: 'Brochure', type: 'document', status: 'pending' },
      ],
    }
    const html = render(review)
    expect(html).toContain('Website')
    expect(html).toContain('website — processed')
    expect(html).toContain('Brochure')
    expect(html).toContain('document — pending')
  })
})
