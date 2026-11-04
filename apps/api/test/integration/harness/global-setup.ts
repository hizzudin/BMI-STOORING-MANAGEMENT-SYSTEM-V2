import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { adminUrl, TEMPLATE_DATABASE, urlForDatabase, withConnection } from './database.js';

const MIGRATIONS_DIR = join(import.meta.dirname, '../../../migrations');

async function migrationFiles(): Promise<string[]> {
  const names = await readdir(MIGRATIONS_DIR).catch(() => []);
  return names.filter((name) => name.endsWith('.sql')).sort();
}

// D-02: the migrations run once, into the template every worker database is copied from.
export default async function setup(): Promise<void> {
  await withConnection(adminUrl(), async (admin) => {
    const { rows } = await admin.query<{ datname: string }>(
      `SELECT datname FROM pg_database WHERE datname = $1 OR datname ~ '^test_w[0-9]+$'`,
      [TEMPLATE_DATABASE],
    );
    for (const { datname } of rows) await admin.query(`DROP DATABASE "${datname}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  });

  await withConnection(urlForDatabase(TEMPLATE_DATABASE), async (template) => {
    for (const name of await migrationFiles()) {
      await template.query(await readFile(join(MIGRATIONS_DIR, name), 'utf8'));
    }
    // Lives only in test databases, never in a migration: §9 stays exact.
    await template.query(
      'CREATE TABLE harness_probe (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, marker TEXT NOT NULL)',
    );
  });
}
