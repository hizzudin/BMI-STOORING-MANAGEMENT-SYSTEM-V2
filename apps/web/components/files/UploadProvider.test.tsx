import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('browser-image-compression', () => ({
  default: vi.fn(
    async (file: File) => new Blob([await file.arrayBuffer()], { type: 'image/jpeg' }),
  ),
}));
vi.mock('exifr', () => ({ default: { parse: vi.fn(async () => undefined) } }));

const { FileDrop } = await import('./FileDrop');
const { UploadProvider, useUploadQueue } = await import('./UploadProvider');

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

const file = (status: string) => ({
  id: 9,
  profile: 'Photo',
  status,
  rejectReason: null,
  originalName: 'IMG.jpg',
  originalBytes: 4,
  storedBytes: status === 'Ready' ? 4 : null,
  width: status === 'Ready' ? 1 : null,
  height: status === 'Ready' ? 1 : null,
  pageCount: null,
  capturedAt: null,
  thumbnailUrl: status === 'Ready' ? 'https://files.test/9-thumb.jpg' : null,
  fileUrl: status === 'Ready' ? 'https://files.test/9.jpg' : null,
  uploadedBy: { name: 'Joko', role: 'Mechanic' },
  uploadedAt: '2026-11-18T06:00:00.000Z',
});

describe('UploadProvider (DEC-139)', () => {
  it('DEC-139 without a queue it sends files through the real routes: link, PUT to storage, uploaded, then Ready', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(String(input), init);
        const path = new URL(request.url).pathname;
        seen.push(`${request.method} ${path}`);
        if (path === '/api/files/upload-links') {
          return json({
            file: file('Pending'),
            upload: { url: 'https://storage.test/put', method: 'PUT', headers: {}, expiresAt: '' },
          });
        }
        if (path === '/put') return new Response(null, { status: 200 });
        if (path === '/api/files/9/uploaded') return json({ file: file('Pending') });
        return json({ file: file('Ready') });
      }),
    );
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:preview' }));
    render(
      <UploadProvider>
        <FileDrop slot="repair" profile="Photo" title="Repair photos" />
      </UploadProvider>,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Add files to Repair photos'), {
        target: {
          files: [
            new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'IMG.jpg', { type: 'image/jpeg' }),
          ],
        },
      });
      for (let i = 0; i < 60; i++) await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(seen).toEqual([
      'POST /api/files/upload-links',
      'PUT /put',
      'POST /api/files/9/uploaded',
      'GET /api/files/9',
    ]);
    expect(screen.getByRole('button', { name: 'IMG.jpg, done' })).toBeTruthy();
  });

  it('REQ-FUP-013 back online, the queue sends again what could not be sent', () => {
    let queue: ReturnType<typeof useUploadQueue> | null = null;
    function Probe() {
      queue = useUploadQueue();
      return null;
    }
    render(
      <UploadProvider>
        <Probe />
      </UploadProvider>,
    );
    const online = vi.spyOn(queue as unknown as { online: () => void }, 'online');
    window.dispatchEvent(new Event('online'));
    expect(online).toHaveBeenCalledTimes(1);
  });

  it('a component outside the provider is told so', () => {
    function Orphan() {
      useUploadQueue();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Orphan />)).toThrow('useUploadQueue needs an UploadProvider above it');
  });
});
