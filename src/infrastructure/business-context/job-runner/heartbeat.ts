// ─── Heartbeat ─────────────────────────────────────────────────────────────
//
// Periodic heartbeat refresh for in-flight jobs. The job-policy core owns the
// interval constant and the stall-detection predicate; this module wires
// them to a repo so the runner can call a single startHeartbeat() per job.

import type { ContextJob } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { heartbeatIntervalMs } from '@/core/business-context/job-policy'

export function startHeartbeat(
  job: ContextJob,
  repo: RepositoryPort,
  isActive: () => boolean,
): ReturnType<typeof setInterval> {
  const interval = heartbeatIntervalMs()
  return setInterval(async () => {
    if (!isActive() || !job) return
    await repo.updateContextJob(job.workspaceId, job.id, {
      heartbeatAt: new Date(),
    })
  }, interval)
}
