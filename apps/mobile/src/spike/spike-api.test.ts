import { describe, expect, it, vi } from 'vitest';
import { signIn, uploadPhoto, type Fetcher } from './spike-api';

// TASK-127 part A (NFR-18, DEC-141, DEC-142): the spike's calls to the API, without a phone.

const API = 'http://192.168.1.20:3001';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('spike sign-in', () => {
  it('NFR-18 signIn posts the email, the password and client mobile, and returns the token and the user', async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(
        json(200, {
          user: { id: 4, name: 'Yusuf', email: 'sa.qa@bmi.test', role: 'System_Admin' },
          accessToken: 'token-1',
          refreshToken: 'refresh-1',
        }),
      ),
    );
    const session = await signIn(fetcher, API, 'sa.qa@bmi.test', 'secret-1');
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(`${API}/auth/sign-in`);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      email: 'sa.qa@bmi.test',
      password: 'secret-1',
      client: 'mobile',
    });
    expect(session).toEqual({
      accessToken: 'token-1',
      user: { name: 'Yusuf', role: 'System_Admin' },
    });
  });

  it('REQ-IAM-001 signIn throws the server sentence on 401', async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(
        json(401, { statusCode: 401, message: 'The email or password is not correct.' }),
      ),
    );
    await expect(signIn(fetcher, API, 'sa.qa@bmi.test', 'wrong')).rejects.toThrow(
      'The email or password is not correct.',
    );
  });
});

describe('spike photo upload', () => {
  const photo = { uri: 'file:///photo.jpg', bytes: 2048, contentType: 'image/jpeg' };
  const blob = new Blob(['jpeg-bytes'], { type: 'image/jpeg' });
  const body = vi.fn(() => Promise.resolve(blob));
  let keys = 0;
  const key = () => `key-${(keys += 1)}`;

  function server() {
    return vi.fn<Fetcher>((url) => {
      const path = String(url);
      if (path.endsWith('/files/upload-links')) {
        return Promise.resolve(
          json(201, {
            file: { id: 77, status: 'Pending' },
            upload: {
              url: `${API}/storage/fs/put?sig=abc`,
              method: 'PUT',
              headers: { 'Content-Type': 'image/jpeg' },
              expiresAt: '2026-11-28T10:15:00Z',
            },
          }),
        );
      }
      if (path.includes('/storage/fs/put')) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      // The worker turns it Ready later (REQ-FUP-005); right after the signal it is still Pending.
      return Promise.resolve(json(200, { file: { id: 77, status: 'Pending' } }));
    });
  }

  it('REQ-FUP-004 uploadPhoto asks a Photo upload link with the size and capture source Camera, then PUTs the bytes with the given headers', async () => {
    const fetcher = server();
    await uploadPhoto(fetcher, API, 'token-1', photo, body, key);
    const [linkUrl, linkInit] = fetcher.mock.calls[0] ?? [];
    expect(linkUrl).toBe(`${API}/files/upload-links`);
    expect(new Headers(linkInit?.headers).get('authorization')).toBe('Bearer token-1');
    expect(JSON.parse(String(linkInit?.body))).toEqual({
      profile: 'Photo',
      contentType: 'image/jpeg',
      bytes: 2048,
      originalName: null,
      captureSource: 'Camera',
    });
    const [putUrl, putInit] = fetcher.mock.calls[1] ?? [];
    expect(putUrl).toBe(`${API}/storage/fs/put?sig=abc`);
    expect(putInit?.method).toBe('PUT');
    expect(new Headers(putInit?.headers).get('content-type')).toBe('image/jpeg');
    expect(putInit?.body).toBe(blob);
    expect(body).toHaveBeenCalledWith('file:///photo.jpg');
  });

  it('REQ-FUP-005 uploadPhoto signals uploaded and returns the file id and status', async () => {
    const fetcher = server();
    const uploaded = await uploadPhoto(fetcher, API, 'token-1', photo, body, key);
    const [doneUrl, doneInit] = fetcher.mock.calls[2] ?? [];
    expect(doneUrl).toBe(`${API}/files/77/uploaded`);
    expect(doneInit?.method).toBe('POST');
    expect(uploaded).toEqual({ id: 77, status: 'Pending' });
  });

  it('NFR-01 each POST carries its own Idempotency-Key', async () => {
    const fetcher = server();
    await uploadPhoto(fetcher, API, 'token-1', photo, body, key);
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    const sent = posts.map(([, init]) => new Headers(init?.headers).get('idempotency-key'));
    expect(sent).toHaveLength(2);
    expect(sent.every(Boolean)).toBe(true);
    expect(new Set(sent).size).toBe(2);
  });

  it('REQ-FUP-004 a refused upload link throws its sentence and no PUT is sent', async () => {
    const fetcher = vi.fn<Fetcher>(() =>
      Promise.resolve(json(400, { statusCode: 400, message: 'This file is larger than 30 MB.' })),
    );
    await expect(uploadPhoto(fetcher, API, 'token-1', photo, body, key)).rejects.toThrow(
      'This file is larger than 30 MB.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
