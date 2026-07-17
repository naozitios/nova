import { SourceProcessingStage } from './enums'

export const ContextPurpose = {
  CAMPAIGN_SETUP: 'campaign_setup',
  PERFORMANCE_ANALYSIS: 'performance_analysis',
  OPTIMIZATION: 'optimization',
  HYPOTHESIS_GENERATION: 'hypothesis_generation',
  CREATIVE_BRIEF: 'creative_brief',
  TRACKING_AUDIT: 'tracking_audit',
} as const

export type ContextPurpose =
  (typeof ContextPurpose)[keyof typeof ContextPurpose]

export const REQUIRED_PROFILE_SECTIONS = [
  'business',
  'offers',
  'customers',
  'conversion_journey',
  'economics',
  'brand',
  'creative_capacity',
  'measurement',
  'market',
  'advertising',
] as const

export type ProfileSectionName =
  (typeof REQUIRED_PROFILE_SECTIONS)[number]

/** Allowed profile sections per context purpose (FR-030). */
export const PURPOSE_SECTIONS: Record<ContextPurpose, readonly ProfileSectionName[]> =
  {
    [ContextPurpose.CAMPAIGN_SETUP]: [
      'offers',
      'customers',
      'brand',
      'creative_capacity',
      'market',
      'advertising',
    ],
    [ContextPurpose.PERFORMANCE_ANALYSIS]: [
      'economics',
      'measurement',
      'offers',
    ],
    [ContextPurpose.OPTIMIZATION]: [
      'offers',
      'customers',
      'conversion_journey',
    ],
    [ContextPurpose.HYPOTHESIS_GENERATION]: [
      'customers',
      'brand',
      'offers',
    ],
    [ContextPurpose.CREATIVE_BRIEF]: [
      'offers',
      'customers',
      'brand',
      'creative_capacity',
      'conversion_journey',
    ],
    [ContextPurpose.TRACKING_AUDIT]: ['measurement', 'economics'],
  }

export const ORDERED_PROCESSING_STAGES: readonly SourceProcessingStage[] = [
  SourceProcessingStage.REGISTERED,
  SourceProcessingStage.QUEUED,
  SourceProcessingStage.ACQUIRING,
  SourceProcessingStage.STORED,
  SourceProcessingStage.PARSING,
  SourceProcessingStage.NORMALIZING,
  SourceProcessingStage.EXTRACTING,
  SourceProcessingStage.RECONCILING,
  SourceProcessingStage.QUALITY_CHECKING,
  SourceProcessingStage.COMPLETED,
] as const
