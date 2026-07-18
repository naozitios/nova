// ─── Meta sync worker entry point ──────────────────────────────────────────
//
// Standalone worker process for Meta sync runs (PRD 008).
// Run separately from Next.js: `npm run worker:meta-sync`
//
// Handles:
//   - Unique worker identity (config or pid-based)
//   - SIGTERM/SIGINT graceful shutdown
//   - Polling meta_sync_runs via lease claim, dispatch by mode

import { config } from '@/infrastructure/config'
import { Container } from '@/di/container'
import { startMetaSyncRunner } from '@/workers/meta-sync/runner'

const WORKER_ID = config.workerId
const POLL_MS = 5_000
const LEASE_MS = 120_000
const logger = console

if (process.env.NODE_ENV === 'production' && !process.env.WORKER_ID?.trim()) {
  console.error(
    '[worker] WORKER_ID is required in production. Set the WORKER_ID environment variable before starting.',
  )
  process.exit(1)
}

function main(): void {
  logger.log(`[worker] starting meta-sync worker id=${WORKER_ID}`)

  const runner = startMetaSyncRunner(
    {
      repo: Container.getMetaRepository(),
      api: Container.getMetaApiAdapter(),
      tokenVault: Container.getMetaTokenVault(),
      today: () => new Date().toISOString().slice(0, 10),
      workerId: WORKER_ID,
      leaseMs: LEASE_MS,
    },
    POLL_MS,
  )

  // Graceful shutdown
  let stopping = false
  const shutdown = (signal: string) => {
    if (stopping) return
    stopping = true
    logger.log(`[worker] received ${signal}, shutting down...`)
    runner.stop()
    logger.log(`[worker] stopped`)
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  logger.log(`[worker] polling meta_sync_runs every ${POLL_MS}ms`)
}

try {
  main()
} catch (err) {
  console.error('[worker] fatal:', err)
  process.exit(1)
}
