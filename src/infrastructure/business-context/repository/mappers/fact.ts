import type {
  ContextConflict,
  ContextFact,
  OnboardingQuestion,
} from '@/core/business-context/types'
import { asJson, type Row } from './helpers'

export function mapContextFact(r: Row): ContextFact {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    value: asJson(r.value),
    sourceId: r.source_id as string,
    sourceDocumentId: (r.source_document_id as string) ?? null,
    sourceExcerpt: (r.source_excerpt as string) ?? null,
    evidenceLocator: asJson(r.evidence_locator),
    confidence: Number(r.confidence),
    verificationStatus: r.verification_status as ContextFact['verificationStatus'],
    supersedesFactId: (r.supersedes_fact_id as string) ?? null,
    validFrom: new Date(r.valid_from as string),
    validTo: r.valid_to ? new Date(r.valid_to as string) : null,
    createdAt: new Date(r.created_at as string),
    createdBy: r.created_by as string,
  }
}

export function mapContextConflict(r: Row): ContextConflict {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    factIds: (r.fact_ids as string[]) ?? [],
    status: r.status as ContextConflict['status'],
    resolutionFactId: (r.resolution_fact_id as string) ?? null,
    resolutionNote: (r.resolution_note as string) ?? null,
    resolvedBy: (r.resolved_by as string) ?? null,
    createdAt: new Date(r.created_at as string),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
  }
}

export function mapOnboardingQuestion(r: Row): OnboardingQuestion {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    sessionId: r.session_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    questionType: r.question_type as string,
    question: r.question as string,
    options: asJson(r.options),
    reason: r.reason as string,
    priority: Number(r.priority),
    status: r.status as OnboardingQuestion['status'],
    answer: asJson(r.answer),
    answeredBy: (r.answered_by as string) ?? null,
    answeredAt: r.answered_at ? new Date(r.answered_at as string) : null,
  }
}
