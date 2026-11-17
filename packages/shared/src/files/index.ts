/**
 * 8.1 upload profiles and file rules, shared by the device (TASK-115, TASK-705) and the server
 * worker (TASK-114). The server never trusts the device and runs the same checks again.
 */

const MB = 1024 * 1024;

export type UploadProfileName = 'Photo' | 'Document' | 'PDF';

/** What a file is by its content (REQ-FUP-002); `unknown` covers video and every other type (DEC-31). */
export type SniffedType = 'image/jpeg' | 'image/png' | 'image/heic' | 'application/pdf' | 'unknown';

interface Thumbnail {
  longSide: number;
  quality: number;
}

export interface ImageProfile {
  accepts: readonly SniffedType[];
  output: 'image/jpeg';
  maxInputBytes: number;
  longSide: number;
  /** Tried in order while the result is above `targetBytes`. */
  qualities: readonly number[];
  targetBytes: number;
  thumbnail: Thumbnail;
}

export interface PdfProfile {
  accepts: readonly SniffedType[];
  output: 'application/pdf';
  maxInputBytes: number;
  maxPages: number;
  thumbnail: Thumbnail;
}

const IMAGES: readonly SniffedType[] = ['image/jpeg', 'image/png', 'image/heic'];
const THUMBNAIL: Thumbnail = { longSide: 320, quality: 70 };

/** REQ-FUP-001: the 8.1 table, one profile per upload slot. */
export const UPLOAD_PROFILES = {
  Photo: {
    accepts: IMAGES,
    output: 'image/jpeg',
    maxInputBytes: 30 * MB,
    longSide: 1600,
    qualities: [80, 70, 60],
    targetBytes: 1 * MB,
    thumbnail: THUMBNAIL,
  },
  Document: {
    accepts: IMAGES,
    output: 'image/jpeg',
    maxInputBytes: 30 * MB,
    longSide: 2400,
    qualities: [85, 75],
    targetBytes: 1.5 * MB,
    thumbnail: THUMBNAIL,
  },
  PDF: {
    accepts: ['application/pdf'],
    output: 'application/pdf',
    maxInputBytes: 10 * MB,
    maxPages: 20,
    thumbnail: THUMBNAIL,
  },
} as const satisfies { Photo: ImageProfile; Document: ImageProfile; PDF: PdfProfile };

/** REQ-FUP-010: per step, checked when files are attached (DEC-136). */
export const STEP_FILE_LIMITS = { photos: 10, documents: 5 } as const;

/** REQ-FUP-002: one plain sentence per refusal. */
export const FILE_MESSAGES = {
  type: 'This file type cannot be used. Use a JPG, PNG or HEIC photo, or a PDF.',
  imageTooLarge: 'This photo is larger than 30 MB.',
  pdfTooLarge: 'This PDF is larger than 10 MB.',
  pdfTooManyPages: 'This PDF has more than 20 pages.',
  unreadable: 'This file could not be read.',
  tooManyPhotos: 'A step holds at most 10 photos.',
  tooManyDocuments: 'A step holds at most 5 documents.',
} as const;

export type FileCheck = { ok: true } | { ok: false; reason: string };

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  bytes.length >= at + signature.length &&
  signature.every((value, index) => bytes[at + index] === value);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const HEIF_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'];

/** REQ-FUP-002: the type comes from the first bytes, never from the name. */
export function sniffFileType(bytes: Uint8Array): SniffedType {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, ascii('%PDF-'))) return 'application/pdf';
  if (startsWith(bytes, ascii('ftyp'), 4)) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (HEIF_BRANDS.includes(brand)) return 'image/heic';
  }
  return 'unknown';
}

/** REQ-FUP-002: whether a slot of this profile takes the file. */
export function checkUpload(
  profile: UploadProfileName,
  file: { type: SniffedType; bytes: number; pages?: number },
): FileCheck {
  const rules = UPLOAD_PROFILES[profile];
  if (!(rules.accepts as readonly SniffedType[]).includes(file.type))
    return { ok: false, reason: FILE_MESSAGES.type };
  if (rules.output === 'application/pdf') {
    if (file.bytes > rules.maxInputBytes) return { ok: false, reason: FILE_MESSAGES.pdfTooLarge };
    if (file.pages !== undefined && file.pages > rules.maxPages) {
      return { ok: false, reason: FILE_MESSAGES.pdfTooManyPages };
    }
    return { ok: true };
  }
  if (file.bytes > rules.maxInputBytes) return { ok: false, reason: FILE_MESSAGES.imageTooLarge };
  return { ok: true };
}

/** REQ-FUP-010: Photo files count as photos; Document images and PDFs count as documents. */
export function checkStepFileLimits(files: readonly { profile: UploadProfileName }[]): FileCheck {
  const photos = files.filter((file) => file.profile === 'Photo').length;
  if (photos > STEP_FILE_LIMITS.photos) return { ok: false, reason: FILE_MESSAGES.tooManyPhotos };
  if (files.length - photos > STEP_FILE_LIMITS.documents) {
    return { ok: false, reason: FILE_MESSAGES.tooManyDocuments };
  }
  return { ok: true };
}
