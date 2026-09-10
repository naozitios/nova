import { beforeEach, describe, expect, it, vi } from 'vitest'

const loadEnvConfig = vi.fn()

vi.mock('@next/env', () => ({
  loadEnvConfig,
}))

describe('loadStandaloneWorkerEnv', () => {
  beforeEach(() => {
    vi.resetModules()
    loadEnvConfig.mockReset()
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_ANON_KEY
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  it('loads Next env files before worker config imports', async () => {
    const { loadStandaloneWorkerEnv } = await import('./load-env')

    loadStandaloneWorkerEnv('/repo')

    expect(loadEnvConfig).toHaveBeenCalledWith('/repo')
  })

  it('maps public Supabase env names to worker env names', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    const { loadStandaloneWorkerEnv } = await import('./load-env')

    loadStandaloneWorkerEnv('/repo')

    expect(process.env.SUPABASE_URL).toBe('http://127.0.0.1:54321')
    expect(process.env.SUPABASE_ANON_KEY).toBe('anon-key')
  })
})
