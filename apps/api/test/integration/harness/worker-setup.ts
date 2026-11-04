import { afterAll, beforeAll } from 'vitest';
import {
  adminUrl,
  closeTestPool,
  TEMPLATE_DATABASE,
  testPool,
  withConnection,
  workerDatabaseName,
} from './database.js';

const DUPLICATE_DATABASE = '42P04';

async function ensureWorkerDatabase(): Promise<void> {
  await withConnection(adminUrl(), async (admin) => {
    try {
      await admin.query(`CREATE DATABASE ${workerDatabaseName()} TEMPLATE ${TEMPLATE_DATABASE}`);
    } catch (error) {
      if ((error as { code?: string }).code !== DUPLICATE_DATABASE) throw error;
    }
  });
}

async function truncateAllTables(): Promise<void> {
  const { rows } = await testPool().query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  if (rows.length === 0) return;
  const tables = rows.map(({ tablename }) => `"${tablename}"`).join(', ');
  await testPool().query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

// D-02: every test file starts empty; no per-test rollback, so commits and locks stay real.
beforeAll(async () => {
  await ensureWorkerDatabase();
  await truncateAllTables();
});

afterAll(async () => {
  await closeTestPool();
});
