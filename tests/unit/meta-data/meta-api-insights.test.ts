import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';

// Minimal mock for config import used inside the adapter
vi.mock('@/infrastructure/config', () => ({
  config: { meta: { apiVersion: 'v21.0' } },
}));

describe('MetaApiAdapter.getDailyAdInsightsPage', () => {
  let adapter: MetaApiAdapter;
  let fetchSpy: ReturnType<typeof vi.fn>;

  const ACCOUNT_ID = 'act_123456';
  const ACCESS_TOKEN = 'test-token';
  const WINDOW = { since: '2025-01-01', until: '2025-01-31' };

  beforeEach(() => {
    adapter = new MetaApiAdapter();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetch(body: unknown) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    });
  }

  it('builds correct URL with level=ad, time_range, and insights fields', async () => {
    mockFetch({ data: [], paging: {} });

    await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    // Should target /{accountId}/insights
    expect(calledUrl).toContain(`${ACCOUNT_ID}/insights`);
    // Should include level=ad
    expect(calledUrl).toContain('level=ad');
    // Should include time_range with since/until
    expect(calledUrl).toContain(`time_range={'since':'${WINDOW.since}','until':'${WINDOW.until}'}`);
    // Should include all required fields
    expect(calledUrl).toContain('date_start');
    expect(calledUrl).toContain('date_stop');
    expect(calledUrl).toContain('campaign_id');
    expect(calledUrl).toContain('adset_id');
    expect(calledUrl).toContain('ad_id');
    expect(calledUrl).toContain('spend');
    expect(calledUrl).toContain('impressions');
    expect(calledUrl).toContain('reach');
    expect(calledUrl).toContain('clicks');
    expect(calledUrl).toContain('actions');
    expect(calledUrl).toContain('action_values');
    // Should include access_token
    expect(calledUrl).toContain(`access_token=${ACCESS_TOKEN}`);
  });

  it('returns raw date_start, date_stop, actions, and action_values without conversion', async () => {
    const rawActions = [
      { action_type: 'link_click', value: '5' },
      { action_type: 'purchase', value: '2' },
    ];
    const rawActionValues = [
      { action_type: 'purchase', value: '150.00' },
    ];
    const mockRow = {
      date_start: '2025-01-15',
      date_stop: '2025-01-15',
      campaign_id: '1001',
      adset_id: '2001',
      ad_id: '3001',
      spend: '12.50',
      impressions: '500',
      reach: '350',
      clicks: '25',
      actions: rawActions,
      action_values: rawActionValues,
    };
    mockFetch({ data: [mockRow], paging: {} });

    const result = await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN);

    expect(result.data).toHaveLength(1);
    const row = result.data[0];
    expect(row.date_start).toBe('2025-01-15');
    expect(row.date_stop).toBe('2025-01-15');
    expect(row.campaign_id).toBe('1001');
    expect(row.adset_id).toBe('2001');
    expect(row.ad_id).toBe('3001');
    expect(row.spend).toBe('12.50');
    expect(row.impressions).toBe('500');
    expect(row.reach).toBe('350');
    expect(row.clicks).toBe('25');
    // Raw arrays preserved, not converted
    expect(row.actions).toEqual(rawActions);
    expect(row.action_values).toEqual(rawActionValues);
  });

  it('returns nextPageUrl from paging.next when present', async () => {
    const nextPageUrl = 'https://graph.facebook.com/v21.0/act_123456/insights?after=cursor123&access_token=test-token';
    mockFetch({
      data: [],
      paging: { next: nextPageUrl },
    });

    const result = await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN);

    expect(result.nextPageUrl).toBe(nextPageUrl);
  });

  it('returns null nextPageUrl when paging.next is absent', async () => {
    mockFetch({ data: [], paging: {} });

    const result = await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN);

    expect(result.nextPageUrl).toBeNull();
  });

  it('appends after cursor when supplied', async () => {
    mockFetch({ data: [], paging: {} });

    await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN, 'cursorABC');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('after=cursorABC');
  });

  it('does not append after cursor when omitted', async () => {
    mockFetch({ data: [], paging: {} });

    await adapter.getDailyAdInsightsPage(ACCOUNT_ID, WINDOW, ACCESS_TOKEN);

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('after=');
  });
});
