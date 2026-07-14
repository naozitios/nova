// ─── Question generation for required gaps ──────────────────────────────────

import type { OnboardingQuestion } from '../types'

const GAP_QUESTIONS: Record<string, { question: string; reason: string; type: string }> = {
  'business.name': {
    question: 'What is your business name?',
    reason: 'Required for business profile',
    type: 'text',
  },
  'business.industry': {
    question: 'What industry does your business operate in?',
    reason: 'Helps target the right audience',
    type: 'text',
  },
  'offers.primary': {
    question: 'What is your primary product or service?',
    reason: 'Core offering for ad targeting',
    type: 'text',
  },
  'offers.pricing': {
    question: 'What is your pricing model or price range?',
    reason: 'Affects conversion optimization',
    type: 'text',
  },
  'customers.target_segment': {
    question: 'Who is your target customer?',
    reason: 'Defines audience for campaigns',
    type: 'text',
  },
  'customers.geography': {
    question: 'What geography do you serve?',
    reason: 'Geographic targeting for ads',
    type: 'text',
  },
  'conversion_journey.primary_cta': {
    question: 'What is your primary call to action?',
    reason: 'Conversion path optimization',
    type: 'text',
  },
  'brand.tone': {
    question: 'What tone of voice does your brand use?',
    reason: 'Creative direction for ad copy',
    type: 'text',
  },
}

export function generateQuestionsForGaps(
  gaps: string[],
  businessId: string,
  workspaceId: string,
  sessionId: string,
): Omit<OnboardingQuestion, 'id'>[] {
  return gaps.map((factKey, index) => {
    const template = GAP_QUESTIONS[factKey] ?? {
      question: `Please provide: ${factKey}`,
      reason: 'Required for business profile',
      type: 'text',
    }
    return {
      workspaceId,
      sessionId,
      businessId,
      factKey,
      questionType: template.type,
      question: template.question,
      options: null,
      reason: template.reason,
      priority: 100 - index,
      status: 'open' as const,
      answer: null,
      answeredBy: null,
      answeredAt: null,
    }
  })
}
