import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runHierarchySync } from '@/workers/meta-sync/hierarchy-handler'
import { runInsightsSync } from '@/workers/meta-sync/insights-handler'
import type { ServiceResult } from '@/core/business-context/types'
import type {
  MetaSyncRunRecord,
  MetaSyncCheckpointRecord,
  MetaConnectionRecord,
} from '@/core/meta-data/repository.port'
import type { MetaAdAccountSummary } from '@/core/meta-data/entities'

// ── Helpers ────────────────────────────────────────────────────────────────

const WS_A = 'ws-a'
const WS_B = 'ws-b'
const RUN_A = 'run-a'
const RUN_B = 'run-b'
const ACCOUNT_A = 'act_a'
const ACCOUNT_B = 'act_b'

function ok<T>(data: T): ServiceResult<T> { return { ok: true, data } }

function mkConn(workspaceId: string, encrypted: string): MetaConnectionRecord {
  return {
    id: `conn-${workspaceId}`,
    workspaceId,
    connectedBy: 'user-1',
    metaUserId: `meta-${workspaceId}`,
    status: 'connected',
    grantedScopes: ['ads_read'],
    tokenExpiresAt: null,
    selectedAdAccountId: workspaceId === WS_A ? ACCOUNT_A : ACCOUNT_B,
    selectedBusinessId: null,
    lastVerifiedAt: null,
    reconnectReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    encryptedAccessToken: encrypted,
  }
}

function mkRun(workspaceId: string, runId: string, accountId: string): MetaSyncRunRecord {
  return {
    id: runId,
    workspaceId,
    metaAdAccountId: accountId,
    mode: 'full',
    status: 'running',
    idempotencyKey: null,
  }
}

function mkAccount(id: string, accountId: string): MetaAdAccountSummary {
  return { id, accountId, name: 'Account', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('Cross-workspace isolation', () => {
  it('separate connections per workspace — fetching ws-a does NOT return ws-b token', async () => {
    const connections: Record<string, MetaConnectionRecord> = {
      [WS_A]: mkConn(WS_A, 'enc-token-a'),
      [WS_B]: mkConn(WS_B, 'enc-token-b'),
    }

    const repo = {
      getSyncRun: vi.fn(async (ws: string, runId: string) => {
        return ok(mkRun(ws, runId, ws === WS_A ? ACCOUNT_A : ACCOUNT_B))
      }),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
      getConnectionWithToken: vi.fn(async (ws: string) => ok(connections[ws] ?? null)),
      advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
      listAdAccounts: vi.fn(async (ws: string) => ok([mkAccount(ws === WS_A ? ACCOUNT_A : ACCOUNT_B, ws === WS_A ? 'act_1' : 'act_2')])),
      upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
      upsertAds: vi.fn().mockResolvedValue(ok(null)),
      upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
      upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
    }

    const resultA = await repo.getConnectionWithToken(WS_A)
    const resultB = await repo.getConnectionWithToken(WS_B)

    expect(resultA.ok).toBe(true)
    if (resultA.ok) {
      expect(resultA.data.encryptedAccessToken).toBe('enc-token-a')
    }
    expect(resultB.ok).toBe(true)
    if (resultB.ok) {
      expect(resultB.data.encryptedAccessToken).toBe('enc-token-b')
    }

    expect(repo.getConnectionWithToken).toHaveBeenCalledWith(WS_A)
    expect(repo.getConnectionWithToken).toHaveBeenCalledWith(WS_B)
  })

  it('separate sync runs — run for ws-a is isolated from ws-b', async () => {
    const runs: Record<string, MetaSyncRunRecord> = {
      [RUN_A]: mkRun(WS_A, RUN_A, ACCOUNT_A),
      [RUN_B]: mkRun(WS_B, RUN_B, ACCOUNT_B),
    }

    const repo = {
      getSyncRun: vi.fn(async (ws: string, runId: string) => {
        const run = runs[runId]
        if (run && run.workspaceId === ws) return ok(run)
        return ok(null)
      }),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
      getConnectionWithToken: vi.fn(async (ws: string) => ok(mkConn(ws, `enc-${ws}`))),
      advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
      listAdAccounts: vi.fn(async (ws: string) => ok([mkAccount(ws === WS_A ? ACCOUNT_A : ACCOUNT_B, ws === WS_A ? 'act_1' : 'act_2')])),
      upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
      upsertAds: vi.fn().mockResolvedValue(ok(null)),
      upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
      upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
    }

    const resultA = await repo.getSyncRun(WS_A, RUN_A)
    const resultB = await repo.getSyncRun(WS_B, RUN_B)

    expect(resultA.ok && resultA.data).toBeTruthy()
    expect(resultA.ok && resultA.data!.workspaceId).toBe(WS_A)
    expect(resultB.ok && resultB.data).toBeTruthy()
    expect(resultB.ok && resultB.data!.workspaceId).toBe(WS_B)

    // Cross-workspace lookup returns null
    const crossLookup = await repo.getSyncRun(WS_A, RUN_B)
    expect(crossLookup.ok && crossLookup.data).toBeNull()
  })

  it('token isolation — decrypt uses workspace-specific encrypted token', async () => {
    const connections: Record<string, MetaConnectionRecord> = {
      [WS_A]: mkConn(WS_A, 'enc-a'),
      [WS_B]: mkConn(WS_B, 'enc-b'),
    }

    const repo = {
      getSyncRun: vi.fn(async (ws: string, runId: string) => ok(mkRun(ws, runId, ws === WS_A ? ACCOUNT_A : ACCOUNT_B))),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue(ok([])),
      getConnectionWithToken: vi.fn(async (ws: string) => ok(connections[ws] ?? null)),
      advanceCheckpoint: vi.fn().mockResolvedValue(ok({} as MetaSyncCheckpointRecord)),
      listAdAccounts: vi.fn(async (ws: string) => ok([mkAccount(ws === WS_A ? ACCOUNT_A : ACCOUNT_B, ws === WS_A ? 'act_1' : 'act_2')])),
      upsertCampaigns: vi.fn().mockResolvedValue(ok(null)),
      upsertAds: vi.fn().mockResolvedValue(ok(null)),
      upsertAdSets: vi.fn().mockResolvedValue(ok(null)),
      upsertCreatives: vi.fn().mockResolvedValue(ok(null)),
    }

    const tokenVault = {
      decrypt: vi.fn((ciphertext: string) => `decrypted-${ciphertext}`),
    }

    const api = {
      getCampaignsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getAdSetsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getAdsPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
      getCreativesPage: vi.fn().mockResolvedValue({ data: [], nextPageUrl: null }),
    }

    // Run for ws-a
    await runHierarchySync({ runId: RUN_A, workspaceId: WS_A }, { repo, api, tokenVault })
    expect(tokenVault.decrypt).toHaveBeenCalledWith('enc-a')

    // Run for ws-b
    await runHierarchySync({ runId: RUN_B, workspaceId: WS_B }, { repo, api, tokenVault })
    expect(tokenVault.decrypt).toHaveBeenCalledWith('enc-b')

    // Verify no cross-pollination
    expect(tokenVault.decrypt).not.toHaveBeenCalledWith(expect.not.stringContaining('enc-'))
  })
})
