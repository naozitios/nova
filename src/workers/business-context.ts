// ─── Business context worker entry point ───────────────────────────────────
//
// Standalone worker process for background source processing jobs.
// Run separately from Next.js: `npm run worker:business-context`
//
// Handles:
//   - Unique worker identity (config or pid-based)
//   - SIGTERM/SIGINT graceful shutdown
//   - Handler registration
//   - Job polling loop via JobRunner

import { config } from '@/infrastructure/config'
import { Container } from '@/di/container'
import { registerHandlers } from '@/infrastructure/business-context/job-runner/register-handlers'

const WORKER_ID = config.workerId
const logger = console

if (process.env.NODE_ENV === 'production' && !process.env.WORKER_ID?.trim()) {
  console.error(
    '[worker] WORKER_ID is required in production. Set the WORKER_ID environment variable before starting.',
  )
  process.exit(1)
}

async function main(): Promise<void> {
  logger.log(`[worker] starting business-context worker id=${WORKER_ID}`)

  const runner = Container.getJobRunner()

  // Register all job-type handlers
  const handlers = new Map()
  registerHandlers(handlers)
  for (const [jobType, handler] of handlers) {
    runner.registerHandler(jobType, handler)
  }
  logger.log(`[worker] registered ${handlers.size} handler(s)`)

  // Graceful shutdown
  let stopping = false
  const shutdown = async (signal: string) => {
    if (stopping) return
    stopping = true
    logger.log(`[worker] received ${signal}, shutting down...`)
    await runner.stop()
    logger.log(`[worker] stopped`)
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Start polling
  runner.start()
  logger.log(`[worker] polling for jobs`)
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
