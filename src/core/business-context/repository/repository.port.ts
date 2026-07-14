import type { AuditRepositoryPort } from './audit.port'
import type { BusinessRepositoryPort } from './business.port'
import type {
  ConflictRepositoryPort,
  FactRepositoryPort,
} from './fact.port'
import type {
  JobRepositoryPort,
  ProcessingRunRepositoryPort,
} from './job.port'
import type { OnboardingRepositoryPort } from './onboarding.port'
import type { ProfileRepositoryPort } from './profile.port'
import type {
  CircuitBreakerRepositoryPort,
  QualityGateRepositoryPort,
} from './quality.port'
import type { SourceRepositoryPort } from './source.port'

// ─── Shared utilities ────────────────────────────────────────────────────────

export interface PaginationParams {
  limit: number
  offset: number
}

export type SortDirection = 'asc' | 'desc'

export interface SortParams<T extends string = string> {
  field: T
  direction: SortDirection
}

// ─── Aggregate port ──────────────────────────────────────────────────────────

export interface RepositoryPort
  extends BusinessRepositoryPort,
    OnboardingRepositoryPort,
    SourceRepositoryPort,
    FactRepositoryPort,
    ConflictRepositoryPort,
    ProfileRepositoryPort,
    JobRepositoryPort,
    ProcessingRunRepositoryPort,
    QualityGateRepositoryPort,
    CircuitBreakerRepositoryPort,
    AuditRepositoryPort {}
