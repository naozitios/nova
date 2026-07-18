import { describe, it, expect } from 'vitest'
import {
  META_DATA_CONTRACTS,
  getMetaContractsForObject,
} from '@/core/meta-data/data-contract-registry'

// ── Passing: contract registry supports capability discovery foundation ─────

describe('data contract registry — capability discovery support', () => {
  it('every contract declares requiredPermissions', () => {
    for (const contract of META_DATA_CONTRACTS) {
      expect(Array.isArray(contract.requiredPermissions)).toBe(true)
      expect(contract.requiredPermissions.length).toBeGreaterThan(0)
    }
  })

  it('all contracts require ads_read permission', () => {
    for (const contract of META_DATA_CONTRACTS) {
      expect(contract.requiredPermissions).toContain('ads_read')
    }
  })

  it('getMetaContractsForObject returns contracts with permissions', () => {
    const types = ['campaign', 'ad_set', 'ad', 'creative', 'insight'] as const
    for (const objectType of types) {
      const contracts = getMetaContractsForObject(objectType)
      expect(contracts.length).toBeGreaterThan(0)
      for (const c of contracts) {
        expect(c.requiredPermissions.length).toBeGreaterThan(0)
      }
    }
  })

  it('contracts cover all object types needed for capability checks', () => {
    const objectTypes = new Set(META_DATA_CONTRACTS.map((c) => c.objectType))
    expect(objectTypes).toContain('campaign')
    expect(objectTypes).toContain('ad_set')
    expect(objectTypes).toContain('ad')
    expect(objectTypes).toContain('creative')
    expect(objectTypes).toContain('insight')
  })

  it('each contract has a unique contractId', () => {
    const ids = META_DATA_CONTRACTS.map((c) => c.contractId)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})

// ── Stub: capability discovery service ──────────────────────────────────────
//
// PRD 008 requires checking which Meta API features are available for a
// connected ad account before syncing. The service should query the
// account's permissions and feature flags, returning a capability set
// that downstream sync logic can gate on.
//
// Expected interface (not yet implemented):
//   discoverCapabilities(accountId: string, accessToken: string)
//     → Promise<{ websiteMeasurement: boolean; supportedAdFormats: string[]; ... }>
//
// Expected behaviors:
//   - Calls Meta Graph API /act_{id} with account fields
//   - Parses website_measurement_enabled from response
//   - Returns supported ad formats based on account capabilities
//   - Throws on auth/permission errors (does not return defaults)
//   - Caches results per account for the session lifetime

describe.skip('capability discovery service', () => {
  it('discovers website measurement capability from account', () => {
    // TODO: implement when service exists
  })

  it('returns supported ad formats for the account', () => {
    // TODO: implement when service exists
  })

  it('throws on invalid access token', () => {
    // TODO: implement when service exists
  })

  it('throws on insufficient permissions', () => {
    // TODO: implement when service exists
  })

  it('caches capability results per account', () => {
    // TODO: implement when service exists
  })
})

// ── Stub: website measurement verifier ──────────────────────────────────────
//
// PRD 008 requires validating that the Meta pixel/website measurement is
// correctly configured before syncing website conversion data. The verifier
// should check pixel status, event setup, and domain verification.
//
// Expected interface (not yet implemented):
//   verifyWebsiteMeasurement(accountId: string, pixelId: string, accessToken: string)
//     → Promise<{ valid: boolean; issues: string[] }>
//
// Expected behaviors:
//   - Fetches pixel status from Meta Events Manager API
//   - Checks pixel is active (not paused or deleted)
//   - Validates domain verification status
//   - Returns list of specific issues when validation fails
//   - Returns { valid: true, issues: [] } when everything passes

describe.skip('website measurement verifier', () => {
  it('returns valid when pixel is active and domain verified', () => {
    // TODO: implement when service exists
  })

  it('returns issues when pixel is paused', () => {
    // TODO: implement when service exists
  })

  it('returns issues when pixel is deleted', () => {
    // TODO: implement when service exists
  })

  it('returns issues when domain is not verified', () => {
    // TODO: implement when service exists
  })

  it('returns issues when no events are configured', () => {
    // TODO: implement when service exists
  })

  it('throws on invalid pixel ID format', () => {
    // TODO: implement when service exists
  })

  it('throws on auth failure', () => {
    // TODO: implement when service exists
  })
})

// ── Stub: sync gating integration ───────────────────────────────────────────
//
// PRD 008 requires that the sync runner checks capabilities before starting
// a sync run. If website measurement data is requested but the capability
// is not available, the run should be rejected early.

describe.skip('sync gating — capability check before sync', () => {
  it('rejects sync when website measurement not available', () => {
    // TODO: implement when discovery service exists
  })

  it('allows sync when all required capabilities are present', () => {
    // TODO: implement when discovery service exists
  })

  it('skips website conversion sync when pixel verification fails', () => {
    // TODO: implement when verifier exists
  })
})
