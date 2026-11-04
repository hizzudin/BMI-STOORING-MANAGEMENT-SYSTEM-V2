import { describe, expect, it } from 'vitest';
import { createApiClient } from './index.js';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (input) => {
    const url = input instanceof Request ? input.url : String(input);
    return Promise.resolve(
      new Response(JSON.stringify({ requestedUrl: url, ...(body as object) }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
}

describe('DEC-66 generated API client', () => {
  it('DEC-66 calls a path of the contract against the base URL and returns its typed body', async () => {
    const api = createApiClient('http://api.test', { fetch: fakeFetch(200, { status: 'ok' }) });
    const { data } = await api.GET('/health');
    expect(data).toMatchObject({ status: 'ok', requestedUrl: 'http://api.test/health' });
  });

  it('DEC-66 hands an error status back as the error, not as data', async () => {
    const api = createApiClient('http://api.test', { fetch: fakeFetch(500, { message: 'down' }) });
    const { data, response } = await api.GET('/health');
    expect(data).toBeUndefined();
    expect(response.status).toBe(500);
  });
});
