import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import type { MetaClientPort, MetaWritePort } from '@/core/optimization/meta-client.port';

/**
 * Adapter separation — MetaReadAdapter, MetaWriteAdapter, MetaApiAdapter
 *
 * Verifies:
 *  1. MetaReadAdapter implements MetaClientPort (read methods present)
 *  2. MetaWriteAdapter implements MetaWritePort (write methods present)
 *  3. MetaReadAdapter has NO mutation methods
 *  4. MetaApiAdapter (deprecated) extends MetaReadAdapter, delegates writes to MetaWriteAdapter
 *  5. Type-level satisfaction of port interfaces
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function mockResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// 1. MetaReadAdapter implements MetaClientPort
// ---------------------------------------------------------------------------

describe('MetaReadAdapter implements MetaClientPort', () => {
  let ReadAdapter: typeof import('@/infrastructure/meta/meta-api.adapter').MetaReadAdapter;
  let adapter: InstanceType<typeof ReadAdapter>;

  const accessToken = 'test-token-hide-this';
  const accountId = 'act_123';

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('@/infrastructure/meta/meta-api.adapter');
    ReadAdapter = mod.MetaReadAdapter;
    adapter = new ReadAdapter();
  });

  afterEach(() => vi.clearAllMocks());
  afterAll(() => vi.restoreAllMocks());

  // --- MetaClientPort contract methods ---

  it('has getAccounts', () => {
    expect(typeof adapter.getAccounts).toBe('function');
  });

  it('has getCampaigns', () => {
    expect(typeof adapter.getCampaigns).toBe('function');
  });

  it('has getInsights', () => {
    expect(typeof adapter.getInsights).toBe('function');
  });

  it('has getAdCreatives', () => {
    expect(typeof adapter.getAdCreatives).toBe('function');
  });

  // --- Paginated page methods ---

  it('has getCampaignsPage', () => {
    expect(typeof adapter.getCampaignsPage).toBe('function');
  });

  it('has getAdSetsPage', () => {
    expect(typeof adapter.getAdSetsPage).toBe('function');
  });

  it('has getAdsPage', () => {
    expect(typeof adapter.getAdsPage).toBe('function');
  });

  it('has getCreativesPage', () => {
    expect(typeof adapter.getCreativesPage).toBe('function');
  });

  it('has getDailyAdInsightsPage', () => {
    expect(typeof adapter.getDailyAdInsightsPage).toBe('function');
  });

  // --- Paginated methods return { data, nextPageUrl } ---

  it('getCampaignsPage returns { data, nextPageUrl }', async () => {
    const body = {
      data: [{ id: '1', name: 'Test' }],
      paging: { next: 'https://graph.facebook.com/v19.0/next' },
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getCampaignsPage(accountId, accessToken);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('nextPageUrl');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.nextPageUrl).toBe(body.paging.next);
  });

  it('getCampaignsPage returns nextPageUrl null when no paging', async () => {
    const body = { data: [{ id: '1' }] };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getCampaignsPage(accountId, accessToken);

    expect(result.nextPageUrl).toBeNull();
  });

  it('getAdSetsPage returns { data, nextPageUrl }', async () => {
    const body = { data: [{ id: 'as1' }], paging: { next: 'next-url' } };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getAdSetsPage(accountId, accessToken);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('nextPageUrl');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('getAdsPage returns { data, nextPageUrl }', async () => {
    const body = { data: [{ id: 'ad1' }] };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getAdsPage(accountId, accessToken);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('nextPageUrl');
    expect(result.nextPageUrl).toBeNull();
  });

  it('getCreativesPage returns { data, nextPageUrl }', async () => {
    const body = { data: [{ id: 'cr1' }], paging: { next: 'cursor' } };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getCreativesPage(accountId, accessToken);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('nextPageUrl');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('getDailyAdInsightsPage returns { data, nextPageUrl }', async () => {
    const body = { data: [{ date_start: '2024-01-01' }] };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse(body));

    const result = await adapter.getDailyAdInsightsPage(
      accountId,
      { since: '2024-01-01', until: '2024-01-31' },
      accessToken,
    );

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('nextPageUrl');
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. MetaWriteAdapter implements MetaWritePort
// ---------------------------------------------------------------------------

describe('MetaWriteAdapter implements MetaWritePort', () => {
  let WriteAdapter: typeof import('@/infrastructure/meta/meta-api.adapter').MetaWriteAdapter;
  let adapter: InstanceType<typeof WriteAdapter>;

  const accessToken = 'test-token-hide-this';

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('@/infrastructure/meta/meta-api.adapter');
    WriteAdapter = mod.MetaWriteAdapter;
    adapter = new WriteAdapter();
  });

  afterEach(() => vi.clearAllMocks());
  afterAll(() => vi.restoreAllMocks());

  it('has createCampaign', () => {
    expect(typeof adapter.createCampaign).toBe('function');
  });

  it('has updateCampaign', () => {
    expect(typeof adapter.updateCampaign).toBe('function');
  });

  it('has pauseCampaign', () => {
    expect(typeof adapter.pauseCampaign).toBe('function');
  });

  it('has deleteCampaign', () => {
    expect(typeof adapter.deleteCampaign).toBe('function');
  });

  it('createCampaign POSTs to /<accountId>/campaigns', async () => {
    const input = {
      name: 'New Campaign',
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE' as const,
      startTime: '2024-01-01T00:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ id: '123' }));

    await adapter.createCampaign('act_1', input, accessToken);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('act_1/campaigns');
    expect(opts?.method).toBe('POST');
  });

  it('pauseCampaign POSTs status=PAUSED', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ success: true }));

    await adapter.pauseCampaign('campaign_1', accessToken);

    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(opts?.method).toBe('POST');
    expect(opts?.body).toContain('PAUSED');
  });

  it('deleteCampaign sends DELETE method', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ success: true }));

    await adapter.deleteCampaign('campaign_1', accessToken);

    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(opts?.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// 3. MetaReadAdapter has NO mutation methods
// ---------------------------------------------------------------------------

describe('MetaReadAdapter has NO mutation methods', () => {
  let adapter: InstanceType<typeof import('@/infrastructure/meta/meta-api.adapter').MetaReadAdapter>;

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    const mod = await import('@/infrastructure/meta/meta-api.adapter');
    adapter = new mod.MetaReadAdapter();
  });

  it('does NOT have createCampaign', () => {
    expect((adapter as unknown as Record<string, unknown>).createCampaign).toBeUndefined();
  });

  it('does NOT have updateCampaign', () => {
    expect((adapter as unknown as Record<string, unknown>).updateCampaign).toBeUndefined();
  });

  it('does NOT have pauseCampaign', () => {
    expect((adapter as unknown as Record<string, unknown>).pauseCampaign).toBeUndefined();
  });

  it('does NOT have deleteCampaign', () => {
    expect((adapter as unknown as Record<string, unknown>).deleteCampaign).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. MetaApiAdapter (deprecated) extends MetaReadAdapter, delegates writes
// ---------------------------------------------------------------------------

describe('MetaApiAdapter (deprecated)', () => {
  let mod: typeof import('@/infrastructure/meta/meta-api.adapter');
  let adapter: InstanceType<typeof mod.MetaApiAdapter>;

  const accessToken = 'test-token-hide-this';

  beforeAll(async () => {
    vi.stubGlobal('fetch', vi.fn());
    mod = await import('@/infrastructure/meta/meta-api.adapter');
    adapter = new mod.MetaApiAdapter();
  });

  afterEach(() => vi.clearAllMocks());
  afterAll(() => vi.restoreAllMocks());

  it('is an instance of MetaReadAdapter', () => {
    expect(adapter).toBeInstanceOf(mod.MetaReadAdapter);
  });

  it('has all read methods (inherited from MetaReadAdapter)', () => {
    expect(typeof adapter.getAccounts).toBe('function');
    expect(typeof adapter.getCampaigns).toBe('function');
    expect(typeof adapter.getInsights).toBe('function');
    expect(typeof adapter.getAdCreatives).toBe('function');
    expect(typeof adapter.getCampaignsPage).toBe('function');
    expect(typeof adapter.getAdSetsPage).toBe('function');
    expect(typeof adapter.getAdsPage).toBe('function');
    expect(typeof adapter.getCreativesPage).toBe('function');
    expect(typeof adapter.getDailyAdInsightsPage).toBe('function');
  });

  it('has all write methods (delegated to MetaWriteAdapter)', () => {
    expect(typeof adapter.createCampaign).toBe('function');
    expect(typeof adapter.updateCampaign).toBe('function');
    expect(typeof adapter.pauseCampaign).toBe('function');
    expect(typeof adapter.deleteCampaign).toBe('function');
  });

  it('delegates createCampaign to MetaWriteAdapter', async () => {
    const input = {
      name: 'Test',
      objective: 'OUTCOME_SALES',
      status: 'ACTIVE' as const,
      startTime: '2024-01-01T00:00:00Z',
    };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ id: 'c1' }));

    const result = await adapter.createCampaign('act_1', input, accessToken);

    expect(result).toEqual({ id: 'c1' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('act_1/campaigns');
    expect(opts?.method).toBe('POST');
  });

  it('delegates deleteCampaign to MetaWriteAdapter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse({ success: true }));

    await adapter.deleteCampaign('campaign_1', accessToken);

    const [, opts] = vi.mocked(fetch).mock.calls[0];
    expect(opts?.method).toBe('DELETE');
  });
});

// ---------------------------------------------------------------------------
// 5. Type-level checks — adapters satisfy port interfaces
// ---------------------------------------------------------------------------

describe('Type-level: adapter satisfies port interfaces', () => {
  it('MetaReadAdapter satisfies MetaClientPort', () => {
    // Compile-time check: assign to the interface type
    const _: MetaClientPort = {} as InstanceType<
      typeof import('@/infrastructure/meta/meta-api.adapter').MetaReadAdapter
    >;
    expect(true).toBe(true);
  });

  it('MetaWriteAdapter satisfies MetaWritePort', () => {
    const _: MetaWritePort = {} as InstanceType<
      typeof import('@/infrastructure/meta/meta-api.adapter').MetaWriteAdapter
    >;
    expect(true).toBe(true);
  });

  it('MetaApiAdapter satisfies MetaClientPort (via inheritance)', () => {
    const _: MetaClientPort = {} as InstanceType<
      typeof import('@/infrastructure/meta/meta-api.adapter').MetaApiAdapter
    >;
    expect(true).toBe(true);
  });
});
