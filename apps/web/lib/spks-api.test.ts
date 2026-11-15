// @vitest-environment node
// This test needs no DOM, so it does not wait for jsdom to load.
import { createApiClient } from '@bmi/api-client';
import { describe, expect, it, vi } from 'vitest';
import { spksApi } from './spks-api';

describe('REQ-SPK-010 SPKList asks the API through the generated client', () => {
  it('DEC-127 the tab, filters and page go in the query string', async () => {
    const fetchStub = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const api = spksApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
    await api.list({ tab: 'draft', page: 2, pageSize: 50, search: '9012', vehicleId: 7 });
    const url = new URL((fetchStub.mock.calls[0]?.[0] as Request).url);
    expect(url.pathname).toBe('/api/spks');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tab: 'draft',
      page: '2',
      pageSize: '50',
      search: '9012',
      vehicleId: '7',
    });
  });
});
