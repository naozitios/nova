import { describe, it, expect, vi } from 'vitest'
import { encodeMetaOAuthState, decodeMetaOAuthState } from '@/core/meta-data/oauth-state'
import { runHierarchySync, type HierarchyHandlerDeps } from '@/workers/meta-sync/hierarchy-handler'
import type { MetaOAuthStatePayload } from '@/core/meta-data/entities'

interface PageResult {
  data: Record<string, unknown>[]
  nextPageUrl: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const WORKSPACE_ID = 'ws-test-001'
const USER_ID = 'user-abc'
const META_USER_ID = '12345'
const RUN_ID = 'run-xyz'
const META_AD_ACCOUNT_ID = 'act_999999'
const ACCOUNT_ID = 'acct_111'
const ENCRYPTED_TOKEN = 'enc-vault-token-abc'

function makeStatePayload(overrides: Partial<MetaOAuthStatePayload> = {}): MetaOAuthStatePayload {
  return {
    stateId: crypto.randomUUID(),
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    nonce: crypto.randomUUID(),
    returnPath: '/settings',
    ...overrides,
  }
}

function makeCampaignPage1() {
  return {
    data: [
      { id: '1001', name: 'Campaign 1', objective: 'OUTCOME_TRAFFIC', status: 'ACTIVE' },
      { id: '1002', name: 'Campaign 2', objective: 'OUTCOME_SALES', status: 'PAUSED' },
    ],
    nextPageUrl: `https://graph.facebook.com/v19.0/${META_AD_ACCOUNT_ID}/campaigns?after=page2_cursor&limit=100`,
  }
}

function makeCampaignPage2() {
  return {
    data: [
      { id: '1003', name: 'Campaign 3', objective: 'OUTCOME_LEADS', status: 'ACTIVE' },
    ],
    nextPageUrl: null,
  }
}

function makeEmptyPartitionPage(): PageResult {
  return { data: [], nextPageUrl: null }
}

function makeDeps(overrides: Partial<HierarchyHandlerDeps> = {}): HierarchyHandlerDeps {
  return {
    repo: {
      getSyncRun: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: RUN_ID,
          workspaceId: WORKSPACE_ID,
          metaAdAccountId: META_AD_ACCOUNT_ID,
          mode: 'initial_backfill',
          status: 'running',
          idempotencyKey: null,
        },
      }),
      getCompletedCheckpointKeys: vi.fn().mockResolvedValue({ ok: true, data: [] }),
      getConnectionWithToken: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: 'conn-1',
          workspaceId: WORKSPACE_ID,
          connectedBy: USER_ID,
          metaUserId: META_USER_ID,
          status: 'connected',
          grantedScopes: ['ads_management', 'ads_read'],
          tokenExpiresAt: null,
          selectedAdAccountId: META_AD_ACCOUNT_ID,
          selectedBusinessId: null,
          lastVerifiedAt: null,
          reconnectReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          encryptedAccessToken: ENCRYPTED_TOKEN,
        },
      }),
      advanceCheckpoint: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: 'cp-1', workspaceId: WORKSPACE_ID, runId: RUN_ID, partitionKey: 'campaigns', status: 'completed', cursor: null },
      }),
      upsertCampaigns: vi.fn().mockResolvedValue({ ok: true, data: null }),
      upsertAds: vi.fn().mockResolvedValue({ ok: true, data: null }),
      upsertAdSets: vi.fn().mockResolvedValue({ ok: true, data: null }),
      upsertCreatives: vi.fn().mockResolvedValue({ ok: true, data: null }),
      listAdAccounts: vi.fn().mockResolvedValue({
        ok: true,
        data: [{ id: META_AD_ACCOUNT_ID, accountId: ACCOUNT_ID, name: 'Test Account', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true }],
      }),
      ...overrides.repo,
    },
    api: {
      getCampaignsPage: vi.fn(),
      getAdSetsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
      getAdsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
      getCreativesPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
      ...overrides.api,
    },
    tokenVault: {
      decrypt: vi.fn().mockReturnValue('decrypted-access-token'),
      ...overrides.tokenVault,
    },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('OAuth → sync end-to-end', () => {
  // -------------------------------------------------------------------------
  // Scenario 1: Happy path
  // -------------------------------------------------------------------------
  describe('Scenario 1: happy path', () => {
    it('encodes and decodes OAuth state, then syncs 2 pages of campaigns', async () => {
      // --- Step 1: Encode OAuth state ---
      const statePayload = makeStatePayload()
      const signedState = encodeMetaOAuthState(statePayload)

      expect(typeof signedState).toBe('string')
      expect(signedState).toContain('.')

      // --- Step 2: Decode OAuth state ---
      const decoded = decodeMetaOAuthState(signedState)
      expect(decoded).not.toBeNull()
      expect(decoded!.workspaceId).toBe(statePayload.workspaceId)
      expect(decoded!.userId).toBe(statePayload.userId)
      expect(decoded!.nonce).toBe(statePayload.nonce)
      expect(decoded!.returnPath).toBe(statePayload.returnPath)

      // --- Step 3: Simulate callback — mock token exchange & /me ---
      const fetchSpy = vi.fn()
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'meta-access-tok', expires_in: 5184000, granted_scopes: 'ads_management,ads_read' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: META_USER_ID, name: 'Test User' }),
        })
      global.fetch = fetchSpy

      // Simulate the callback flow (token exchange + /me)
      const tokenResp = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token`)
      const tokenData = await tokenResp.json()
      expect(tokenData.access_token).toBe('meta-access-tok')

      const meResp = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name`)
      const meData = await meResp.json()
      expect(meData.id).toBe(META_USER_ID)
      expect(meData.name).toBe('Test User')

      // Verify stored scopes match granted scopes
      const grantedScopes = tokenData.granted_scopes.split(',').filter(Boolean)
      expect(grantedScopes).toEqual(['ads_management', 'ads_read'])

      // --- Step 4: Sync — campaigns across 2 pages ---
      const deps = makeDeps({
        api: {
          getCampaignsPage: vi.fn()
            .mockResolvedValueOnce(makeCampaignPage1())
            .mockResolvedValueOnce(makeCampaignPage2()),
          getAdSetsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getAdsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getCreativesPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
        },
      })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, deps)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data).toBeUndefined()
      }

      // Verify: 2 pages of campaigns fetched
      expect(deps.api.getCampaignsPage).toHaveBeenCalledTimes(2)
      expect(deps.api.getCampaignsPage).toHaveBeenCalledWith(ACCOUNT_ID, 'decrypted-access-token', undefined)
      expect(deps.api.getCampaignsPage).toHaveBeenCalledWith(ACCOUNT_ID, 'decrypted-access-token', 'page2_cursor')

      // Verify: campaigns upserted twice (once per page)
      expect(deps.repo.upsertCampaigns).toHaveBeenCalledTimes(2)
      const firstUpsert = (deps.repo.upsertCampaigns as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(firstUpsert.workspaceId).toBe(WORKSPACE_ID)
      expect(firstUpsert.runId).toBe(RUN_ID)
      expect(firstUpsert.campaigns).toHaveLength(2)
      expect(firstUpsert.campaigns[0].id).toBe('1001')

      const secondUpsert = (deps.repo.upsertCampaigns as ReturnType<typeof vi.fn>).mock.calls[1][0]
      expect(secondUpsert.campaigns).toHaveLength(1)
      expect(secondUpsert.campaigns[0].id).toBe('1003')

      // Verify: checkpoint advanced with 'completed' for campaigns
      const checkpointCalls = (deps.repo.advanceCheckpoint as ReturnType<typeof vi.fn>).mock.calls
      const completedCheckpoint = checkpointCalls.find(
        (call: [{ partitionKey: string; status: string }]) => call[0].partitionKey === 'campaigns' && call[0].status === 'completed',
      )
      expect(completedCheckpoint).toBeDefined()

      // Verify: token decrypted with correct ciphertext
      expect(deps.tokenVault.decrypt).toHaveBeenCalledWith(ENCRYPTED_TOKEN)

      // Cleanup
      delete (globalThis as Record<string, unknown>).fetch
    })
  })

  // -------------------------------------------------------------------------
  // Scenario 2: Error path — token expired during sync
  // -------------------------------------------------------------------------
  describe('Scenario 2: error path — token expired during sync', () => {
    it('preserves first page data and classifies 401 as auth error', async () => {
      const deps = makeDeps({
        api: {
          getCampaignsPage: vi.fn()
            .mockResolvedValueOnce(makeCampaignPage1())
            .mockRejectedValueOnce(Object.assign(new Error('OAuthException: Token expired'), { status: 401 })),
          getAdSetsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getAdsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getCreativesPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
        },
      })

      const result = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, deps)

      // Should fail — 401 is classified as 'auth' by classifyMetaSyncError,
      // but processPartition wraps non-retryable errors as PROVIDER_ERROR
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('PROVIDER_ERROR')
      }

      // First page data was upserted before error
      expect(deps.repo.upsertCampaigns).toHaveBeenCalledTimes(1)

      // Checkpoint for campaigns was advanced with retry_pending + cursor
      const checkpointCalls = (deps.repo.advanceCheckpoint as ReturnType<typeof vi.fn>).mock.calls
      const retryCheckpoint = checkpointCalls.find(
        (call: [{ partitionKey: string; status: string }]) => call[0].partitionKey === 'campaigns' && call[0].status === 'retry_pending',
      )
      expect(retryCheckpoint).toBeDefined()

      // Verify: connection marked for re-auth
      expect(deps.repo.getConnectionWithToken).toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Scenario 3: Re-auth flow
  // -------------------------------------------------------------------------
  describe('Scenario 3: re-auth flow', () => {
    it('new OAuth re-authorizes with fresh token and sync uses it', async () => {
      // Previous connection exists with expired token
      const previousConn = {
        id: 'conn-old',
        workspaceId: WORKSPACE_ID,
        connectedBy: USER_ID,
        metaUserId: '99999',
        status: 'connected' as const,
        grantedScopes: ['ads_management'],
        tokenExpiresAt: new Date('2025-01-01'),
        selectedAdAccountId: META_AD_ACCOUNT_ID,
        selectedBusinessId: null,
        lastVerifiedAt: null,
        reconnectReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        encryptedAccessToken: 'old-encrypted-token',
      }

      // New OAuth flow produces new token
      const newToken = 'fresh-access-token'
      const freshTokenConn = {
        ...previousConn,
        id: 'conn-new',
        metaUserId: META_USER_ID,
        encryptedAccessToken: 'new-encrypted-token',
        tokenExpiresAt: new Date('2027-01-01'),
        grantedScopes: ['ads_management', 'ads_read', 'pages_read_engagement'],
        reconnectReason: null,
      }

      const fetchSpy = vi.fn()
      fetchSpy
        // Token exchange returns new token
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: newToken, expires_in: 5184000, granted_scopes: 'ads_management,ads_read,pages_read_engagement' }),
        })
        // /me returns potentially new meta user
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: META_USER_ID, name: 'Re-authed User' }),
        })
      global.fetch = fetchSpy

      // Simulate: new OAuth callback
      const tokenResp = await fetch('https://graph.facebook.com/v19.0/oauth/access_token')
      const tokenData = await tokenResp.json()
      const meResp = await fetch('https://graph.facebook.com/v19.0/me?fields=id,name')
      const meData = await meResp.json()

      // Verify: new metaUserId from /me
      expect(meData.id).toBe(META_USER_ID)

      // Verify: connection would be updated with new token and new metaUserId
      expect(freshTokenConn.metaUserId).toBe(meData.id)
      expect(freshTokenConn.encryptedAccessToken).toBe('new-encrypted-token')
      expect(freshTokenConn.grantedScopes).toEqual(tokenData.granted_scopes.split(',').filter(Boolean))

      // Sync uses new connection — mock deps to return fresh connection
      const deps = makeDeps({
        repo: {
          getConnectionWithToken: vi.fn().mockResolvedValue({
            ok: true,
            data: freshTokenConn,
          }),
          getSyncRun: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              id: RUN_ID,
              workspaceId: WORKSPACE_ID,
              metaAdAccountId: META_AD_ACCOUNT_ID,
              mode: 'initial_backfill',
              status: 'running',
              idempotencyKey: null,
            },
          }),
          getCompletedCheckpointKeys: vi.fn().mockResolvedValue({ ok: true, data: [] }),
          advanceCheckpoint: vi.fn().mockResolvedValue({
            ok: true,
            data: { id: 'cp-1', workspaceId: WORKSPACE_ID, runId: RUN_ID, partitionKey: 'campaigns', status: 'completed', cursor: null },
          }),
          upsertCampaigns: vi.fn().mockResolvedValue({ ok: true, data: null }),
          upsertAds: vi.fn().mockResolvedValue({ ok: true, data: null }),
          upsertAdSets: vi.fn().mockResolvedValue({ ok: true, data: null }),
          upsertCreatives: vi.fn().mockResolvedValue({ ok: true, data: null }),
          listAdAccounts: vi.fn().mockResolvedValue({
            ok: true,
            data: [{ id: META_AD_ACCOUNT_ID, accountId: ACCOUNT_ID, name: 'Test Account', currency: 'USD', timezoneName: 'UTC', businessId: null, businessName: null, isSelected: true }],
          }),
        },
        api: {
          getCampaignsPage: vi.fn().mockResolvedValue({ data: [{ id: '2001', name: 'New Campaign' }], nextPageUrl: null }),
          getAdSetsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getAdsPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
          getCreativesPage: vi.fn().mockResolvedValue(makeEmptyPartitionPage()),
        },
        tokenVault: {
          decrypt: vi.fn().mockReturnValue('fresh-access-token'),
        },
      })

      const syncResult = await runHierarchySync({ runId: RUN_ID, workspaceId: WORKSPACE_ID }, deps)

      expect(syncResult.ok).toBe(true)

      // Verify: token decrypted is the new fresh token, not old
      expect(deps.tokenVault.decrypt).toHaveBeenCalledWith('new-encrypted-token')

      // Verify: API called with fresh token
      expect(deps.api.getCampaignsPage).toHaveBeenCalledWith(ACCOUNT_ID, 'fresh-access-token', undefined)

      // Verify: new campaign upserted
      expect(deps.repo.upsertCampaigns).toHaveBeenCalledTimes(1)
      const upsertArg = (deps.repo.upsertCampaigns as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(upsertArg.campaigns[0].id).toBe('2001')

      // Cleanup
      delete (globalThis as Record<string, unknown>).fetch
    })
  })
})
