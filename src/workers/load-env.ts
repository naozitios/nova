import * as nextEnv from '@next/env'

let loaded = false

export function loadStandaloneWorkerEnv(projectDir = process.cwd()): void {
  if (loaded) return

  nextEnv.loadEnvConfig(projectDir)

  process.env.SUPABASE_URL ??= process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_ANON_KEY ??= process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  loaded = true
}
