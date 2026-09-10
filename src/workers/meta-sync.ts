// ─── Meta sync worker entry point ──────────────────────────────────────────
//
// Standalone worker process for Meta sync runs (PRD 008).
// Run separately from Next.js: `npm run worker:meta-sync`
//
// Handles:
//   - Unique worker identity (config or pid-based)
//   - SIGTERM/SIGINT graceful shutdown
//   - Polling meta_sync_runs via lease claim, dispatch by mode

import { loadStandaloneWorkerEnv } from './load-env'

const POLL_MS = 5_000
const LEASE_MS = 120_000
const logger = console

loadStandaloneWorkerEnv()

function unwrapModule<T>(module: T): T {
  return ((module as { default?: T }).default ?? module)
}

if (process.env.NODE_ENV === 'production' && !process.env.WORKER_ID?.trim()) {
  console.error(
    '[worker] WORKER_ID is required in production. Set the WORKER_ID environment variable before starting.',
  )
  process.exit(1)
}

async function main(): Promise<void> {
  const [configModule, containerModule, runnerModule] = await Promise.all([
    import('@/infrastructure/config'),
    import('@/di/container'),
    import('@/workers/meta-sync/runner'),
  ])

  const { config } = unwrapModule(configModule)
  const { Container } = unwrapModule(containerModule)
  const { startMetaSyncRunner } = unwrapModule(runnerModule)

  const WORKER_ID = config.workerId

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

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
