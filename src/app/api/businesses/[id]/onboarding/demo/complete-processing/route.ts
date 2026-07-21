import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../../_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { DEMO_BUSINESS_ID, DEMO_WORKSPACE_ID } from '@/lib/demo-user'

const DEMO_COMPILED_PROFILE = {
  summary:
    'Demo Agency is a B2B services company that helps mid-market teams ship faster by pairing engineering, design, and product strategy under one roof.',
  offerings: [
    'Fractional product teams',
    'Design systems and UI engineering',
    'Growth experimentation',
    'Internal tool modernization',
  ],
  value_propositions: [
    'Cross-functional pods that ship outcomes in 6-week cycles',
    'Senior-only staffing with no offshore hand-offs',
    'Transparent metrics dashboard with weekly reviews',
  ],
  target_audiences: [
    'Series A–C SaaS founders',
    'Heads of product at mid-market companies',
    'Agency operators building productized services',
  ],
  funnel_goal: 'Book 8 qualified sales conversations per month',
  target_cpa: '$220',
}

const DEMO_QUESTIONS: Array<{ fact_key: string; question: string; question_type: string; options: string[] }> = []

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  if (businessId !== DEMO_BUSINESS_ID) {
    return errorResponse(403, 'NOT_DEMO_BUSINESS', 'Demo processing is only available for the demo business')
  }

  const authz = await requireAuthz(req, DEMO_WORKSPACE_ID, 'editor')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()

  const { data: existingSession } = await client
    .from('onboarding_sessions')
    .select('id')
    .eq('workspace_id', DEMO_WORKSPACE_ID)
    .eq('business_id', businessId)
    .limit(1)
    .maybeSingle()

  if (!existingSession) {
    const { error: sessionErr } = await client.from('onboarding_sessions').insert({
      workspace_id: DEMO_WORKSPACE_ID,
      business_id: businessId,
      status: 'awaiting_review',
      current_step: 'extract_facts',
      started_by: authz.ctx.userId,
    })
    if (sessionErr) {
      return errorResponse(500, 'DEMO_SESSION_FAILED', sessionErr.message)
    }
  }

  const { data: sources, error: srcErr } = await client
    .from('context_sources')
    .update({
      status: 'processed',
      current_stage: 'completed',
      terminal_outcome: 'completed',
    })
    .eq('business_id', businessId)
    .in('status', ['registered', 'queued', 'processing'])
    .select('id')

  if (srcErr) {
    return errorResponse(500, 'DEMO_PROCESS_FAILED', srcErr.message)
  }

  await client
    .from('business_profile_versions')
    .upsert(
      {
        workspace_id: DEMO_WORKSPACE_ID,
        business_id: businessId,
        version: 1,
        profile: DEMO_COMPILED_PROFILE,
        status: 'current',
        created_by: authz.ctx.userId,
      },
      { onConflict: 'workspace_id,business_id,version' },
    )

  return jsonResponse({
    completed: (sources ?? []).length,
    compiled_profile: DEMO_COMPILED_PROFILE,
    questions: DEMO_QUESTIONS,
  })
}
