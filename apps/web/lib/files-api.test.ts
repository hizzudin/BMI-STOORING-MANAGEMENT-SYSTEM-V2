// @vitest-environment node
import { createApiClient } from '@bmi/api-client';
import { describe, expect, it, vi } from 'vitest';
import { filesApi, putToStorage } from './files-api';

function stubbed() {
  const fetchStub = vi.fn<typeof fetch>(() =>
    Promise.resolve(
      new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    ),
  );
  const api = filesApi(createApiClient('http://web.test/api', { fetch: fetchStub }));
  const request = (call = 0) => fetchStub.mock.calls[call]?.[0] as Request;
  return { api, request };
}

describe('REQ-FUP-004 the file routes through the generated client', () => {
  it('NFR-01 the upload link and the uploaded signal carry their Idempotency-Key', async () => {
    const { api, request } = stubbed();
    await api.requestLink(
      {
        profile: 'Photo',
        contentType: 'image/jpeg',
        bytes: 1000,
        originalName: 'IMG.jpg',
        captureSource: 'File',
        capturedAt: null,
      },
      'key-1',
    );
    await api.markUploaded(7, 'key-2');
    await api.get(7);
    expect(new URL(request(0).url).pathname).toBe('/api/files/upload-links');
    expect(request(0).headers.get('Idempotency-Key')).toBe('key-1');
    expect(new URL(request(1).url).pathname).toBe('/api/files/7/uploaded');
    expect(request(1).headers.get('Idempotency-Key')).toBe('key-2');
    expect(new URL(request(2).url).pathname).toBe('/api/files/7');
  });

  it('REQ-FUP-004 the bytes go straight to the signed link with its headers; a failure is false', async () => {
    const fetchStub = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    const blob = new Blob([new Uint8Array(3)], { type: 'image/jpeg' });
    const upload = {
      url: 'https://storage.test/put',
      method: 'PUT' as const,
      headers: { 'content-type': 'image/jpeg' },
      expiresAt: '',
    };
    expect(await putToStorage(upload, blob, fetchStub)).toBe(true);
    const [url, init] = fetchStub.mock.calls[0] ?? [];
    expect(url).toBe('https://storage.test/put');
    expect(init).toMatchObject({
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: blob,
    });

    fetchStub.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(await putToStorage(upload, blob, fetchStub)).toBe(false);
    fetchStub.mockRejectedValueOnce(new TypeError('offline'));
    expect(await putToStorage(upload, blob, fetchStub)).toBe(false);
  });
});
