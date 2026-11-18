import { UPLOAD_PROFILES, checkUpload, sniffFileType, type UploadProfileName } from '@bmi/shared';

/** The browser parts, injected so the rules can be tested without a browser (DEC-139). */
export interface PrepareDeps {
  /** Resizes to the long side and re-encodes as JPEG at the quality (EXIF rotation applied, EXIF dropped). */
  compress(file: File, options: { longSide: number; quality: number }): Promise<Blob>;
  pdfPages(file: File): Promise<number>;
  /** The EXIF capture time, read before compression drops it. */
  capturedAt(file: File): Promise<Date | null>;
}

export type Prepared =
  | { ok: true; blob: Blob; contentType: string; capturedAt: string | null }
  | { ok: false; reason: string };

const HEAD_BYTES = 32;

async function readCapturedAt(deps: PrepareDeps, file: File): Promise<string | null> {
  try {
    const taken = await deps.capturedAt(file);
    return taken && !Number.isNaN(taken.getTime()) ? taken.toISOString() : null;
  } catch {
    return null;
  }
}

/**
 * 8.1 steps 2 and 3 on the device: the type from the content, the limits of the profile, then
 * compression. A refused file gets one sentence and is never sent (REQ-FUP-002). HEIC and PNG go
 * unchanged: the server converts HEIC and flattens transparency on white (DEC-136, DEC-139).
 */
export async function prepareFile(
  file: File,
  profile: UploadProfileName,
  deps: PrepareDeps,
): Promise<Prepared> {
  const type = sniffFileType(new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer()));
  const check = checkUpload(profile, { type, bytes: file.size });
  if (!check.ok) return check;

  const rules = UPLOAD_PROFILES[profile];
  if (rules.output === 'application/pdf') {
    const pages = await deps.pdfPages(file);
    const pageCheck = checkUpload(profile, { type, bytes: file.size, pages });
    if (!pageCheck.ok) return pageCheck;
    return { ok: true, blob: file, contentType: 'application/pdf', capturedAt: null };
  }

  const capturedAt = await readCapturedAt(deps, file);
  if (type !== 'image/jpeg') return { ok: true, blob: file, contentType: type, capturedAt };

  let blob: Blob = file;
  for (const quality of rules.qualities) {
    blob = await deps.compress(file, { longSide: rules.longSide, quality });
    if (blob.size <= rules.targetBytes) break;
  }
  return { ok: true, blob, contentType: 'image/jpeg', capturedAt };
}
