import { beforeAll, type expect as Expect, type it as It } from 'vitest';
import { testPool } from './database.js';

// Both files run these checks at once in different workers. The wait makes them overlap,
// so a shared database would show the other file's rows or lose its own to the other's truncate.
const OVERLAP_MS = 1_000;

export function assertWorkerDatabaseIsolated(
  it: typeof It,
  expect: typeof Expect,
  marker: string,
): void {
  beforeAll(async () => {
    await testPool().query('INSERT INTO harness_probe (marker) VALUES ($1)', [marker]);
    await new Promise((resolve) => setTimeout(resolve, OVERLAP_MS));
  });

  it('D-02 connects to the database of this worker', async () => {
    const { rows } = await testPool().query<{ name: string }>('SELECT current_database() AS name');
    expect(rows[0]?.name).toBe(`test_w${process.env.VITEST_POOL_ID ?? ''}`);
  });

  it('D-02 sees only the rows of this test file', async () => {
    const { rows } = await testPool().query<{ marker: string }>('SELECT marker FROM harness_probe');
    expect(rows.map((row) => row.marker)).toEqual([marker]);
  });
}
