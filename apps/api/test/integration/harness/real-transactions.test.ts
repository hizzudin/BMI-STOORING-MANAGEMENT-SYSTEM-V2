import { beforeEach, describe, expect, it } from 'vitest';
import { testPool } from './database.js';
import { defineFactory } from './factories.js';

const probe = defineFactory((sequence) => ({ marker: `probe-${sequence}` }));

async function countProbes(marker: string): Promise<number> {
  const { rows } = await testPool().query<{ total: string }>(
    'SELECT count(*) AS total FROM harness_probe WHERE marker = $1',
    [marker],
  );
  return Number(rows[0]?.total);
}

describe('NFR-01 the harness exercises real transactions', () => {
  beforeEach(async () => {
    await testPool().query('DELETE FROM harness_probe');
  });

  it('NFR-01 a committed write is visible to another connection', async () => {
    const { marker } = probe.build();
    const client = await testPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO harness_probe (marker) VALUES ($1)', [marker]);
      expect(await countProbes(marker)).toBe(0);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(await countProbes(marker)).toBe(1);
  });

  it('NFR-01 a rolled back write leaves no row', async () => {
    const { marker } = probe.build();
    const client = await testPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO harness_probe (marker) VALUES ($1)', [marker]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    expect(await countProbes(marker)).toBe(0);
  });

  it('NFR-14 the database session runs in UTC', async () => {
    const { rows } = await testPool().query<{ TimeZone: string }>('SHOW timezone');
    expect(rows[0]?.TimeZone).toBe('UTC');
  });
});

describe('factories', () => {
  it('gives every build its own sequence and takes overrides', () => {
    const first = probe.build();
    const second = probe.build({ marker: 'chosen' });
    expect(first.marker).toMatch(/^probe-\d+$/);
    expect(second.marker).toBe('chosen');
    expect(probe.build().marker).not.toBe(first.marker);
  });
});
