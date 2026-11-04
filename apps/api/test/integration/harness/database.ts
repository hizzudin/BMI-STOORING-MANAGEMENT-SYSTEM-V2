import pg from 'pg';

const LOCAL_ADMIN_URL = 'postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev';

export const TEMPLATE_DATABASE = 'bmi_template';

export function adminUrl(): string {
  return process.env.TEST_DATABASE_URL ?? LOCAL_ADMIN_URL;
}

export function urlForDatabase(name: string): string {
  const url = new URL(adminUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

export function workerDatabaseName(): string {
  const poolId = process.env.VITEST_POOL_ID;
  if (!poolId) throw new Error('VITEST_POOL_ID is missing: run integration tests through Vitest');
  return `test_w${poolId}`;
}

export async function withConnection<T>(
  url: string,
  work: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

let pool: pg.Pool | undefined;

export function testPool(): pg.Pool {
  pool ??= new pg.Pool({ connectionString: urlForDatabase(workerDatabaseName()) });
  return pool;
}

export async function closeTestPool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
