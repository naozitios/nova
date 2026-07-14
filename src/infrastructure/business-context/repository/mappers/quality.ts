import type { CircuitBreaker, QualityGateResult } from '@/core/business-context/types'
import { asJson, asJsonRecord, type Row } from './helpers'

export function mapQualityGateResult(r: Row): QualityGateResult {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    runId: (r.run_id as string) ?? null,
    sourceId: (r.source_id as string) ?? null,
    sourceDocumentId: (r.source_document_id as string) ?? null,
    factId: (r.fact_id as string) ?? null,
    gateScope: r.gate_scope as QualityGateResult['gateScope'],
    gateName: r.gate_name as string,
    status: r.status as QualityGateResult['status'],
    measuredValue: asJson(r.measured_value),
    threshold: asJson(r.threshold),
    reason: (r.reason as string) ?? null,
    createdAt: new Date(r.created_at as string),
  }
}

export function mapCircuitBreaker(r: Row): CircuitBreaker {
  return {
    id: r.id as string,
    workspaceId: (r.workspace_id as string) ?? null,
    provider: r.provider as string,
    state: r.state as CircuitBreaker['state'],
    failureCount: Number(r.failure_count),
    successCount: Number(r.success_count),
    timeoutCount: Number(r.timeout_count),
    quotaExhausted: r.quota_exhausted as boolean,
    openedAt: r.opened_at ? new Date(r.opened_at as string) : null,
    halfOpenAfter: r.half_open_after ? new Date(r.half_open_after as string) : null,
    lastFailureAt: r.last_failure_at ? new Date(r.last_failure_at as string) : null,
    lastSuccessAt: r.last_success_at ? new Date(r.last_success_at as string) : null,
    metadata: asJsonRecord(r.metadata),
  }
}
