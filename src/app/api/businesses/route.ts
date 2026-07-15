import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  parseJsonBody,
  validateWithSchema,
  requireAuthz,
  createdResponse,
  errorResponse,
} from './_shared'
import { createBusiness } from '@/core/business-context/service'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

const CreateBusinessRequestSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  primary_market: z.string().min(1),
  primary_advertising_objective: z.string().min(1),
  primary_business_outcome: z.string().min(1),
  approximate_monthly_meta_budget: z.number().int().positive(),
  initial_sources: z
    .array(
      z.object({
        source_type: z.string(),
        source_name: z.string().min(1),
        external_reference: z.string().url().optional(),
      }),
    )
    .min(1),
})

export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    const body = await parseJsonBody(req)
    if (!body.ok) return body.response

    const validation = validateWithSchema(CreateBusinessRequestSchema, body.data)
    if (!validation.ok) return validation.response

    const data = validation.data
    const authz = await requireAuthz(req, data.workspace_id, 'editor')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await createBusiness(repo, {
      workspaceId: data.workspace_id,
      name: data.name,
      primaryMarket: data.primary_market,
      primaryAdvertisingObjective: data.primary_advertising_objective,
      primaryBusinessOutcome: data.primary_business_outcome,
      approximateMonthlyMetaBudget: data.approximate_monthly_meta_budget,
      initialSources: data.initial_sources,
    })

    if (!result.ok) {
      return errorResponse(500, result.error.code, result.error.message)
    }

    const b = result.data
    return createdResponse({
      id: b.id,
      workspace_id: b.workspaceId,
      name: b.name,
      ...(b.websiteUrl ? { website_url: b.websiteUrl } : {}),
      status: b.status,
      created_at: b.createdAt.toISOString(),
      updated_at: b.updatedAt.toISOString(),
    })
  }, { operation: 'create_business' as const })
}
