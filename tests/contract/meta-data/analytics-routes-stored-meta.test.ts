import { describe, expect, it } from 'vitest'
import { readFileSource } from '../business-context/_idempotency-helpers'

const SUMMARY_ROUTE = 'src/app/api/analytics/route.ts'
const TIMESERIES_ROUTE = 'src/app/api/analytics/timeseries/route.ts'

describe('analytics routes use stored Meta data', () => {
  for (const file of [SUMMARY_ROUTE, TIMESERIES_ROUTE]) {
    it(`${file} does not import MetaApiAdapter directly`, () => {
      const source = readFileSource(file)
      expect(source).not.toMatch(/MetaApiAdapter/)
      expect(source).not.toMatch(/meta-api\.adapter/)
    })

    it(`${file} does not read legacy Meta token/account env or cookies`, () => {
      const source = readFileSource(file)
      expect(source).not.toMatch(/META_ACCESS_TOKEN|META_AD_ACCOUNT_ID|meta_access_token|meta_ad_account_id/)
      expect(source).not.toMatch(/config\.meta\.(appSecret|appId)/)
    })

    it(`${file} does not return mock analytics success`, () => {
      const source = readFileSource(file)
      expect(source).not.toMatch(/getMockAnalytics|getMockTimeSeries|mock-data/)
    })

    it(`${file} requires workspace auth and calls stored analytics service`, () => {
      const source = readFileSource(file)
      expect(source).toMatch(/requireAuthz/)
      expect(source).toMatch(/SupabaseMetaRepository/)
      expect(source).toMatch(/getStoredAnalyticsSummary|getStoredTimeseries/)
    })

    it(`${file} returns clear NOT_SYNCED state`, () => {
      const source = readFileSource(file)
      expect(source).toMatch(/NOT_SYNCED/)
      expect(source).toMatch(/409/)
    })
  }
})
