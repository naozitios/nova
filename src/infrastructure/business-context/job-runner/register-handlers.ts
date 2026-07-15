// ─── Centralized handler registration ──────────────────────────────────────
//
// Registers all job-type handlers with a job runner or handler map.
// Single entry point for wiring handlers during worker bootstrap.

import type { JobHandler } from './handlers/extract.handler'
import { registerExtractionHandlers } from './handlers/extract.handler'
import { createSourceProcessingHandler } from './handlers/source-processing.handler'

export function registerHandlers(handlers: Map<string, JobHandler>): void {
  handlers.set('source_processing', createSourceProcessingHandler())
  registerExtractionHandlers((type, handler) => handlers.set(type, handler))
}
