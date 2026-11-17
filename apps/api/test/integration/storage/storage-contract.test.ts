import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, PG_POOL, PLANNER_APPROVAL_END, STORAGE } from '../../../src/app.tokens.js';
import { FsStorageAdapter } from '../../../src/infra/storage/fs-storage.js';
import { S3StorageAdapter } from '../../../src/infra/storage/s3-storage.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import type { StoragePort } from '../../../src/ports/storage.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-17 08:00');
let base = '';
const fs = new FsStorageAdapter({
  root: mkdtempSync(join(tmpdir(), 'bmi-storage-')),
  secret: 'storage-contract-test-secret-0123456789',
  clock,
  baseUrl: () => base,
});
let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .overrideProvider(STORAGE)
    .useValue(fs)
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  base = await app.getUrl();
});

afterAll(async () => {
  await app.close();
});

/** The S3 run needs the R2_* settings: MinIO in CI, real R2 in TASK-128 (DEC-135). */
const s3Settings = process.env.R2_ENDPOINT
  ? {
      endpoint: process.env.R2_ENDPOINT,
      bucket: process.env.R2_BUCKET ?? 'bmi-test',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    }
  : null;

const adapters: [string, () => StoragePort, () => Promise<void>][] = [
  ['fs', () => fs, async () => {}],
];
if (s3Settings) {
  const s3 = new S3StorageAdapter(s3Settings);
  adapters.push(['s3', () => s3, () => s3.ensureBucket()]);
}

const key = (ext: 'jpg' | 'pdf' = 'jpg') => `test/2026/11/contract/${randomUUID()}.${ext}`;
const bytes = (text: string) => new TextEncoder().encode(text);

async function upload(storage: StoragePort, at: string, body: Uint8Array, type = 'image/jpeg') {
  const link = await storage.signUpload(at, { contentType: type, bytes: body.byteLength });
  return fetch(link.url, { method: link.method, headers: link.headers, body });
}

describe.each(adapters)(
  'storage contract: %s adapter (NFR-13, DEC-135)',
  (name, storage, setup) => {
    beforeAll(async () => {
      await setup();
    });

    it(`storage contract ${name}: a signed upload takes the bytes and a signed download gives them back`, async () => {
      const at = key();
      const response = await upload(storage(), at, bytes('photo-1'));
      expect(response.ok).toBe(true);
      expect(await storage().head(at)).toEqual({ bytes: 7, contentType: 'image/jpeg' });
      const link = await storage().signDownload(at);
      const download = await fetch(link.url);
      expect(download.status).toBe(200);
      expect(new TextDecoder().decode(await download.arrayBuffer())).toBe('photo-1');
    });

    it(`storage contract ${name}: links expire after 15 minutes`, async () => {
      const at = key();
      const link = await storage().signDownload(at);
      expect(link.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(900_000 + 60_000);
      if (name === 's3') {
        expect(new URL(link.url).searchParams.get('X-Amz-Expires')).toBe('900');
        return;
      }
      await storage().write(at, bytes('x'), 'image/jpeg');
      const fresh = await storage().signDownload(at);
      clock.advanceMinutes(16);
      try {
        const expired = await fetch(fresh.url);
        expect(expired.status).toBe(403);
        expect(((await expired.json()) as { message: string }).message).toBe(
          'This link has expired or is not valid.',
        );
      } finally {
        clock.advanceMinutes(-16);
      }
    });

    it(`storage contract ${name}: an existing key is never overwritten (REQ-FUP-008)`, async () => {
      const at = key('pdf');
      await storage().write(at, bytes('first'), 'application/pdf');
      await expect(storage().write(at, bytes('second'), 'application/pdf')).rejects.toThrow(
        'A stored file is never overwritten.',
      );
      const again = await upload(storage(), at, bytes('third'), 'application/pdf');
      expect(again.ok).toBe(false);
      expect(new TextDecoder().decode(await storage().read(at))).toBe('first');
    });

    it(`storage contract ${name}: an upload of another type or size than signed is refused`, async () => {
      const at = key();
      const link = await storage().signUpload(at, { contentType: 'image/jpeg', bytes: 5 });
      const wrongType = await fetch(link.url, {
        method: 'PUT',
        headers: { ...link.headers, 'content-type': 'application/pdf' },
        body: bytes('12345'),
      });
      expect(wrongType.ok).toBe(false);
      const wrongSize = await fetch(link.url, {
        method: 'PUT',
        headers: link.headers,
        body: bytes('123456'),
      });
      expect(wrongSize.ok).toBe(false);
      expect(await storage().head(at)).toBeNull();
    });

    it(`storage contract ${name}: read, write and the total of what is stored`, async () => {
      const before = await storage().totalBytes();
      const at = key();
      await storage().write(at, bytes('0123456789'), 'image/jpeg');
      expect(new TextDecoder().decode(await storage().read(at))).toBe('0123456789');
      expect(await storage().totalBytes()).toBe(before + 10);
      expect(await storage().head(key())).toBeNull();
    });
  },
);

describe.skipIf(s3Settings !== null)(
  'storage contract: s3 adapter skipped here, no R2_* settings (runs on MinIO in CI, on R2 in TASK-128)',
  () => {
    it.skip('storage contract s3: needs R2_ENDPOINT', () => {});
  },
);
