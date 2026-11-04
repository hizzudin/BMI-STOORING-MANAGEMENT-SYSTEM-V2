import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Client } from 'pg';

const MIGRATION_LOCK_ID = 7_250_001;

// A separate schema: this ledger is tooling, not part of the §9 data model in `public`.
const CREATE_LEDGER = `
  CREATE SCHEMA IF NOT EXISTS meta;
  CREATE TABLE IF NOT EXISTS meta.schema_migrations (
    name TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT now()
  )`;

interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

async function readMigrations(dir: string): Promise<Migration[]> {
  const names = await readdir(dir).catch(() => []);
  const sqlFiles = names.filter((name) => name.endsWith('.sql')).sort();
  return Promise.all(
    sqlFiles.map(async (name) => {
      const sql = await readFile(join(dir, name), 'utf8');
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
    }),
  );
}

async function applyOne(client: Client, { name, sql, checksum }: Migration): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO meta.schema_migrations (name, checksum) VALUES ($1, $2)', [
      name,
      checksum,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`Migration ${name} failed: ${(error as Error).message}`, { cause: error });
  }
}

/** Applies the new files of `dir` in name order (TX-01), each in one transaction. Returns their names. */
export async function runMigrations(client: Client, dir: string): Promise<string[]> {
  await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
  try {
    await client.query(CREATE_LEDGER);
    const { rows } = await client.query<{ name: string; checksum: string }>(
      'SELECT name, checksum FROM meta.schema_migrations',
    );
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    const migrations = await readMigrations(dir);
    for (const { name, checksum } of migrations) {
      const recorded = applied.get(name);
      if (recorded !== undefined && recorded !== checksum) {
        throw new Error(`${name} was edited after it was applied: add a new migration instead`);
      }
    }
    const pending = migrations.filter(({ name }) => !applied.has(name));
    for (const migration of pending) await applyOne(client, migration);
    return pending.map(({ name }) => name);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
  }
}
