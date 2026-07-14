import type {
  ContextConflict,
  ContextFact,
  ServiceResult,
} from '../types'
import type { PaginationParams } from './repository.port'

export interface FactFilter {
  workspaceId: string
  businessId: string
  factKey?: string
  sourceId?: string
  active?: boolean
}

export interface ConflictFilter {
  workspaceId: string
  businessId: string
  status?: 'open' | 'resolved'
  factKey?: string
}

export interface FactRepositoryPort {
  createContextFact(
    data: Omit<ContextFact, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextFact>>

  getContextFact(
    workspaceId: string,
    factId: string,
  ): Promise<ServiceResult<ContextFact | null>>

  listContextFacts(
    filter: FactFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextFact[]; total: number }>>

  updateContextFact(
    workspaceId: string,
    factId: string,
    data: Partial<
      Pick<
        ContextFact,
        | 'value'
        | 'verificationStatus'
        | 'supersedesFactId'
        | 'validTo'
        | 'confidence'
      >
    >,
  ): Promise<ServiceResult<ContextFact>>
}

export interface ConflictRepositoryPort {
  createContextConflict(
    data: Omit<ContextConflict, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextConflict>>

  getContextConflict(
    workspaceId: string,
    conflictId: string,
  ): Promise<ServiceResult<ContextConflict | null>>

  listContextConflicts(
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextConflict[]; total: number }>>

  resolveContextConflict(
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<ServiceResult<ContextConflict>>
}
