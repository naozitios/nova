import type { Business, OnboardingSession } from '@/core/business-context/types'
import { asJson, type Row } from './helpers'

export function mapBusiness(r: Row): Business {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    websiteUrl: (r.website_url as string) ?? null,
    status: r.status as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

export function mapOnboardingSession(r: Row): OnboardingSession {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    status: r.status as OnboardingSession['status'],
    currentStep: (r.current_step as string) ?? null,
    startedBy: r.started_by as string,
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
    error: asJson(r.error),
  }
}
