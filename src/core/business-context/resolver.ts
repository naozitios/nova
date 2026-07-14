// ─── Fact resolver public surface ───────────────────────────────────────────
//
// Re-exports from the split modules. Kept at the parent path so existing
// import sites (`@/core/business-context/resolver`) resolve unchanged.

export { normalizeFactKey, deduplicateFacts } from './resolver/normalize'
export { SOURCE_PRECEDENCE } from './resolver/precedence'
export { detectConflicts } from './resolver/conflicts'
export { generateQuestionsForGaps } from './resolver/questions'
export { resolveFacts, type ResolutionResult } from './resolver/resolver'
