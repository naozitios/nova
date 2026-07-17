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
import { SourceType } from '@/core/business-context/types'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

const SourceTypeSchema = z.enum(Object.values(SourceType) as [SourceType, ...SourceType[]])

const CreateBusinessRequestSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(256),
  primary_market: z.string().min(1),
  primary_advertising_objective: z.string().min(1),
  primary_business_outcome: z.string().min(1),
  approximate_monthly_meta_budget: z.number().int().nonnegative().default(0),
  website_url: z.string().url().nullable().optional(),
  initial_sources: z
    .array(
      z.object({
        source_type: SourceTypeSchema,
        source_name: z.string().min(1),
        external_reference: z.string().url().optional(),
      }),
    )
    .default([]),
})

export async function POST(req: NextRequest) {
  const body = await parseJsonBody(req.clone())
  if (!body.ok) return body.response

  const validation = validateWithSchema(CreateBusinessRequestSchema, body.data)
  if (!validation.ok) return validation.response

  const data = validation.data

  return withIdempotency(req, async () => {
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
      websiteUrl: data.website_url,
      initialSources: (data.initial_sources ?? []).map((s) => ({
        sourceType: s.source_type,
        sourceName: s.source_name,
        externalReference: s.external_reference,
      })),
      createdBy: authz.ctx.userId,
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
  }, { operation: 'create_business' as const, workspaceId: data.workspace_id })
}
