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

  it('NFR-01 T6 Cancel SPK carries its Idempotency-Key, the version and the reason', async () => {
    const fetchStub = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const api = spksApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
    await api.cancel(25, { version: 4, reason: 'Raised twice' }, 'key-9');
    const request = fetchStub.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/spks/25/cancel');
    expect(request.headers.get('Idempotency-Key')).toBe('key-9');
    expect(await request.json()).toEqual({ version: 4, reason: 'Raised twice' });
  });

  it('NFR-01 T15 the approver cancel goes to its own route with the key, the version and the reason', async () => {
    const fetchStub = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const api = spksApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
    await api.approverCancel(41, { version: 3, reason: 'Vehicle sold' }, 'key-15');
    const request = fetchStub.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/spks/41/approver-cancel');
    expect(request.headers.get('Idempotency-Key')).toBe('key-15');
    expect(await request.json()).toEqual({ version: 3, reason: 'Vehicle sold' });
  });
});
