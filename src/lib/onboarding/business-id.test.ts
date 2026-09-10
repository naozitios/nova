import { describe, expect, it } from 'vitest'
import { DEMO_BUSINESS_ID } from '@/lib/demo-user'
import { resolveOnboardingBusinessId } from './business-id'

describe('resolveOnboardingBusinessId', () => {
  it('uses the loaded canonical business ID before the route param', () => {
    expect(resolveOnboardingBusinessId('biz_nova_media', '7147f5a6-d60a-42db-8ffa-f49bc01307e4')).toBe(
      '7147f5a6-d60a-42db-8ffa-f49bc01307e4',
    )
  })

  it('maps the demo alias to the backend UUID', () => {
    expect(resolveOnboardingBusinessId('biz_nova_media')).toBe(DEMO_BUSINESS_ID)
  })

  it('keeps real business UUIDs unchanged', () => {
    expect(resolveOnboardingBusinessId('7147f5a6-d60a-42db-8ffa-f49bc01307e4')).toBe(
      '7147f5a6-d60a-42db-8ffa-f49bc01307e4',
    )
  })
})
