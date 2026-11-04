import { afterEach, describe, expect, it } from 'vitest';
import { findConventionViolations } from '../../../src/infra/db/conventions.js';
import { testPool } from '../harness/database.js';

const dropProbes = 'DROP TABLE IF EXISTS sd_child_probe, sd_probe';

describe('§9.0 schema conventions', () => {
  afterEach(async () => {
    await testPool().query(dropProbes);
  });

  it('TX-18 BR-10 the migrated schema breaks no convention', async () => {
    expect(await findConventionViolations(testPool())).toEqual([]);
  });

  it('TX-18 reports a unique index on a soft-deleted table that counts deleted rows', async () => {
    await testPool().query(
      'CREATE TABLE sd_probe (id BIGINT PRIMARY KEY, code TEXT NOT NULL UNIQUE, deleted_at TIMESTAMP)',
    );
    expect(await findConventionViolations(testPool())).toEqual([
      'TX-18: unique index sd_probe_code_key on sd_probe counts soft-deleted rows',
    ]);
  });

  it('TX-18 accepts a unique index that ignores deleted rows, so the value can be reused', async () => {
    await testPool().query(
      'CREATE TABLE sd_probe (id BIGINT PRIMARY KEY, code TEXT NOT NULL, deleted_at TIMESTAMP)',
    );
    await testPool().query(
      'CREATE UNIQUE INDEX sd_probe_code ON sd_probe (code) WHERE deleted_at IS NULL',
    );
    await testPool().query(`INSERT INTO sd_probe VALUES (1, 'A', now()), (2, 'A', NULL)`);
    expect(await findConventionViolations(testPool())).toEqual([]);
  });

  it('BR-10 reports a foreign key that is not ON DELETE RESTRICT', async () => {
    await testPool().query('CREATE TABLE sd_probe (id BIGINT PRIMARY KEY)');
    await testPool().query(
      'CREATE TABLE sd_child_probe (id BIGINT PRIMARY KEY, parent_id BIGINT REFERENCES sd_probe ON DELETE CASCADE)',
    );
    expect(await findConventionViolations(testPool())).toEqual([
      'BR-10: foreign key sd_child_probe_parent_id_fkey on sd_child_probe is not ON DELETE RESTRICT',
    ]);
  });
});
