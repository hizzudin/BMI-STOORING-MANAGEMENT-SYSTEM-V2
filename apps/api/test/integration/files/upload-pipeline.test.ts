import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  FILE_MESSAGES,
  type Role,
  type StoredFileResponse,
  type UploadLinkResponse,
} from '@bmi/shared';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  FILE_JOBS,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
  STORAGE,
} from '../../../src/app.tokens.js';
import { FileCleanup, FileProcessor } from '../../../src/core/files/file-jobs.js';
import { incomingKey } from '../../../src/core/files/file-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { FsStorageAdapter } from '../../../src/infra/storage/fs-storage.js';
import type { FileJobs } from '../../../src/ports/files.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

const require = createRequire(import.meta.url);
const exifReader = require('exif-reader') as (exif: Buffer) => {
  Photo?: Record<string, unknown>;
  GPSInfo?: Record<string, unknown>;
};

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

/** Records the enqueued files; the test runs the worker job itself (no Redis needed). */
class RecordedJobs implements FileJobs {
  readonly ids: number[] = [];
  enqueueProcessing(fileId: number): Promise<void> {
    this.ids.push(fileId);
    return Promise.resolve();
  }
}

const MB = 1024 * 1024;
const clock = FakeClock.atWib('2026-11-17 08:00');
const jobs = new RecordedJobs();
let base = '';
const storage = new FsStorageAdapter({
  root: mkdtempSync(join(tmpdir(), 'bmi-files-')),
  secret: 'upload-pipeline-test-secret-0123456789',
  clock,
  baseUrl: () => base,
});
let app: INestApplication;
const tokens = new Map<string, string>();

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  const response = await postJson(base, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
}

function call(
  who: string,
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey: string = randomUUID(),
): Promise<Response> {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${tokens.get(who)}`,
      'idempotency-key': idempotencyKey,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Fails the test when a value the test needs is missing. */
function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value');
  return value;
}

const json = async <T>(response: Response) => (await response.json()) as T;

interface Picked {
  profile: 'Photo' | 'Document' | 'PDF';
  bytes: Uint8Array;
  contentType: string;
  name: string;
}

/** 8.1 steps 4 and 5: a link, then the PUT straight to storage. */
async function sendToStorage(who: string, file: Picked): Promise<UploadLinkResponse> {
  const response = await call(who, 'POST', '/files/upload-links', {
    profile: file.profile,
    contentType: file.contentType,
    bytes: file.bytes.byteLength,
    originalName: file.name,
    captureSource: 'Camera',
  });
  expect(response.status).toBe(201);
  const link = await json<UploadLinkResponse>(response);
  const put = await fetch(link.upload.url, {
    method: link.upload.method,
    headers: link.upload.headers,
    body: file.bytes,
  });
  expect(put.ok).toBe(true);
  return link;
}

/** Steps 4 to 6: upload, say so, run the worker job, read the file detail. */
async function upload(who: string, file: Picked) {
  const link = await sendToStorage(who, file);
  const id = link.file.id;
  const marked = await call(who, 'POST', `/files/${id}/uploaded`);
  expect(marked.status).toBe(200);
  expect(jobs.ids).toContain(id);
  await app.get(FileProcessor).process(id, false);
  const detail = await json<StoredFileResponse>(await call(who, 'GET', `/files/${id}`));
  const row = must(
    (
      await testPool().query<{
        storage_key: string;
        thumb_key: string | null;
        sha256: string | null;
      }>('SELECT storage_key, thumb_key, sha256 FROM stored_files WHERE id = $1', [id])
    ).rows[0],
  );
  return { id, file: detail.file, row };
}

/** A noisy, slightly blurred picture compresses like a phone photo. */
async function photo(
  width: number,
  height: number,
  options: { sigma: number; blur?: number; quality: number; exif?: boolean },
): Promise<Uint8Array> {
  let image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: '#808080',
      noise: { type: 'gaussian', mean: 128, sigma: options.sigma },
    },
  });
  if (options.blur) image = image.blur(options.blur);
  if (options.exif) {
    image = image.withExif({
      IFD0: { Make: 'TestPhone', Model: 'Camera 1' },
      IFD2: { DateTimeOriginal: '2026:11:17 07:30:00' },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '6/1 10/1 0/1' },
    });
  }
  return new Uint8Array(await image.jpeg({ quality: options.quality }).toBuffer());
}

/** A real PDF of `pages` pages, padded to about `padBytes` with an unused stream. */
function pdf(pages: number, padBytes = 0): Uint8Array {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${pages} >>`,
  ];
  for (let i = 0; i < pages; i++) {
    const content = `BT /F1 24 Tf 72 720 Td (Invoice page ${i + 1}) Tj ET 0 0 1 rg 72 400 200 100 re f`;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${4 + i * 2} 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>`,
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }
  if (padBytes > 0)
    objects.push(`<< /Length ${padBytes} >>\nstream\n${'0'.repeat(padBytes)}\nendstream`);
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

const stored = (key: string) => storage.read(key);
const metadataOf = async (key: string) => sharp(await stored(key)).metadata();

beforeAll(async () => {
  await seedRolePermissions();
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', '"Live"'::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
  );
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(EMAIL)
    .useValue(new FakeEmail())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new ScryptPasswordHasher(2 ** 12))
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .overrideProvider(STORAGE)
    .useValue(storage)
    .overrideProvider(FILE_JOBS)
    .useValue(jobs)
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = await app.getUrl();
  await account('mechanic', 'Mechanic');
  await account('planner', 'Planner');
  await account('accounting', 'Accounting');
}, 120_000);

afterAll(async () => {
  await app.close();
});

describe('upload pipeline, server (8.1, REQ-FUP-001 to REQ-FUP-013)', () => {
  it('AC-FUP-001 a 4,2 MB 4032 × 3024 phone photo is stored as a 1600 × 1200 JPEG below 1 MB, without GPS, with a 320 px thumbnail', async () => {
    const input = await photo(4032, 3024, { sigma: 40, blur: 0.8, quality: 90, exif: true });
    expect(input.byteLength).toBeGreaterThan(3.8 * MB);
    const before = exifReader(must((await sharp(input).metadata()).exif));
    expect(before.GPSInfo).toBeDefined();

    const { file, row } = await upload('mechanic', {
      profile: 'Photo',
      bytes: input,
      contentType: 'image/jpeg',
      name: 'IMG_0001.jpg',
    });
    expect(file.status).toBe('Ready');
    expect(file).toMatchObject({ width: 1600, height: 1200, originalBytes: input.byteLength });
    expect(file.storedBytes).toBeLessThan(MB);
    expect(file.capturedAt).toBe(new Date('2026-11-17T07:30:00.000Z').toISOString());
    expect(file.thumbnailUrl).not.toBeNull();
    expect(file.fileUrl).not.toBeNull();

    const output = await metadataOf(row.storage_key);
    expect(output).toMatchObject({ format: 'jpeg', width: 1600, height: 1200 });
    expect(output.exif).toBeUndefined();
    const thumb = await metadataOf(must(row.thumb_key));
    expect(Math.max(must(thumb.width), must(thumb.height))).toBe(320);
    expect(row.sha256).toBe(
      createHash('sha256')
        .update(await stored(row.storage_key))
        .digest('hex'),
    );
    expect(await storage.head(incomingKey(row.storage_key))).toBeNull();

    const download = await fetch(must(file.fileUrl));
    expect(download.status).toBe(200);
  });

  it('AC-FUP-002 an MP4 renamed to .jpg is refused for the link, and Rejected when sent to storage anyway', async () => {
    const asked = await call('mechanic', 'POST', '/files/upload-links', {
      profile: 'Photo',
      contentType: 'video/mp4',
      bytes: 2 * MB,
      originalName: 'clip.mp4',
      captureSource: 'Gallery',
    });
    expect(asked.status).toBe(400);
    expect((await json<{ message: string }>(asked)).message).toBe(FILE_MESSAGES.type);

    const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
    const mp4 = new Uint8Array([
      0,
      0,
      0,
      24,
      ...ascii('ftypisom'),
      0,
      0,
      2,
      0,
      ...ascii('isomiso2'),
      ...new Array(4096).fill(7),
    ]);
    const { file, row } = await upload('mechanic', {
      profile: 'Photo',
      bytes: mp4,
      contentType: 'image/jpeg',
      name: 'clip.jpg',
    });
    expect(file).toMatchObject({
      status: 'Rejected',
      rejectReason: FILE_MESSAGES.type,
      fileUrl: null,
    });
    expect(await storage.head(row.storage_key)).toBeNull();
    expect(await storage.head(incomingKey(row.storage_key))).toBeNull();
  });

  it('AC-FUP-003 an uncompressed 8 MB JPEG that reaches storage is compressed to the Photo profile before Ready', async () => {
    const input = await photo(4032, 3024, { sigma: 60, quality: 97 });
    expect(input.byteLength).toBeGreaterThan(7 * MB);
    const { file } = await upload('planner', {
      profile: 'Photo',
      bytes: input,
      contentType: 'image/jpeg',
      name: 'scan.jpg',
    });
    expect(file).toMatchObject({ status: 'Ready', width: 1600, height: 1200 });
    expect(file.storedBytes).toBeLessThan(MB);
  });

  it('AC-FUP-005 a 1,8 MB PDF invoice is stored unchanged with a first-page thumbnail', async () => {
    const input = pdf(3, Math.round(1.8 * MB));
    expect(input.byteLength).toBeGreaterThan(1.7 * MB);
    const { file, row } = await upload('mechanic', {
      profile: 'PDF',
      bytes: input,
      contentType: 'application/pdf',
      name: 'invoice.pdf',
    });
    expect(file).toMatchObject({ status: 'Ready', pageCount: 3, storedBytes: input.byteLength });
    expect(Buffer.from(await stored(row.storage_key)).equals(Buffer.from(input))).toBe(true);
    const thumb = await metadataOf(must(row.thumb_key));
    expect(thumb.format).toBe('jpeg');
    expect(Math.max(must(thumb.width), must(thumb.height))).toBe(320);
  });

  it('REQ-FUP-002 a PDF above 20 pages is Rejected by the worker with one sentence', async () => {
    const { file } = await upload('mechanic', {
      profile: 'PDF',
      bytes: pdf(21),
      contentType: 'application/pdf',
      name: 'long.pdf',
    });
    expect(file).toMatchObject({ status: 'Rejected', rejectReason: FILE_MESSAGES.pdfTooManyPages });
  });

  it('AC-FUP-008 a 14 MB camera photo is accepted and stored below 1 MB, with no message', async () => {
    const input = await photo(6000, 4500, { sigma: 60, quality: 95 });
    expect(input.byteLength).toBeGreaterThan(12 * MB);
    const { file } = await upload('mechanic', {
      profile: 'Photo',
      bytes: input,
      contentType: 'image/jpeg',
      name: 'IMG_0002.jpg',
    });
    expect(file).toMatchObject({ status: 'Ready', rejectReason: null, width: 1600, height: 1200 });
    expect(file.storedBytes).toBeLessThan(MB);
  });

  it('REQ-FUP-002 a HEIC photo is converted to JPEG on the server', async () => {
    const input = new Uint8Array(
      readFileSync(new URL('../../fixtures/photo.heic', import.meta.url)),
    );
    const { file, row } = await upload('mechanic', {
      profile: 'Document',
      bytes: input,
      contentType: 'image/heic',
      name: 'receipt.heic',
    });
    expect(file).toMatchObject({ status: 'Ready', width: 640, height: 480 });
    expect((await metadataOf(row.storage_key)).format).toBe('jpeg');
  });

  it('REQ-FUP-004 only holders of files.upload get a link, and a file is seen only by its uploader', async () => {
    const refused = await call('accounting', 'POST', '/files/upload-links', {
      profile: 'Photo',
      contentType: 'image/jpeg',
      bytes: 1000,
      originalName: null,
      captureSource: null,
    });
    expect(refused.status).toBe(403);

    const mine = await sendToStorage('mechanic', {
      profile: 'Photo',
      bytes: await photo(400, 300, { sigma: 20, quality: 80 }),
      contentType: 'image/jpeg',
      name: 'mine.jpg',
    });
    expect((await call('planner', 'GET', `/files/${mine.file.id}`)).status).toBe(404);
    expect((await call('planner', 'POST', `/files/${mine.file.id}/uploaded`)).status).toBe(404);
  });

  it('NFR-01 the same Idempotency-Key gives the same file, not a second one', async () => {
    const body = {
      profile: 'PDF',
      contentType: 'application/pdf',
      bytes: 5000,
      originalName: 'retry.pdf',
      captureSource: 'File',
    };
    const key = randomUUID();
    const first = await json<UploadLinkResponse>(
      await call('mechanic', 'POST', '/files/upload-links', body, key),
    );
    const again = await json<UploadLinkResponse>(
      await call('mechanic', 'POST', '/files/upload-links', body, key),
    );
    expect(again.file.id).toBe(first.file.id);
  });

  // Last: it moves the clock 25 hours, which ends the sessions above.
  it('AC-FUP-006 a photo uploaded for a form that was cancelled is gone from storage after 24 hours', async () => {
    const pending = await sendToStorage('mechanic', {
      profile: 'Photo',
      bytes: await photo(800, 600, { sigma: 30, quality: 80 }),
      contentType: 'image/jpeg',
      name: 'cancelled.jpg',
    });
    const attached = await sendToStorage('mechanic', {
      profile: 'Photo',
      bytes: await photo(800, 600, { sigma: 30, quality: 80 }),
      contentType: 'image/jpeg',
      name: 'attached.jpg',
    });
    await testPool().query('UPDATE stored_files SET attached_at = now() WHERE id = $1', [
      attached.file.id,
    ]);
    const key = async (id: number) =>
      must(
        (
          await testPool().query<{ storage_key: string }>(
            'SELECT storage_key FROM stored_files WHERE id = $1',
            [id],
          )
        ).rows[0],
      ).storage_key;
    const pendingKey = await key(pending.file.id);
    expect(await storage.head(incomingKey(pendingKey))).not.toBeNull();

    clock.advanceMinutes(23 * 60);
    await app.get(FileCleanup).run();
    expect(await storage.head(incomingKey(pendingKey))).not.toBeNull();

    clock.advanceMinutes(2 * 60);
    await app.get(FileCleanup).run();
    const status = async (id: number) =>
      must(
        (
          await testPool().query<{ status: string }>(
            'SELECT status FROM stored_files WHERE id = $1',
            [id],
          )
        ).rows[0],
      ).status;
    expect(await status(pending.file.id)).toBe('Expired');
    expect(await storage.head(incomingKey(pendingKey))).toBeNull();
    expect(await status(attached.file.id)).toBe('Pending');
    expect(await storage.head(incomingKey(await key(attached.file.id)))).not.toBeNull();
    const ready = must(
      (
        await testPool().query<{ n: string }>(
          "SELECT count(*) AS n FROM stored_files WHERE status = 'Ready' AND attached_at IS NULL",
        )
      ).rows[0],
    );
    expect(Number(ready.n)).toBeGreaterThan(0);
    await expect(app.get(FileCleanup).run()).resolves.toBe(0);
  });
});
