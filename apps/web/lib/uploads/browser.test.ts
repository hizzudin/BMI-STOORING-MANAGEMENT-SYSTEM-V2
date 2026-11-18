import { beforeEach, describe, expect, it, vi } from 'vitest';

const compression = vi.fn(async () => new Blob([new Uint8Array(5)], { type: 'image/jpeg' }));
vi.mock('browser-image-compression', () => ({ default: compression }));
const parse = vi.fn(async () => ({ DateTimeOriginal: new Date('2026-11-17T06:15:00.000Z') }));
vi.mock('exifr', () => ({ default: { parse } }));
const destroy = vi.fn(async () => {});
vi.mock('./pdf', () => ({ openPdf: vi.fn(async () => ({ numPages: 4, destroy })) }));

const { browserPrepareDeps } = await import('./browser');

beforeEach(() => vi.clearAllMocks());

describe('the browser parts of the device check (DEC-139)', () => {
  it('REQ-FUP-003 compression resizes to the long side at the quality, as JPEG, on the page (no CDN worker)', async () => {
    const file = new File([new Uint8Array(10)], 'IMG.jpg', { type: 'image/jpeg' });
    await browserPrepareDeps.compress(file, { longSide: 1600, quality: 70 });
    expect(compression).toHaveBeenCalledWith(file, {
      maxWidthOrHeight: 1600,
      initialQuality: 0.7,
      maxSizeMB: 100,
      useWebWorker: false,
      fileType: 'image/jpeg',
      preserveExif: false,
    });
  });

  it('DEC-139 the capture time is read with exifr; none is null', async () => {
    const file = new File([new Uint8Array(10)], 'IMG.jpg');
    expect(await browserPrepareDeps.capturedAt(file)).toEqual(new Date('2026-11-17T06:15:00.000Z'));
    parse.mockResolvedValueOnce(undefined as never);
    expect(await browserPrepareDeps.capturedAt(file)).toBeNull();
  });

  it('REQ-FUP-002 the PDF page count comes from pdf.js and the document is closed', async () => {
    const file = new File([new Uint8Array(10)], 'invoice.pdf');
    expect(await browserPrepareDeps.pdfPages(file)).toBe(4);
    expect(destroy).toHaveBeenCalled();
  });
});
