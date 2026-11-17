import type { ImageProfile } from '@bmi/shared';
import { createCanvas } from '@napi-rs/canvas';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import type { MediaProcessor, ProcessedImage } from '../../ports/files.js';

const require = createRequire(import.meta.url);
const decodeHeic = require('heic-decode') as (input: {
  buffer: Uint8Array;
}) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
// exif-reader is CommonJS with a default-export type, so it is loaded the CommonJS way.
const exifReader = require('exif-reader') as (exif: Buffer) => { Photo?: Record<string, unknown> };
const standardFontDataUrl = `${join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`;

const WHITE = '#ffffff';

/** The capture time, the only EXIF field kept (8.1 step 3); everything else, GPS too, is dropped. */
function capturedAtOf(exif: Buffer | undefined): Date | null {
  if (!exif) return null;
  try {
    const taken = exifReader(exif).Photo?.DateTimeOriginal;
    return taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken : null;
  } catch {
    return null;
  }
}

/** DEC-136: sharp for images (HEIC first decoded by libheif in WebAssembly), pdf.js for PDFs. */
export class SharpPdfjsMediaProcessor implements MediaProcessor {
  async image(
    bytes: Uint8Array,
    type: 'image/jpeg' | 'image/png' | 'image/heic',
    profile: ImageProfile,
  ): Promise<ProcessedImage> {
    let source: sharp.Sharp;
    let capturedAt: Date | null = null;
    if (type === 'image/heic') {
      const decoded = await decodeHeic({ buffer: bytes });
      source = sharp(Buffer.from(decoded.data.buffer), {
        raw: { width: decoded.width, height: decoded.height, channels: 4 },
      });
    } else {
      source = sharp(bytes, { failOn: 'error' });
      capturedAt = capturedAtOf((await source.metadata()).exif);
    }
    // rotate() applies the EXIF orientation; no withMetadata(), so the output carries no EXIF.
    const base = source
      .rotate()
      .resize({
        width: profile.longSide,
        height: profile.longSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: WHITE });
    let output: { data: Buffer; info: sharp.OutputInfo } | undefined;
    for (const quality of profile.qualities) {
      output = await base.clone().jpeg({ quality }).toBuffer({ resolveWithObject: true });
      if (output.data.byteLength <= profile.targetBytes) break;
    }
    if (!output) throw new Error('An image profile has no quality');
    const thumbnail = await sharp(output.data)
      .resize({
        width: profile.thumbnail.longSide,
        height: profile.thumbnail.longSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: profile.thumbnail.quality })
      .toBuffer();
    return {
      bytes: new Uint8Array(output.data),
      width: output.info.width,
      height: output.info.height,
      thumbnail: new Uint8Array(thumbnail),
      capturedAt,
    };
  }

  async pdfPageCount(bytes: Uint8Array): Promise<number> {
    const document = await this.open(bytes);
    try {
      return document.numPages;
    } finally {
      await document.destroy();
    }
  }

  async pdfThumbnail(bytes: Uint8Array, longSide: number, quality: number): Promise<Uint8Array> {
    const document = await this.open(bytes);
    try {
      const page = await document.getPage(1);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: longSide / Math.max(natural.width, natural.height),
      });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      context.fillStyle = WHITE;
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        // @napi-rs/canvas implements the 2D context pdf.js draws on (DEC-136).
        canvasContext: context as never,
        viewport,
      }).promise;
      const png = await canvas.encode('png');
      return new Uint8Array(await sharp(png).jpeg({ quality }).toBuffer());
    } finally {
      await document.destroy();
    }
  }

  private open(bytes: Uint8Array) {
    // pdf.js takes ownership of the buffer it is given, so it gets a copy.
    return getDocument({
      data: new Uint8Array(bytes),
      isEvalSupported: false,
      standardFontDataUrl,
      verbosity: 0,
    }).promise;
  }
}
