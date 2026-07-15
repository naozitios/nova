import { SourceProcessingStage } from '../types'

export const NO_PARSE_TYPES = new Set(['user_answer'])

export const PIPELINE_STAGES = [
  'claim',
  'parse',
  'extract',
  'reconcile',
  'quality',
] as const

export type PipelineStage = (typeof PIPELINE_STAGES)[number]

export function mapStageName(pipelineStage: PipelineStage): SourceProcessingStage {
  switch (pipelineStage) {
    case 'claim': return SourceProcessingStage.ACQUIRING
    case 'parse': return SourceProcessingStage.PARSING
    case 'extract': return SourceProcessingStage.EXTRACTING
    case 'reconcile': return SourceProcessingStage.RECONCILING
    case 'quality': return SourceProcessingStage.QUALITY_CHECKING
  }
}

export function getPipelineType(sourceType: string): string {
  switch (sourceType) {
    case 'website': return 'website'
    case 'meta': return 'meta'
    case 'user_answer': return 'manual'
    default: return 'upload'
  }
}
