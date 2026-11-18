// @vitest-environment node
import { FILE_MESSAGES, UPLOAD_PROFILES } from '@bmi/shared';
import { describe, expect, it, vi } from 'vitest';
import { prepareFile, type PrepareDeps } from './prepare';

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const file = (bytes: number[], name: string, size = 0) =>
  new File([new Uint8Array([...bytes, ...new Array(size).fill(0)])], name);
const jpeg = (size = 64) => file([0xff, 0xd8, 0xff, 0xe0], 'IMG_0001.jpg', size);
const mp4 = () =>
  file([0, 0, 0, 24, ...ascii('ftypisom'), 0, 0, 2, 0, ...ascii('isomiso2')], 'clip.jpg', 64);
const heic = () =>
  file([0, 0, 0, 24, ...ascii('ftypheic'), 0, 0, 0, 0, ...ascii('mif1heic')], 'IMG.heic', 64);
const png = () => file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'scan.png', 64);
const pdf = () => file(ascii('%PDF-1.7\n'), 'invoice.pdf', 64);

function deps(overrides: Partial<PrepareDeps> = {}): PrepareDeps {
  return {
    compress: vi.fn(
      async (_file: File, options: { quality: number }) =>
        new Blob([new Uint8Array(options.quality)]),
    ),
    pdfPages: vi.fn(async () => 3),
    capturedAt: vi.fn(async () => new Date('2026-11-17T06:15:00.000Z')),
    ...overrides,
  };
}

describe('the check and compression on the device (8.1 steps 2 and 3, REQ-FUP-002, DEC-139)', () => {
  it('AC-FUP-002 an MP4 renamed to .jpg is refused with one sentence and never compressed', async () => {
    const given = deps();
    expect(await prepareFile(mp4(), 'Photo', given)).toEqual({
      ok: false,
      reason: FILE_MESSAGES.type,
    });
    expect(given.compress).not.toHaveBeenCalled();
  });

  it('REQ-FUP-002 a PDF above 20 pages is refused on the device', async () => {
    expect(await prepareFile(pdf(), 'PDF', deps({ pdfPages: vi.fn(async () => 21) }))).toEqual({
      ok: false,
      reason: FILE_MESSAGES.pdfTooManyPages,
    });
  });

  it('REQ-FUP-002 a PDF is sent unchanged', async () => {
    const input = pdf();
    expect(await prepareFile(input, 'PDF', deps())).toEqual({
      ok: true,
      blob: input,
      contentType: 'application/pdf',
      capturedAt: null,
    });
  });

  it('DEC-139 HEIC and PNG are sent unchanged; the server converts them', async () => {
    const given = deps();
    const photo = heic();
    expect(await prepareFile(photo, 'Photo', given)).toEqual({
      ok: true,
      blob: photo,
      contentType: 'image/heic',
      capturedAt: '2026-11-17T06:15:00.000Z',
    });
    const scan = png();
    expect(await prepareFile(scan, 'Document', given)).toMatchObject({
      ok: true,
      blob: scan,
      contentType: 'image/png',
    });
    expect(given.compress).not.toHaveBeenCalled();
  });

  it('REQ-FUP-003 a JPEG is compressed with the profile, lowering the quality while it is above the target', async () => {
    const big = UPLOAD_PROFILES.Photo.targetBytes + 1;
    const compress = vi.fn(
      async (_file: File, options: { quality: number }) =>
        new Blob([new Uint8Array(options.quality === 60 ? 300_000 : big)]),
    );
    const result = await prepareFile(jpeg(), 'Photo', deps({ compress }));
    expect(compress.mock.calls.map(([, options]) => options)).toEqual([
      { longSide: 1600, quality: 80 },
      { longSide: 1600, quality: 70 },
      { longSide: 1600, quality: 60 },
    ]);
    expect(result).toMatchObject({
      ok: true,
      contentType: 'image/jpeg',
      capturedAt: '2026-11-17T06:15:00.000Z',
    });
    if (result.ok) expect(result.blob.size).toBe(300_000);
  });

  it('REQ-FUP-003 the Document profile uses 2400 px and stops at the first quality under its target', async () => {
    const compress = vi.fn(
      async (_file: File, _options: { longSide: number; quality: number }) =>
        new Blob([new Uint8Array(10)]),
    );
    await prepareFile(jpeg(), 'Document', deps({ compress }));
    expect(compress.mock.calls.map(([, options]) => options)).toEqual([
      { longSide: 2400, quality: 85 },
    ]);
  });

  it('AC-FUP-008 a 14 MB camera photo is accepted without a message', async () => {
    expect(await prepareFile(jpeg(14 * 1024 * 1024), 'Photo', deps())).toMatchObject({ ok: true });
  });

  it('a capture time that cannot be read is left out', async () => {
    const result = await prepareFile(
      heic(),
      'Photo',
      deps({
        capturedAt: vi.fn(async () => {
          throw new Error('no EXIF');
        }),
      }),
    );
    expect(result).toMatchObject({ ok: true, capturedAt: null });
  });
});
