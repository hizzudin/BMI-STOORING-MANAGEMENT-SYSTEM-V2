import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { bigint, integer, pgTable, text } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { updateWithVersion } from '../../../src/infra/db/optimistic-lock.js';
import { ConcurrentUpdateError } from '../../../src/ports/errors.js';
import { testPool } from '../harness/database.js';

const lockProbe = pgTable('lock_probe', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  note: text('note').notNull(),
  version: integer('version').notNull(),
});

describe('NFR-03 optimistic lock', () => {
  beforeAll(async () => {
    await testPool().query(
      'CREATE TABLE lock_probe (id BIGINT PRIMARY KEY, note TEXT NOT NULL, version INT NOT NULL DEFAULT 1)',
    );
  });

  afterAll(async () => {
    await testPool().query('DROP TABLE lock_probe');
  });

  beforeEach(async () => {
    await testPool().query('DELETE FROM lock_probe');
    await testPool().query(`INSERT INTO lock_probe (id, note) VALUES (1, 'first')`);
  });

  it('NFR-03 optimistic update with the current version saves and moves the version on', async () => {
    const db = drizzle(testPool());
    await updateWithVersion(db, lockProbe, 1, 1, { note: 'second' });
    const [row] = await db.select().from(lockProbe).where(eq(lockProbe.id, 1));
    expect(row).toEqual({ id: 1, note: 'second', version: 2 });
  });

  it('NFR-03 optimistic update of two users: the second save is refused and changes nothing', async () => {
    const db = drizzle(testPool());
    await updateWithVersion(db, lockProbe, 1, 1, { note: 'from user A' });
    await expect(updateWithVersion(db, lockProbe, 1, 1, { note: 'from user B' })).rejects.toThrow(
      ConcurrentUpdateError,
    );
    const [row] = await db.select().from(lockProbe).where(eq(lockProbe.id, 1));
    expect(row).toEqual({ id: 1, note: 'from user A', version: 2 });
  });
});

@Controller('probe')
class ConflictProbeController {
  @Get('conflict')
  conflict(): never {
    throw new ConcurrentUpdateError();
  }
}

describe('NFR-03 optimistic conflict over HTTP', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ConflictProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  it('NFR-03 optimistic conflict answers 409 with a clear message', async () => {
    const response = await fetch(`${baseUrl}/probe/conflict`);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      statusCode: 409,
      message: 'Someone else saved this record first. Reload it and try again.',
    });
  });
});
