import type { StoredFile } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploadQueue, type QueueDeps } from '../../lib/uploads/upload-queue';
import { FileDrop, SubmitWhenReady } from './FileDrop';
import { UploadProvider } from './UploadProvider';

afterEach(cleanup);

const stored = (id: number, status: StoredFile['status']): StoredFile => ({
  id,
  profile: 'Photo',
  status,
  rejectReason: null,
  originalName: 'IMG_0001.jpg',
  originalBytes: 4_404_019,
  storedBytes: status === 'Ready' ? 421_888 : null,
  width: status === 'Ready' ? 1600 : null,
  height: status === 'Ready' ? 1200 : null,
  pageCount: null,
  capturedAt: null,
  thumbnailUrl: status === 'Ready' ? `https://files.test/${id}-thumb.jpg` : null,
  fileUrl: status === 'Ready' ? `https://files.test/${id}.jpg` : null,
  uploadedBy: { name: 'Joko', role: 'Mechanic' },
  uploadedAt: '2026-11-18T06:58:02.000Z',
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** A queue over fake routes; `put` lets a test decide when a PUT lands. */
function fakeQueue(options: { put?: QueueDeps['put'] } = {}) {
  let nextId = 1;
  const deps: QueueDeps = {
    prepare: async (file) => ({
      ok: true,
      blob: file,
      contentType: 'image/jpeg',
      capturedAt: null,
    }),
    requestLink: async () => {
      const id = nextId++;
      return {
        ok: true,
        data: {
          file: stored(id, 'Pending'),
          upload: { url: `https://storage.test/${id}`, method: 'PUT', headers: {}, expiresAt: '' },
        },
      };
    },
    put: options.put ?? (async () => true),
    markUploaded: async (id) => ({ ok: true, data: { file: stored(id, 'Pending') } }),
    get: async (id) => ({ ok: true, data: { file: stored(id, 'Ready') } }),
    wait: async () => {},
    newKey: () => crypto.randomUUID(),
    previewOf: () => null,
  };
  return new UploadQueue(deps);
}

const photo = (name = 'IMG_0001.jpg') =>
  new File([new Uint8Array(8)], name, { type: 'image/jpeg' });
const settle = async () => {
  for (let i = 0; i < 40; i++) await Promise.resolve();
};

async function pick(files: File[]) {
  const input = screen.getByLabelText('Add files to Repair photos');
  await act(async () => {
    fireEvent.change(input, { target: { files } });
    await settle();
  });
}

function show(queue: UploadQueue, extra?: ReactNode) {
  return render(
    <UploadProvider queue={queue}>
      <FileDrop slot="repair" profile="Photo" title="Repair photos" />
      {extra}
    </UploadProvider>,
  );
}

describe('FileDrop (REQ-FUP-007, REQ-FUP-012, FileUploadStates)', () => {
  it('REQ-FUP-012 shows the slot, the drop area and the note of the artboard', () => {
    show(fakeQueue());
    expect(screen.getByRole('heading', { name: 'Repair photos' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Drop photos or PDF, or take a photo' }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Compression, upload and retries run in the background; Submit sends when the photos finish.',
      ),
    ).toBeTruthy();
  });

  it('REQ-FUP-007 a thumbnail shows only in progress, then done', async () => {
    const landed = deferred<boolean>();
    show(fakeQueue({ put: () => landed.promise }));
    await pick([photo()]);
    expect(screen.getByRole('button', { name: 'IMG_0001.jpg, in progress' })).toBeTruthy();
    await act(async () => {
      landed.resolve(true);
      await settle();
    });
    expect(screen.getByRole('button', { name: 'IMG_0001.jpg, done' })).toBeTruthy();
  });

  it('AC-FUP-009 the words Compressing, Processing and the sizes are not on the thumbnails, only in the detail panel', async () => {
    show(fakeQueue());
    await pick([new File([new Uint8Array(4_404_019)], 'IMG_0001.jpg', { type: 'image/jpeg' })]);
    const thumbs = screen.getByRole('list', { name: 'Repair photos files' });
    expect(thumbs.textContent).not.toMatch(/Compressing|Processing|MB|KB/);
    expect(within(thumbs).getByRole('button').getAttribute('aria-label')).not.toMatch(
      /Compressing|Processing|MB|KB/,
    );
    expect(screen.queryByText('4,2 MB')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'IMG_0001.jpg, done' }));
    const panel = screen.getByRole('region', { name: 'Detail panel' });
    expect(within(panel).getByText('Original').nextSibling?.textContent).toBe('4,2 MB');
    expect(within(panel).getByText('Stored').nextSibling?.textContent).toBe('412 KB · 1600 × 1200');
    expect(within(panel).getByText('Profile').nextSibling?.textContent).toBe('Photo');
  });

  it('REQ-FUP-007 a file that needs attention offers Retry, and Remove takes it out of the slot', async () => {
    let works = false;
    show(fakeQueue({ put: async () => works }));
    await pick([photo('bad.jpg')]);
    fireEvent.click(screen.getByRole('button', { name: 'bad.jpg, needs attention' }));
    const panel = screen.getByRole('region', { name: 'Detail panel' });
    expect(within(panel).getByText('This file was not sent. Retry, or remove it.')).toBeTruthy();
    works = true;
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
      await settle();
    });
    expect(screen.getByRole('button', { name: 'bad.jpg, done' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('button', { name: /bad\.jpg/ })).toBeNull();
  });

  it('REQ-FUP-014 the slot says when a file is still uploading, so the screen can ask once before leaving', async () => {
    const landed = deferred<boolean>();
    const onUploadingChange = vi.fn();
    render(
      <UploadProvider queue={fakeQueue({ put: () => landed.promise })}>
        <FileDrop
          slot="repair"
          profile="Photo"
          title="Repair photos"
          onUploadingChange={onUploadingChange}
        />
      </UploadProvider>,
    );
    await pick([photo()]);
    expect(onUploadingChange).toHaveBeenLastCalledWith(true);
    await act(async () => {
      landed.resolve(true);
      await settle();
    });
    expect(onUploadingChange).toHaveBeenLastCalledWith(false);
  });
});

describe('SubmitWhenReady (REQ-FUP-006, C-18)', () => {
  it('AC-FUP-004 Submit while a photo uploads shows "Sending when photos finish…" and submits by itself once, without a second tap', async () => {
    const landed = deferred<boolean>();
    const onSubmit = vi.fn();
    show(
      fakeQueue({ put: () => landed.promise }),
      <SubmitWhenReady slots={['repair']} label="Submit step" onSubmit={onSubmit} />,
    );
    await pick([photo()]);
    fireEvent.click(screen.getByRole('button', { name: 'Submit step' }));
    const waiting = screen.getByRole('button', { name: 'Sending when photos finish…' });
    expect(waiting.hasAttribute('disabled')).toBe(true);
    expect(waiting.getAttribute('aria-busy')).toBe('true');
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => {
      landed.resolve(true);
      await settle();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Submit step' })).toBeTruthy();
  });
});
