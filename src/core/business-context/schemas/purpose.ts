import { z } from 'zod'

import { ORDERED_PROCESSING_STAGES, SourceProcessingStage } from '../types'
import {
  CompilePurposeSchema,
  JsonValueSchema,
  SourceProcessingStageSchema,
} from './common'

export const ProfileSectionSchema = z.record(z.string(), JsonValueSchema)

export const BusinessProfileSchema = z.object({
  business: ProfileSectionSchema,
  offers: ProfileSectionSchema,
  customers: ProfileSectionSchema,
  conversion_journey: ProfileSectionSchema,
  economics: ProfileSectionSchema,
  brand: ProfileSectionSchema,
  creative_capacity: ProfileSectionSchema,
  measurement: ProfileSectionSchema,
})

// ─── Processing stage order validation ───────────────────────────────────────

export const StageOrderSchema = z.object({
  current: SourceProcessingStageSchema,
  next: SourceProcessingStageSchema,
})

export function isValidStageTransition(
  current: SourceProcessingStage,
  next: SourceProcessingStage,
): boolean {
  const currentIdx = ORDERED_PROCESSING_STAGES.indexOf(current)
  const nextIdx = ORDERED_PROCESSING_STAGES.indexOf(next)
  if (currentIdx === -1 || nextIdx === -1) return false
  return nextIdx === currentIdx + 1
}

export function isTerminalStage(stage: SourceProcessingStage): boolean {
  return stage === SourceProcessingStage.COMPLETED
}
