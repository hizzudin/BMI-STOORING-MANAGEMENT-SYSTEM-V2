// @vitest-environment node
import type { StoredFile } from '@bmi/shared';
import { describe, expect, it, vi } from 'vitest';
import { UPLOAD_MESSAGES, UploadQueue, type QueueDeps } from './upload-queue';

const stored = (
  id: number,
  status: StoredFile['status'],
  rejectReason: string | null = null,
): StoredFile => ({
  id,
  profile: 'Photo',
  status,
  rejectReason,
  originalName: 'IMG.jpg',
  originalBytes: 4_200_000,
  storedBytes: status === 'Ready' ? 412_000 : null,
  width: status === 'Ready' ? 1600 : null,
  height: status === 'Ready' ? 1200 : null,
  pageCount: null,
  capturedAt: null,
  thumbnailUrl: status === 'Ready' ? `https://files.test/${id}-thumb.jpg` : null,
  fileUrl: status === 'Ready' ? `https://files.test/${id}.jpg` : null,
  uploadedBy: { name: 'Joko', role: 'Mechanic' },
  uploadedAt: '2026-11-18T06:00:00.000Z',
});

/** Settles the microtasks of the queue's pipeline. */
const flush = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(overrides: Partial<QueueDeps> = {}, finalStatus: StoredFile['status'] = 'Ready') {
  let nextId = 1;
  const statuses = new Map<number, StoredFile['status']>();
  const deps: QueueDeps = {
    prepare: vi.fn(async (file: File) => ({
      ok: true as const,
      blob: file,
      contentType: 'image/jpeg',
      capturedAt: null,
    })),
    requestLink: vi.fn(async () => {
      const id = nextId++;
      statuses.set(id, 'Pending');
      return {
        ok: true as const,
        data: {
          file: stored(id, 'Pending'),
          upload: {
            url: `https://storage.test/${id}`,
            method: 'PUT' as const,
            headers: {},
            expiresAt: '',
          },
        },
      };
    }),
    put: vi.fn(async () => true),
    markUploaded: vi.fn(async (id: number) => {
      statuses.set(id, finalStatus);
      return { ok: true as const, data: { file: stored(id, 'Pending') } };
    }),
    get: vi.fn(async (id: number) => {
      const status = statuses.get(id) ?? 'Pending';
      return {
        ok: true as const,
        data: {
          file: stored(
            id,
            status,
            status === 'Rejected' ? 'This PDF has more than 20 pages.' : null,
          ),
        },
      };
    }),
    wait: vi.fn(async () => {}),
    newKey: (() => {
      let n = 0;
      return () => `key-${++n}`;
    })(),
    previewOf: () => null,
    ...overrides,
  };
  return { queue: new UploadQueue(deps), deps };
}

const photo = (name = 'IMG.jpg') =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], name, { type: 'image/jpeg' });

describe('the upload queue (REQ-FUP-006, REQ-FUP-012, REQ-FUP-013, DEC-139)', () => {
  it('REQ-FUP-012 a picked file is in progress at once, then done when the server says Ready', async () => {
    const { queue } = setup();
    queue.add('repair', 'Photo', [photo()]);
    expect(queue.items('repair').map((item) => item.state)).toEqual(['progress']);
    await flush();
    expect(queue.items('repair')).toEqual([
      expect.objectContaining({
        state: 'done',
        file: expect.objectContaining({ id: 1, status: 'Ready' }),
      }),
    ]);
    expect(queue.readyIds('repair')).toEqual([1]);
  });

  it('AC-FUP-004 Submit pressed while a photo uploads runs once, by itself, when that photo is Ready', async () => {
    const landed = deferred<boolean>();
    const { queue } = setup({ put: vi.fn(() => landed.promise) });
    const submit = vi.fn();
    queue.add('repair', 'Photo', [photo()]);
    await flush();
    queue.submitWhenReady(['repair'], submit);
    expect(queue.isWaiting(['repair'])).toBe(true);
    await flush();
    expect(submit).not.toHaveBeenCalled();

    landed.resolve(true);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(queue.isWaiting(['repair'])).toBe(false);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('REQ-FUP-006 a submit with nothing left to send runs at once', async () => {
    const { queue } = setup();
    const submit = vi.fn();
    queue.submitWhenReady(['empty'], submit);
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it('REQ-FUP-013 a failed upload is retried 3 times with growing waits, then needs attention', async () => {
    const wait = vi.fn(async (_ms: number) => {});
    const { queue, deps } = setup({ put: vi.fn(async () => false), wait });
    queue.add('repair', 'Photo', [photo()]);
    await flush();
    expect(deps.put).toHaveBeenCalledTimes(4);
    expect(wait.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000, 4000]);
    expect(queue.items('repair')[0]).toMatchObject({
      state: 'attention',
      message: UPLOAD_MESSAGES.notSent,
      retryable: true,
    });
  });

  it('REQ-FUP-013 back online, a file that could not be sent is sent again; the link keeps its Idempotency-Key', async () => {
    let online = false;
    const { queue, deps } = setup({ put: vi.fn(async () => online) });
    queue.add('repair', 'Photo', [photo()]);
    await flush();
    expect(queue.items('repair')[0]?.state).toBe('attention');
    online = true;
    queue.online();
    await flush();
    expect(queue.items('repair')[0]?.state).toBe('done');
    const keys = vi.mocked(deps.requestLink).mock.calls.map(([, key]) => key);
    expect(new Set(keys).size).toBe(1);
  });

  it('REQ-FUP-007 Retry sends a file that needs attention again', async () => {
    let works = false;
    const { queue } = setup({ put: vi.fn(async () => works) });
    queue.add('repair', 'Photo', [photo()]);
    await flush();
    works = true;
    queue.retry(queue.items('repair')[0]?.localId ?? '');
    expect(queue.items('repair')[0]?.state).toBe('progress');
    await flush();
    expect(queue.items('repair')[0]?.state).toBe('done');
  });

  it('REQ-FUP-006 a file that needs attention keeps the submit waiting until it is removed', async () => {
    const { queue } = setup({ put: vi.fn(async () => false) });
    const submit = vi.fn();
    queue.add('repair', 'Photo', [photo('bad.jpg')]);
    await flush();
    queue.submitWhenReady(['repair'], submit);
    await flush();
    expect(submit).not.toHaveBeenCalled();
    queue.remove(queue.items('repair')[0]?.localId ?? '');
    await flush();
    expect(submit).toHaveBeenCalledTimes(1);
    expect(queue.items('repair')).toEqual([]);
  });

  it('REQ-FUP-002 a file refused on the device needs attention with its one sentence and is never sent', async () => {
    const { queue, deps } = setup({
      prepare: vi.fn(async () => ({
        ok: false as const,
        reason: 'This file type cannot be used.',
      })),
    });
    queue.add('repair', 'Photo', [photo('clip.jpg')]);
    await flush();
    expect(queue.items('repair')[0]).toMatchObject({
      state: 'attention',
      message: 'This file type cannot be used.',
      retryable: false,
    });
    expect(deps.requestLink).not.toHaveBeenCalled();
  });

  it('REQ-FUP-005 a file the server rejects needs attention with the server sentence', async () => {
    const { queue } = setup({}, 'Rejected');
    queue.add('repair', 'PDF', [photo('long.pdf')]);
    await flush();
    expect(queue.items('repair')[0]).toMatchObject({
      state: 'attention',
      message: 'This PDF has more than 20 pages.',
      retryable: false,
    });
  });

  it('notifies its listeners on every change and keeps one snapshot between changes', async () => {
    const { queue } = setup();
    const listener = vi.fn();
    const stop = queue.subscribe(listener);
    const before = queue.snapshot();
    expect(queue.snapshot()).toBe(before);
    queue.add('repair', 'Photo', [photo()]);
    await flush();
    expect(listener).toHaveBeenCalled();
    expect(queue.snapshot()).not.toBe(before);
    stop();
  });
});
