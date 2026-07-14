import { z } from 'zod'

import {
  CircuitBreakerState,
  CompilePurpose,
  ErrorClass,
  JobStatus,
  OnboardingStatus,
  ProfileVersionStatus,
  QualityGateScope,
  QualityGateStatus,
  SourceProcessingStage,
  SourceType,
  StageEventStatus,
  TerminalSourceOutcome,
  VerificationStatus,
} from '../types'

// ─── Extract enum values as tuples for z.enum() ─────────────────────────────

const OnboardingStatusValues = Object.values(OnboardingStatus)
const SourceTypeValues = Object.values(SourceType)
const SourceProcessingStageValues = Object.values(SourceProcessingStage)
const TerminalSourceOutcomeValues = Object.values(TerminalSourceOutcome)
const JobStatusValues = Object.values(JobStatus)
const VerificationStatusValues = Object.values(VerificationStatus)
const ProfileVersionStatusValues = Object.values(ProfileVersionStatus)
const StageEventStatusValues = Object.values(StageEventStatus)
const QualityGateScopeValues = Object.values(QualityGateScope)
const QualityGateStatusValues = Object.values(QualityGateStatus)
const CircuitBreakerStateValues = Object.values(CircuitBreakerState)
const CompilePurposeValues = Object.values(CompilePurpose)
const ErrorClassValues = Object.values(ErrorClass)

// ─── Enum schemas ────────────────────────────────────────────────────────────

export const OnboardingStatusSchema = z.enum(OnboardingStatusValues as [string, ...string[]])
export const SourceTypeSchema = z.enum(SourceTypeValues as [string, ...string[]])
export const SourceProcessingStageSchema = z.enum(SourceProcessingStageValues as [string, ...string[]])
export const TerminalSourceOutcomeSchema = z.enum(TerminalSourceOutcomeValues as [string, ...string[]])
export const JobStatusSchema = z.enum(JobStatusValues as [string, ...string[]])
export const VerificationStatusSchema = z.enum(VerificationStatusValues as [string, ...string[]])
export const ProfileVersionStatusSchema = z.enum(ProfileVersionStatusValues as [string, ...string[]])
export const StageEventStatusSchema = z.enum(StageEventStatusValues as [string, ...string[]])
export const QualityGateScopeSchema = z.enum(QualityGateScopeValues as [string, ...string[]])
export const QualityGateStatusSchema = z.enum(QualityGateStatusValues as [string, ...string[]])
export const CircuitBreakerStateSchema = z.enum(CircuitBreakerStateValues as [string, ...string[]])
export const CompilePurposeSchema = z.enum(CompilePurposeValues as [string, ...string[]])
export const ErrorClassSchema = z.enum(ErrorClassValues as [string, ...string[]])

// ─── Common primitives ───────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid()
export const TimestampSchema = z.string().datetime()
export const ConfidenceSchema = z.number().min(0).max(1)

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

// ─── Evidence locator ────────────────────────────────────────────────────────

export const EvidenceLocatorSchema = z.object({
  url: z.string().url().optional(),
  page: z.number().int().nonnegative().optional(),
  slide: z.number().int().nonnegative().optional(),
  element: z.string().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
})

// ─── Retry policy ────────────────────────────────────────────────────────────

export const RetryPolicySchema = z.object({
  backoffBaseMs: z.number().int().positive(),
  backoffFactor: z.number().positive(),
  jitterPercent: z.number().min(0).max(1),
  backoffCapMs: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  retryableClasses: z.array(z.string()),
})
