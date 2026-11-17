import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, PG_POOL, PLANNER_APPROVAL_END, STORAGE } from '../../../src/app.tokens.js';
import { StorageUsageCheck } from '../../../src/core/files/storage-usage.js';
import { FsStorageAdapter } from '../../../src/infra/storage/fs-storage.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { insertAccount } from '../iam/auth-harness.js';

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const GB = 1024 ** 3;
const clock = FakeClock.atWib('2026-11-18 00:30');

/** The filesystem adapter with a total the test sets (the rest of the port is never used here). */
class SizedStorage extends FsStorageAdapter {
  used = 0;
  override totalBytes(): Promise<number> {
    return Promise.resolve(this.used);
  }
}

const storage = new SizedStorage({
  root: mkdtempSync(join(tmpdir(), 'bmi-usage-')),
  secret: 'storage-usage-test-secret-0123456789',
  clock,
  baseUrl: () => 'http://localhost',
});
let app: INestApplication;
let admin: number;
let planner: number;

async function setting(key: string, value: number | null): Promise<void> {
  if (value === null) {
    await testPool().query('DELETE FROM app_settings WHERE setting_key = $1', [key]);
    return;
  }
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, JSON.stringify(value)],
  );
}

async function alerts(userId: number) {
  return (
    await testPool().query<{
      kind: string;
      title: string;
      body: string | null;
      link_record: string | null;
    }>(
      `SELECT kind, title, body, link_record FROM notifications
       WHERE user_id = $1 AND dedupe_key LIKE 'storage-usage:%' ORDER BY id`,
      [userId],
    )
  ).rows;
}

const run = () => app.get(StorageUsageCheck).run();

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .overrideProvider(STORAGE)
    .useValue(storage)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  admin = (await insertAccount({ role: 'System_Admin' })).id;
  planner = (await insertAccount({ role: 'Planner' })).id;
}, 120_000);

beforeEach(async () => {
  await setting('storage_budget_gb', 1);
  await setting('storage_alert_pct', 80);
});

afterAll(async () => {
  await app.close();
});

describe('storage usage, the daily budget alert (NFR-13, DEC-137)', () => {
  it('storage usage: below 80% no alert; at 80% one alert to the System Admin; at 84% none more; at 85% one more; a rerun adds none', async () => {
    storage.used = 0.79 * GB;
    expect(await run()).toMatchObject({ step: null, notified: 0 });
    expect(await alerts(admin)).toEqual([]);

    storage.used = 0.8 * GB;
    await run();
    expect(await alerts(admin)).toEqual([
      {
        kind: 'Alert',
        title: 'File storage is 80% full',
        body: '0.8 GB of the 1 GB budget is used.',
        link_record: null,
      },
    ]);
    expect(await alerts(planner)).toEqual([]);

    storage.used = 0.84 * GB;
    await run();
    expect(await alerts(admin)).toHaveLength(1);

    storage.used = 0.85 * GB;
    expect(await run()).toMatchObject({ step: 85 });
    expect((await alerts(admin)).map((a) => a.title)).toEqual([
      'File storage is 80% full',
      'File storage is 85% full',
    ]);

    await run();
    expect(await alerts(admin)).toHaveLength(2);
  });

  it('storage usage: a jump notifies only the step reached, and a step already passed adds nothing', async () => {
    storage.used = 0.92 * GB;
    await run();
    expect((await alerts(admin)).at(-1)?.title).toBe('File storage is 92% full');
    expect(await alerts(admin)).toHaveLength(3);

    storage.used = 0.86 * GB;
    expect(await run()).toMatchObject({ step: 85, notified: 0 });
    expect(await alerts(admin)).toHaveLength(3);
  });

  it('storage usage: a changed budget starts the steps again, and above 100% the steps go on by 5%', async () => {
    await setting('storage_budget_gb', 2);
    storage.used = 0.92 * GB;
    expect(await run()).toMatchObject({ step: null, notified: 0 });

    storage.used = 2.1 * GB;
    await run();
    const last = (await alerts(admin)).at(-1);
    expect(last).toMatchObject({
      title: 'File storage is 105% full',
      body: '2.1 GB of the 2 GB budget is used.',
    });
  });

  it('storage usage: the defaults of §9.12 apply when the settings are missing (50 GB, 80%)', async () => {
    await setting('storage_budget_gb', null);
    await setting('storage_alert_pct', null);
    storage.used = 41 * GB;
    expect(await run()).toMatchObject({ pct: 82, step: 80 });
    expect((await alerts(admin)).at(-1)).toMatchObject({
      title: 'File storage is 82% full',
      body: '41.0 GB of the 50 GB budget is used.',
    });
  });
});
