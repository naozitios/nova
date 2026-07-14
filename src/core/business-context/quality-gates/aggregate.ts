import type { GateResult } from './index'

// ─── Aggregate evaluation ────────────────────────────────────────────────────

export function hasBlockingFailures(results: GateResult[]): boolean {
  return results.some((r) => r.status === 'failed_blocking')
}

export function hasWarnings(results: GateResult[]): boolean {
  return results.some((r) => r.status === 'warning' || r.status === 'failed_non_blocking')
}

export function overallGateStatus(
  results: GateResult[],
): 'passed' | 'passed_with_warnings' | 'failed_blocking' {
  if (hasBlockingFailures(results)) return 'failed_blocking'
  if (hasWarnings(results)) return 'passed_with_warnings'
  return 'passed'
}
