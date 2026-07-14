// ─── Lease / job claiming ──────────────────────────────────────────────────
//
// Acquires worker leases on queued and retry_waiting jobs by calling
// repository.claimRunnableJobs. The repo performs the actual lockedBy /
// lockedAt / heartbeatAt assignment; this module is a thin orchestrator
// that fills any remaining batch slots with retry_waiting jobs.

import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'

export async function claimJobs(
  repo: RepositoryPort,
  workerId: string,
  limit: number,
): Promise<ContextJob[]> {
  // Claim queued jobs first.
  const queued = await repo.claimRunnableJobs(
    { status: 'queued' },
    workerId,
    limit,
  )
  if (!queued.ok) return []

  let jobs = queued.data

  // Fill any remaining slots with retry_waiting jobs whose next_run_at has
  // passed.
  if (jobs.length < limit) {
    const retryLimit = limit - jobs.length
    const retryResult = await repo.claimRunnableJobs(
      { status: 'retry_waiting' },
      workerId,
      retryLimit,
    )
    if (retryResult.ok) {
      jobs = [...jobs, ...retryResult.data]
    }
  }

  return jobs
}
