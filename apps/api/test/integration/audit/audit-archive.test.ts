import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, PG_POOL, PLANNER_APPROVAL_END, STORAGE } from '../../../src/app.tokens.js';
import { AuditArchiveJob } from '../../../src/core/audit/audit-archive.js';
import { FsStorageAdapter } from '../../../src/infra/storage/fs-storage.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

/** The filesystem adapter; `failRead` makes the read-back fail, as a crash after the write would. */
class CrashingStorage extends FsStorageAdapter {
  failRead = false;
  override read(key: string): Promise<Uint8Array> {
    if (this.failRead) return Promise.reject(new Error('crashed before the read-back'));
    return super.read(key);
  }
}

const clock = FakeClock.atWib('2026-11-01 00:30');
const storage = new CrashingStorage({
  root: mkdtempSync(join(tmpdir(), 'bmi-audit-archive-')),
  secret: 'audit-archive-test-secret-0123456789',
  clock,
  baseUrl: () => 'http://localhost',
});
let app: INestApplication;

const fileOf = (month: string) => {
  const [year, mm] = month.split('-');
  return `local/${year}/${mm}/audit-archive/audit-${month}.csv`;
};

/** An audit row at a UTC time, as the audit writer would have written it then. */
async function auditRow(at: string, before: unknown, after: unknown): Promise<number> {
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO audit_logs (entity, entity_id, action, before, after, reason, at)
     VALUES ('vendor', 7, 'update', $1::jsonb, $2::jsonb, 'a reason, with a comma', $3) RETURNING id`,
    [JSON.stringify(before), JSON.stringify(after), at],
  );
  return Number(rows[0]?.id);
}

const idsBetween = async (from: string, to: string) =>
  (
    await testPool().query<{ id: string }>(
      `SELECT id FROM audit_logs WHERE at >= $1 AND at < $2 AND entity = 'vendor' ORDER BY id`,
      [from, to],
    )
  ).rows.map((row) => Number(row.id));

const archiveRecords = async () =>
  (
    await testPool().query<{
      entity_id: string;
      after: { file: string; month: string; records: number; sha256: string };
    }>(`SELECT entity_id, after FROM audit_logs WHERE entity = 'audit_archive' ORDER BY id`)
  ).rows;

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const run = () => app.get(AuditArchiveJob).run();

let september: number[] = [];
let october: number[] = [];
let november: number[] = [];

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
  september = [
    await auditRow('2025-09-10 03:00:00', { name: 'Sumber' }, { name: 'Sumber Filter' }),
    await auditRow('2025-09-20 03:00:00', null, { code: 'SF', isActive: true }),
  ];
  // 18:00 UTC on 30 September is 01:00 WIB on 1 October: it belongs to October (NFR-14).
  october = [await auditRow('2025-09-30 18:00:00', { isActive: true }, { isActive: false })];
  november = [await auditRow('2025-11-05 03:00:00', { name: 'A' }, { name: 'B' })];
}, 120_000);

afterAll(async () => {
  await app.close();
});

describe('audit archive, monthly (NFR-17, DEC-57, DEC-138)', () => {
  it('audit archive: rows older than a year are archived with a checksum and deleted, newer ones stay', async () => {
    const result = await run();
    expect(result.map((month) => month.month)).toEqual(['2025-09', '2025-10']);

    expect(await idsBetween('2025-08-31 17:00:00', '2025-10-31 17:00:00')).toEqual([]);
    expect(await idsBetween('2025-10-31 17:00:00', '2025-11-30 17:00:00')).toEqual(november);

    const csv = new TextDecoder().decode(await storage.read(fileOf('2025-09')));
    expect(csv).toContain('"a reason, with a comma"');
    expect(csv).toContain('Sumber Filter');
    for (const id of september) expect(csv).toContain(`\r\n${id},`);
    const octoberCsv = new TextDecoder().decode(await storage.read(fileOf('2025-10')));
    expect(octoberCsv).toContain(`\r\n${october[0]},2025-09-30T18:00:00.000Z,`);

    const records = await archiveRecords();
    expect(records.map((record) => Number(record.entity_id))).toEqual([202509, 202510]);
    expect(records[0]?.after).toEqual({
      file: fileOf('2025-09'),
      month: '2025-09',
      records: 2,
      sha256: sha256(await storage.read(fileOf('2025-09'))),
    });
  });

  it('audit archive: a rerun of the same month changes nothing', async () => {
    expect(await run()).toEqual([]);
    expect(await archiveRecords()).toHaveLength(2);
    expect(await idsBetween('2025-10-31 17:00:00', '2025-11-30 17:00:00')).toEqual(november);
  });

  it('audit archive: a month file left by a crashed run is kept when it matches, and the month is then deleted', async () => {
    const june = [await auditRow('2025-06-15 03:00:00', null, { name: 'June' })];
    storage.failRead = true;
    const crashed = await run();
    storage.failRead = false;
    expect(crashed).toEqual([
      expect.objectContaining({ month: '2025-06', error: expect.any(String) }),
    ]);
    expect(await idsBetween('2025-05-31 17:00:00', '2025-06-30 17:00:00')).toEqual(june);
    expect(await storage.head(fileOf('2025-06'))).not.toBeNull();

    const again = await run();
    expect(again).toEqual([expect.objectContaining({ month: '2025-06', records: 1 })]);
    expect(await idsBetween('2025-05-31 17:00:00', '2025-06-30 17:00:00')).toEqual([]);
  });

  it('audit archive: a different file already in storage stops that month and its rows stay', async () => {
    const may = [await auditRow('2025-05-15 03:00:00', null, { name: 'May' })];
    await storage.write(fileOf('2025-05'), new TextEncoder().encode('not the archive'), 'text/csv');
    const result = await run();
    expect(result).toEqual([
      expect.objectContaining({ month: '2025-05', error: expect.any(String) }),
    ]);
    expect(await idsBetween('2025-04-30 17:00:00', '2025-05-31 17:00:00')).toEqual(may);
  });

  it('audit archive: the trigger still refuses an UPDATE, a DELETE outside the job, and a job DELETE of a recent row (BR-10)', async () => {
    const recent = await auditRow(new Date().toISOString(), null, { name: 'now' });
    await expect(
      testPool().query(`UPDATE audit_logs SET reason = 'changed' WHERE id = $1`, [november[0]]),
    ).rejects.toThrow(/append-only/);
    await expect(
      testPool().query('DELETE FROM audit_logs WHERE id = $1', [november[0]]),
    ).rejects.toThrow(/append-only/);
    const client = await testPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL bmi.audit_archive = 'on'`);
      await expect(client.query('DELETE FROM audit_logs WHERE id = $1', [recent])).rejects.toThrow(
        /append-only/,
      );
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect(await idsBetween('2025-10-31 17:00:00', '2025-11-30 17:00:00')).toEqual(november);
  });
});
