import { describe, expect, it, vi } from 'vitest';
import { signIn, uploadPhoto, type Fetcher, type SpikeFile } from './spike-api';

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
  // The device runs of 2026-11-28 found that the picker's fileSize can differ from the bytes on
  // disk ("The file does not match the signed link."), and that fetch(uri).blob() in Expo Go reads
  // "File not found" (14 bytes). So the size and the PUT both go through the platform's file access.
  const photo = { uri: 'file:///photo.jpg', contentType: 'image/jpeg' };
  let keys = 0;
  const key = () => `key-${(keys += 1)}`;

  function device(put: SpikeFile['put'] = () => Promise.resolve({ status: 200, body: '' })) {
    return {
      size: vi.fn<SpikeFile['size']>(() => Promise.resolve(8_357_472)),
      put: vi.fn<SpikeFile['put']>(put),
    };
  }

  function server() {
    return vi.fn<Fetcher>((url) => {
      if (url.endsWith('/files/upload-links')) {
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
      // The worker turns it Ready later (REQ-FUP-005); right after the signal it is still Pending.
      return Promise.resolve(json(200, { file: { id: 77, status: 'Pending' } }));
    });
  }

  it('REQ-FUP-004 uploadPhoto asks a Photo upload link with the size on disk and capture source Camera, then PUTs the file with the given headers', async () => {
    const fetcher = server();
    const file = device();
    await uploadPhoto(fetcher, API, 'token-1', photo, file, key);
    expect(file.size).toHaveBeenCalledWith('file:///photo.jpg');
    const [linkUrl, linkInit] = fetcher.mock.calls[0] ?? [];
    expect(linkUrl).toBe(`${API}/files/upload-links`);
    expect(new Headers(linkInit?.headers).get('authorization')).toBe('Bearer token-1');
    expect(JSON.parse(String(linkInit?.body))).toEqual({
      profile: 'Photo',
      contentType: 'image/jpeg',
      bytes: 8_357_472,
      originalName: null,
      captureSource: 'Camera',
    });
    expect(file.put).toHaveBeenCalledWith(
      `${API}/storage/fs/put?sig=abc`,
      { 'Content-Type': 'image/jpeg' },
      'file:///photo.jpg',
    );
  });

  it('REQ-FUP-005 uploadPhoto signals uploaded and returns the file id and status', async () => {
    const fetcher = server();
    const uploaded = await uploadPhoto(fetcher, API, 'token-1', photo, device(), key);
    const [doneUrl, doneInit] = fetcher.mock.calls[1] ?? [];
    expect(doneUrl).toBe(`${API}/files/77/uploaded`);
    expect(doneInit?.method).toBe('POST');
    expect(uploaded).toEqual({ id: 77, status: 'Pending' });
  });

  it('NFR-01 each POST carries its own Idempotency-Key', async () => {
    const fetcher = server();
    await uploadPhoto(fetcher, API, 'token-1', photo, device(), key);
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
    const file = device();
    await expect(uploadPhoto(fetcher, API, 'token-1', photo, file, key)).rejects.toThrow(
      'This file is larger than 30 MB.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(file.put).not.toHaveBeenCalled();
  });

  it('REQ-FUP-004 a refused PUT throws the storage sentence and no uploaded signal is sent', async () => {
    const fetcher = server();
    const file = device(() =>
      Promise.resolve({
        status: 400,
        body: JSON.stringify({ message: 'The file does not match the signed link.' }),
      }),
    );
    await expect(uploadPhoto(fetcher, API, 'token-1', photo, file, key)).rejects.toThrow(
      'The file does not match the signed link.',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
