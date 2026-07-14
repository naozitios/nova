// ─── Job runner public API ────────────────────────────────────────────────
//
// Re-exports the JobRunner facade plus the public types and handler
// factories callers need. Handlers are not auto-registered; callers must
// invoke registerExtractionHandlers(runner) to wire them up.

export {
  JobRunner,
  type JobRunnerConfig,
  type JobHandler,
  type StageEventUpdate,
} from './job-runner'

export {
  EXTRACTION_JOB_TYPES,
  type ExtractionJobType,
  createExtractionHandler,
  createQualityGateHandler,
  registerExtractionHandlers,
} from './handlers/extract.handler'

export type { StageEventInput } from './stage-events'
