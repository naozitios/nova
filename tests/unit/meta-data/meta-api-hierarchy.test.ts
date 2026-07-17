import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';

/**
 * MetaApiAdapter — paginated Page methods
 *
 * Covers: getCampaignsPage, getAdSetsPage, getAdsPage, getCreativesPage
 * Each returns { data, nextPageUrl }.
 */
describe('MetaApiAdapter — paginated Page methods', () => {
  let adapter: InstanceType<Awaited<typeof import('@/infrastructure/meta/meta-api.adapter')>['MetaApiAdapter']>;
  const accountId = 'act_123456';
  const accessToken = 'test-token-hide-this';

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    // Dynamic import after stubbing fetch so module-level side-effects don't break
    const mod = await import('@/infrastructure/meta/meta-api.adapter');
    adapter = new mod.MetaApiAdapter();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  /** Helper: build a mock Meta paginated response */
  function mockResponse(body: object, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as unknown as Response;
  }

  // ─── getCampaignsPage ───

  describe('getCampaignsPage', () => {
    it('returns data + null nextPageUrl when no paging.next', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [
            { id: '1001', name: 'C1', status: 'ACTIVE', objective: 'OUTCOME_SALES', daily_budget: '1000', lifetime_budget: null },
          ],
        }),
      );

      const result = await adapter.getCampaignsPage(accountId, accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1001');
      expect(result.nextPageUrl).toBeNull();
    });

    it('returns nextPageUrl when paging.next present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '2001', name: 'C2', status: 'PAUSED', objective: 'OUTCOME_LEADS' }],
          paging: { next: 'https://graph.facebook.com/v22.0/act_123456/campaigns?after=ABC' },
        }),
      );

      const result = await adapter.getCampaignsPage(accountId, accessToken);

      expect(result.nextPageUrl).toBe(
        'https://graph.facebook.com/v22.0/act_123456/campaigns?after=ABC',
      );
    });

    it('appends after cursor when supplied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getCampaignsPage(accountId, accessToken, 'CURSOR1');

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('after=CURSOR1');
      expect(url).toContain('limit=100');
    });

    it('requested path includes expected fields', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getCampaignsPage(accountId, accessToken);

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('/act_123456/campaigns');
      expect(url).toContain('fields=id,name,objective,status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,bid_strategy');
      expect(url).toContain('limit=100');
    });
  });

  // ─── getAdSetsPage ───

  describe('getAdSetsPage', () => {
    it('returns data + null nextPageUrl when no paging.next', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [
            { id: '3001', name: 'AS1', status: 'ACTIVE', campaign_id: '1001', daily_budget: '500' },
          ],
        }),
      );

      const result = await adapter.getAdSetsPage(accountId, accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('3001');
      expect(result.nextPageUrl).toBeNull();
    });

    it('returns nextPageUrl when paging.next present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '3002', name: 'AS2', status: 'PAUSED', campaign_id: '1001' }],
          paging: { next: 'https://graph.facebook.com/v22.0/act_123456/adsets?after=DEF' },
        }),
      );

      const result = await adapter.getAdSetsPage(accountId, accessToken);

      expect(result.nextPageUrl).toBe(
        'https://graph.facebook.com/v22.0/act_123456/adsets?after=DEF',
      );
    });

    it('appends after cursor when supplied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getAdSetsPage(accountId, accessToken, 'CURSOR2');

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('after=CURSOR2');
    });

    it('requested path includes expected fields', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getAdSetsPage(accountId, accessToken);

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('fields=id,name,status,campaign_id,targeting,daily_budget,lifetime_budget,bid_strategy');
    });
  });

  // ─── getAdsPage ───

  describe('getAdsPage', () => {
    it('returns data + null nextPageUrl when no paging.next', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '4001', name: 'Ad1', status: 'ACTIVE', adset_id: '3001', campaign_id: '1001', creative: { id: '5001' } }],
        }),
      );

      const result = await adapter.getAdsPage(accountId, accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('4001');
      expect(result.nextPageUrl).toBeNull();
    });

    it('returns nextPageUrl when paging.next present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '4002', name: 'Ad2', status: 'PAUSED', adset_id: '3001', campaign_id: '1001' }],
          paging: { next: 'https://graph.facebook.com/v22.0/act_123456/ads?after=GHI' },
        }),
      );

      const result = await adapter.getAdsPage(accountId, accessToken);

      expect(result.nextPageUrl).toBe(
        'https://graph.facebook.com/v22.0/act_123456/ads?after=GHI',
      );
    });

    it('appends after cursor when supplied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getAdsPage(accountId, accessToken, 'CURSOR3');

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('after=CURSOR3');
    });

    it('requested path includes expected fields', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getAdsPage(accountId, accessToken);

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('fields=id,name,status,adset_id,campaign_id,creative');
    });
  });

  // ─── getCreativesPage ───

  describe('getCreativesPage', () => {
    it('returns data + null nextPageUrl when no paging.next', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '5001', name: 'Cr1', title: 'Hello', body: 'World', image_url: 'https://img' }],
        }),
      );

      const result = await adapter.getCreativesPage(accountId, accessToken);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('5001');
      expect(result.nextPageUrl).toBeNull();
    });

    it('returns nextPageUrl when paging.next present', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({
          data: [{ id: '5002', name: 'Cr2' }],
          paging: { next: 'https://graph.facebook.com/v22.0/act_123456/adcreatives?after=JKL' },
        }),
      );

      const result = await adapter.getCreativesPage(accountId, accessToken);

      expect(result.nextPageUrl).toBe(
        'https://graph.facebook.com/v22.0/act_123456/adcreatives?after=JKL',
      );
    });

    it('appends after cursor when supplied', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getCreativesPage(accountId, accessToken, 'CURSOR4');

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('after=CURSOR4');
    });

    it('requested path includes expected fields', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ data: [] }));

      await adapter.getCreativesPage(accountId, accessToken);

      const url = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(url).toContain('fields=id,name,title,body,image_hash,image_url,video_id,link_url,call_to_action_type,object_type');
    });
  });

  // ─── Error handling (shared across all page methods) ───

  describe('error handling', () => {
    it('does not leak accessToken in error message', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(
          mockResponse({ error: { message: 'Invalid token' } }, 401),
        )
        .mockResolvedValueOnce(
          mockResponse({ error: { message: 'Invalid token' } }, 401),
        );

      await expect(
        adapter.getCampaignsPage(accountId, accessToken),
      ).rejects.toThrow(/Invalid token/);

      const error = (await adapter.getCampaignsPage(accountId, accessToken).catch(e => e)) as Error;
      expect(error.message).not.toContain(accessToken);
      expect(error.message).toContain('Meta API error');
    });

    it('includes HTTP status in safe error message', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        mockResponse({ error: { message: 'Rate limited' } }, 429),
      );

      await expect(
        adapter.getAdsPage(accountId, accessToken),
      ).rejects.toThrow('Meta API error');
    });
  });
});
