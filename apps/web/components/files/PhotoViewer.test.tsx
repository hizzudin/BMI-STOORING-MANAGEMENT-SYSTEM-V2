import type { StoredFile } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const renderPage = vi.fn(() => ({ promise: Promise.resolve() }));
const openPdf = vi.fn(async () => ({
  numPages: 3,
  getPage: vi.fn(async () => ({
    getViewport: ({ scale }: { scale: number }) => ({ width: 595 * scale, height: 842 * scale }),
    render: renderPage,
  })),
  destroy: vi.fn(async () => {}),
}));
vi.mock('../../lib/uploads/pdf', () => ({ openPdf }));

const { PhotoViewer } = await import('./PhotoViewer');

const file = (id: number, overrides: Partial<StoredFile> = {}): StoredFile => ({
  id,
  profile: 'Photo',
  status: 'Ready',
  rejectReason: null,
  originalName: `IMG_000${id}.jpg`,
  originalBytes: 4_404_019,
  storedBytes: 421_888,
  width: 1600,
  height: 1200,
  pageCount: null,
  capturedAt: '2026-11-18T06:58:02.000Z',
  thumbnailUrl: `https://files.test/${id}-thumb.jpg`,
  fileUrl: `https://files.test/${id}.jpg`,
  uploadedBy: { name: 'Joko', role: 'Mechanic' },
  uploadedAt: '2026-11-18T07:00:10.000Z',
  ...overrides,
});
const invoice = file(3, {
  profile: 'PDF',
  originalName: 'invoice.pdf',
  width: null,
  height: null,
  pageCount: 3,
  capturedAt: null,
  fileUrl: 'https://files.test/3.pdf',
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(new Uint8Array([37, 80, 68, 70]))),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const context = { step: 'Mechanic Action', slot: 'Repair photo' };

describe('PhotoViewer (REQ-FUP-016, C-29, DEC-33)', () => {
  it('REQ-FUP-016 shows the full photo and its details: step, slot, taken at, uploaded by and role, time', () => {
    render(
      <PhotoViewer files={[file(1), file(2)]} start={0} context={context} onClose={() => {}} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'IMG_0001.jpg' });
    expect(within(dialog).getByRole('img', { name: 'IMG_0001.jpg' }).getAttribute('src')).toBe(
      'https://files.test/1.jpg',
    );
    const detail = (label: string) => within(dialog).getByText(label).nextSibling?.textContent;
    expect(detail('Step')).toBe('Mechanic Action');
    expect(detail('Slot')).toBe('Repair photo');
    expect(detail('Taken at')).toBe('2026-11-18 13:58:02');
    expect(detail('Uploaded by')).toBe('Joko · Mechanic');
    expect(detail('Uploaded at')).toBe('2026-11-18 14:00:10');
  });

  it('C-29 previous and next walk the files of the same record', () => {
    render(
      <PhotoViewer files={[file(1), file(2)]} start={0} context={context} onClose={() => {}} />,
    );
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'IMG_0002.jpg' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('dialog', { name: 'IMG_0001.jpg' })).toBeTruthy();
  });

  it('REQ-FUP-016 zoom in and out, and 100% goes back to the whole photo', () => {
    render(<PhotoViewer files={[file(1)]} start={0} context={context} onClose={() => {}} />);
    const level = () => screen.getByText(/^\d+%$/, { selector: '.zoom-level' }).textContent;
    expect(level()).toBe('100%');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(level()).toBe('200%');
    expect(screen.getByRole('img', { name: 'IMG_0001.jpg' }).style.transform).toContain('scale(2)');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(level()).toBe('150%');
    fireEvent.click(screen.getByRole('button', { name: '100%' }));
    expect(level()).toBe('100%');
  });

  it('REQ-FUP-016 a zoomed photo is moved by dragging it', () => {
    render(<PhotoViewer files={[file(1)]} start={0} context={context} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    const image = screen.getByRole('img', { name: 'IMG_0001.jpg' });
    fireEvent.pointerDown(image, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(image, { clientX: 140, clientY: 90, pointerId: 1 });
    fireEvent.pointerUp(image, { pointerId: 1 });
    expect(image.style.transform).toContain('translate(40px, -10px)');
  });

  it('C-14 Close and Esc close the viewer', () => {
    const onClose = vi.fn();
    render(<PhotoViewer files={[file(1)]} start={0} context={context} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('REQ-FUP-016 read only, except Remove for the uploader before submit', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <PhotoViewer files={[file(1)]} start={0} context={context} onClose={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    rerender(
      <PhotoViewer
        files={[file(1)]}
        start={0}
        context={context}
        onClose={() => {}}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it('REQ-FUP-016 a PDF is shown page by page', async () => {
    await act(async () => {
      render(<PhotoViewer files={[invoice]} start={0} context={context} onClose={() => {}} />);
    });
    expect(openPdf).toHaveBeenCalled();
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(
      true,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    });
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    expect(screen.getByText('Taken at').nextSibling?.textContent).toBe('—');
  });
});
