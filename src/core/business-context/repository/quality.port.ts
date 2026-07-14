import type {
  CircuitBreaker,
  QualityGateResult,
  ServiceResult,
} from '../types'
import type { PaginationParams } from './repository.port'

export interface QualityGateFilter {
  workspaceId: string
  businessId: string
  runId?: string
  sourceDocumentId?: string
  factId?: string
  gateScope?: string
  status?: string
}

export interface CircuitBreakerFilter {
  workspaceId?: string | null
  provider: string
  state?: string
}

export interface QualityGateRepositoryPort {
  createQualityGateResult(
    data: Omit<QualityGateResult, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<QualityGateResult>>

  listQualityGateResults(
    filter: QualityGateFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: QualityGateResult[]; total: number }>>
}

export interface CircuitBreakerRepositoryPort {
  getCircuitBreaker(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker | null>>

  upsertCircuitBreaker(
    data: Omit<CircuitBreaker, 'id'>,
  ): Promise<ServiceResult<CircuitBreaker>>
}
