// @vitest-environment node
// This test needs no DOM, so it does not wait for jsdom to load.
import { expect, it, vi } from 'vitest';
import { api } from './api';

it('DEC-66 the web app reaches the API through the generated client', async () => {
  const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response('{"status":"ok"}', { status: 200 })),
  );
  const { data } = await api.GET('/health', { fetch: fetchStub });
  expect(data).toEqual({ status: 'ok' });
  expect(fetchStub).toHaveBeenCalledOnce();
});
