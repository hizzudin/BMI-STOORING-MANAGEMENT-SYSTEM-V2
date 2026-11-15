// @vitest-environment node
// This test needs no DOM, so it does not wait for jsdom to load.
import { createApiClient } from '@bmi/api-client';
import { describe, expect, it, vi } from 'vitest';
import { approvalsApi } from './approvals-api';

function stubbed() {
  const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  const api = approvalsApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
  const request = (call = 0) => fetchStub.mock.calls[call]?.[0] as Request;
  return { api, request };
}

describe('REQ-APR-002 REQ-APR-007 Approvals asks the API through the generated client', () => {
  it('DEC-128 the chip and the search go in the query string', async () => {
    const { api, request } = stubbed();
    await api.inbox({ kind: 'Creation', search: 'B 12' });
    await api.history({ decision: 'Reject' });
    const inbox = new URL(request(0).url);
    expect(inbox.pathname).toBe('/api/approvals/spk');
    expect(Object.fromEntries(inbox.searchParams)).toEqual({ kind: 'Creation', search: 'B 12' });
    const history = new URL(request(1).url);
    expect(history.pathname).toBe('/api/approvals/history');
    expect(history.searchParams.get('decision')).toBe('Reject');
  });

  it('NFR-01 a decision carries its Idempotency-Key and the version', async () => {
    const { api, request } = stubbed();
    await api.approve(5, { version: 2 }, 'key-1');
    await api.reject(5, { version: 2, reason: 'Wrong vehicle' }, 'key-2');
    expect(new URL(request(0).url).pathname).toBe('/api/approvals/spk/5/approve');
    expect(request(0).headers.get('Idempotency-Key')).toBe('key-1');
    expect(await request(0).json()).toEqual({ version: 2 });
    expect(new URL(request(1).url).pathname).toBe('/api/approvals/spk/5/reject');
    expect(request(1).headers.get('Idempotency-Key')).toBe('key-2');
    expect(await request(1).json()).toEqual({ version: 2, reason: 'Wrong vehicle' });
  });
});
