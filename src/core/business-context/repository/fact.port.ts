import type {
  ContextConflict,
  ContextFact,
  JsonValue,
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

export interface PersistFactReconciliationCreate {
  factKey: string
  value: JsonValue
  sourceId: string
  sourceExcerpt: string | null
  evidenceLocator: JsonValue | null
  confidence: number
  supersedesFactId?: string | null
  sourceDocumentId?: string | null
  verificationStatus?: string
  validFrom?: string
  validTo?: string | null
  createdBy?: string
}

export interface PersistFactReconciliationSupersede {
  oldFactId: string
}

export interface PersistFactReconciliationConflict {
  factKey: string
  factIds: string[]
}

export interface PersistFactReconciliationResult {
  created_fact_ids: string[]
  conflict_ids: string[]
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

  persistFactReconciliation(
    workspaceId: string,
    businessId: string,
    supersessionUpdates: PersistFactReconciliationSupersede[],
    factCreations: PersistFactReconciliationCreate[],
    conflicts?: PersistFactReconciliationConflict[],
  ): Promise<ServiceResult<PersistFactReconciliationResult>>
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
