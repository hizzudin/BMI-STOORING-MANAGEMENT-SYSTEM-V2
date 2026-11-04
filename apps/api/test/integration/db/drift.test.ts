import { bigint, getTableConfig, pgTable, text, varchar } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findSchemaDrift } from '../../../src/infra/db/drift.js';
import { allTables } from '../../../src/infra/db/schema/index.js';
import { testPool } from '../harness/database.js';

const TEST_ONLY_TABLES = ['harness_probe', 'drift_probe'];
// Tables the probe definitions below do not describe.
const PROBE_IGNORED = ['harness_probe', ...allTables.map((table) => getTableConfig(table).name)];

const driftProbe = pgTable('drift_probe', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  code: varchar('code', { length: 10 }).notNull(),
  note: text('note'),
});

describe('D-12 Drizzle definitions match the migrated database', () => {
  beforeAll(async () => {
    await testPool().query(
      'CREATE TABLE drift_probe (id BIGINT PRIMARY KEY, code VARCHAR(10) NOT NULL, note TEXT)',
    );
  });

  afterAll(async () => {
    await testPool().query('DROP TABLE drift_probe');
  });

  it('D-12 drift: the definitions of the code base match the migrations', async () => {
    expect(await findSchemaDrift(testPool(), allTables, TEST_ONLY_TABLES)).toEqual([]);
  });

  it('D-12 drift: a matching definition reports nothing', async () => {
    expect(await findSchemaDrift(testPool(), [driftProbe], PROBE_IGNORED)).toEqual([]);
  });

  it('D-12 drift: a hand-edited column type is reported', async () => {
    const edited = pgTable('drift_probe', {
      id: bigint('id', { mode: 'number' }).primaryKey(),
      code: varchar('code', { length: 20 }).notNull(),
      note: text('note'),
    });
    expect(await findSchemaDrift(testPool(), [edited], PROBE_IGNORED)).toEqual([
      'drift_probe.code: Drizzle has character varying(20), the database has character varying(10)',
    ]);
  });

  it('D-12 drift: a changed nullability is reported', async () => {
    const edited = pgTable('drift_probe', {
      id: bigint('id', { mode: 'number' }).primaryKey(),
      code: varchar('code', { length: 10 }).notNull(),
      note: text('note').notNull(),
    });
    expect(await findSchemaDrift(testPool(), [edited], PROBE_IGNORED)).toEqual([
      'drift_probe.note: Drizzle says NOT NULL, the database allows NULL',
    ]);
  });

  it('D-12 drift: a column only in Drizzle and a column only in the database are reported', async () => {
    const edited = pgTable('drift_probe', {
      id: bigint('id', { mode: 'number' }).primaryKey(),
      code: varchar('code', { length: 10 }).notNull(),
      extra: text('extra'),
    });
    expect(await findSchemaDrift(testPool(), [edited], PROBE_IGNORED)).toEqual([
      'drift_probe.extra: only in Drizzle',
      'drift_probe.note: only in the database',
    ]);
  });

  it('D-12 drift: a table without a definition and a definition without a table are reported', async () => {
    const ghost = pgTable('ghost_probe', { id: bigint('id', { mode: 'number' }).primaryKey() });
    expect(await findSchemaDrift(testPool(), [ghost], PROBE_IGNORED)).toEqual([
      'ghost_probe: only in Drizzle',
      'drift_probe: only in the database',
    ]);
  });
});
