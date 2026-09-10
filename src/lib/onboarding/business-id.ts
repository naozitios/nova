import { DEMO_BUSINESS_ALIAS, DEMO_BUSINESS_ID } from '@/lib/demo-user'

export function resolveOnboardingBusinessId(routeBusinessId: string, loadedBusinessId?: string | null): string {
  if (loadedBusinessId) return loadedBusinessId
  if (routeBusinessId === DEMO_BUSINESS_ALIAS) return DEMO_BUSINESS_ID
  return routeBusinessId
}
