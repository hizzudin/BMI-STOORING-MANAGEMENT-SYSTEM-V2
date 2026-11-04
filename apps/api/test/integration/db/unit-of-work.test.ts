import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { DrizzleUnitOfWork, type DbTransaction } from '../../../src/infra/db/unit-of-work.js';
import { testPool } from '../harness/database.js';

class ProbeGateway {
  constructor(private readonly tx: DbTransaction) {}

  async add(marker: string): Promise<void> {
    await this.tx.execute(sql`INSERT INTO harness_probe (marker) VALUES (${marker})`);
  }
}

interface ProbeGateways {
  first: ProbeGateway;
  second: ProbeGateway;
}

function unitOfWork(): DrizzleUnitOfWork<ProbeGateways> {
  return new DrizzleUnitOfWork(testPool(), (tx) => ({
    first: new ProbeGateway(tx),
    second: new ProbeGateway(tx),
  }));
}

async function markers(): Promise<string[]> {
  const { rows } = await testPool().query<{ marker: string }>(
    'SELECT marker FROM harness_probe ORDER BY id',
  );
  return rows.map((row) => row.marker);
}

describe('NFR-01 UnitOfWork', () => {
  beforeEach(async () => {
    await testPool().query('DELETE FROM harness_probe');
  });

  it('NFR-01 UnitOfWork commits the writes of every gateway together', async () => {
    await unitOfWork().run(async ({ first, second }) => {
      await first.add('a');
      await second.add('b');
    });
    expect(await markers()).toEqual(['a', 'b']);
  });

  it('NFR-01 UnitOfWork rolls back every gateway when the work throws', async () => {
    const failing = unitOfWork().run(async ({ first, second }) => {
      await first.add('a');
      await second.add('b');
      throw new Error('stock check failed');
    });
    await expect(failing).rejects.toThrow('stock check failed');
    expect(await markers()).toEqual([]);
  });

  it('NFR-01 UnitOfWork hides uncommitted writes from other connections', async () => {
    await unitOfWork().run(async ({ first }) => {
      await first.add('a');
      expect(await markers()).toEqual([]);
    });
    expect(await markers()).toEqual(['a']);
  });

  it('NFR-01 UnitOfWork returns the value of the work', async () => {
    await expect(unitOfWork().run(() => Promise.resolve(42))).resolves.toBe(42);
  });
});
