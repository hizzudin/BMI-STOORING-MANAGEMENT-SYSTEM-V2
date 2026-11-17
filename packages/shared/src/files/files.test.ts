import { describe, expect, it } from 'vitest';
import {
  FILE_MESSAGES,
  STEP_FILE_LIMITS,
  UPLOAD_PROFILES,
  checkStepFileLimits,
  checkUpload,
  sniffFileType,
} from './index.js';

const MB = 1024 * 1024;
const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const ascii = (text: string) => new TextEncoder().encode(text);
/** An ISO box `ftyp` with the given major brand, as HEIC and MP4 files start. */
const ftyp = (brand: string) =>
  new Uint8Array([
    0,
    0,
    0,
    24,
    ...ascii('ftyp'),
    ...ascii(brand),
    0,
    0,
    0,
    0,
    ...ascii('mif1isom'),
  ]);

describe('upload profiles (8.1, REQ-FUP-001)', () => {
  it('REQ-FUP-001 Photo is 1600 px, 80 then 70 and 60 while above 1 MB, thumbnail 320 px at 70', () => {
    expect(UPLOAD_PROFILES.Photo).toMatchObject({
      output: 'image/jpeg',
      maxInputBytes: 30 * MB,
      longSide: 1600,
      qualities: [80, 70, 60],
      targetBytes: 1 * MB,
    });
    expect(UPLOAD_PROFILES.Photo.thumbnail).toEqual({ longSide: 320, quality: 70 });
  });

  it('REQ-FUP-001 Document is 2400 px, 85 then 75 while above 1,5 MB', () => {
    expect(UPLOAD_PROFILES.Document).toMatchObject({
      output: 'image/jpeg',
      maxInputBytes: 30 * MB,
      longSide: 2400,
      qualities: [85, 75],
      targetBytes: 1.5 * MB,
    });
  });

  it('REQ-FUP-001 PDF is kept unchanged, at most 10 MB and 20 pages', () => {
    expect(UPLOAD_PROFILES.PDF).toMatchObject({
      output: 'application/pdf',
      maxInputBytes: 10 * MB,
      maxPages: 20,
    });
  });
});

describe('type from the content (REQ-FUP-002, DEC-31)', () => {
  it('REQ-FUP-002 knows JPEG, PNG, PDF and HEIC by their first bytes', () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffFileType(ascii('%PDF-1.7\n%....'))).toBe('application/pdf');
    expect(sniffFileType(ftyp('heic'))).toBe('image/heic');
    expect(sniffFileType(ftyp('mif1'))).toBe('image/heic');
  });

  it('AC-FUP-002 an MP4 or anything else is unknown, whatever its name', () => {
    expect(sniffFileType(ftyp('isom'))).toBe('unknown');
    expect(sniffFileType(ftyp('qt  '))).toBe('unknown');
    expect(sniffFileType(ascii('hello, not a file'))).toBe('unknown');
    expect(sniffFileType(new Uint8Array())).toBe('unknown');
  });
});

describe('checkUpload (REQ-FUP-002)', () => {
  it('AC-FUP-008 a 14 MB camera photo is accepted without a message', () => {
    expect(checkUpload('Photo', { type: 'image/jpeg', bytes: 14 * MB })).toEqual({ ok: true });
    expect(checkUpload('Document', { type: 'image/heic', bytes: 14 * MB })).toEqual({ ok: true });
  });

  it('REQ-FUP-002 refuses a video, an image above 30 MB and a PDF above 10 MB or 20 pages with one sentence', () => {
    expect(checkUpload('Photo', { type: 'unknown', bytes: MB })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.type,
    });
    expect(checkUpload('Photo', { type: 'image/jpeg', bytes: 30 * MB + 1 })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.imageTooLarge,
    });
    expect(checkUpload('PDF', { type: 'application/pdf', bytes: 10 * MB + 1 })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.pdfTooLarge,
    });
    expect(checkUpload('PDF', { type: 'application/pdf', bytes: MB, pages: 21 })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.pdfTooManyPages,
    });
  });

  it('REQ-FUP-001 a slot takes only the types of its profile', () => {
    expect(checkUpload('PDF', { type: 'image/jpeg', bytes: MB })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.type,
    });
    expect(checkUpload('Photo', { type: 'application/pdf', bytes: MB })).toEqual({
      ok: false,
      reason: FILE_MESSAGES.type,
    });
  });
});

describe('files per step (REQ-FUP-010)', () => {
  const photo = { profile: 'Photo' as const };
  const pdf = { profile: 'PDF' as const };
  const doc = { profile: 'Document' as const };

  it('REQ-FUP-010 a step holds at most 10 photos and 5 documents', () => {
    expect(STEP_FILE_LIMITS).toEqual({ photos: 10, documents: 5 });
    expect(checkStepFileLimits([...new Array(10).fill(photo), ...new Array(5).fill(pdf)])).toEqual({
      ok: true,
    });
  });

  it('REQ-FUP-010 the 11th photo or the 6th document is refused; documents count images and PDFs', () => {
    expect(checkStepFileLimits(new Array(11).fill(photo))).toEqual({
      ok: false,
      reason: FILE_MESSAGES.tooManyPhotos,
    });
    expect(checkStepFileLimits([...new Array(3).fill(pdf), ...new Array(3).fill(doc)])).toEqual({
      ok: false,
      reason: FILE_MESSAGES.tooManyDocuments,
    });
  });
});
