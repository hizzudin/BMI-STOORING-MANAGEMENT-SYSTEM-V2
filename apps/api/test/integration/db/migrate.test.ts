import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../src/infra/db/migrate.js';
import {
  adminUrl,
  urlForDatabase,
  withConnection,
  workerDatabaseName,
} from '../harness/database.js';

describe('TX-01 SQL migration runner', () => {
  let dir: string;
  let databaseName: string;

  const withDatabase = <T>(work: (client: pg.Client) => Promise<T>): Promise<T> =>
    withConnection(urlForDatabase(databaseName), work);

  const tableNames = (): Promise<string[]> =>
    withDatabase(async (client) => {
      const { rows } = await client.query<{ tablename: string }>(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`,
      );
      return rows.map((row) => row.tablename);
    });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'bmi-migrations-'));
    databaseName = `${workerDatabaseName()}_migrate`;
    await withConnection(adminUrl(), async (admin) => {
      await admin.query(`DROP DATABASE IF EXISTS ${databaseName} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${databaseName}`);
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
    await withConnection(adminUrl(), (admin) =>
      admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`),
    );
  });

  it('TX-01 applies the files in numbered order', async () => {
    await writeFile(
      join(dir, '0002_second.sql'),
      'CREATE TABLE second (a_id INT REFERENCES first)',
    );
    await writeFile(join(dir, '0001_first.sql'), 'CREATE TABLE first (id INT PRIMARY KEY)');
    const applied = await withDatabase((client) => runMigrations(client, dir));
    expect(applied).toEqual(['0001_first.sql', '0002_second.sql']);
    expect(await tableNames()).toEqual(['first', 'second']);
  });

  it('TX-01 applies a file only once', async () => {
    await writeFile(join(dir, '0001_first.sql'), 'CREATE TABLE first (id INT PRIMARY KEY)');
    await withDatabase((client) => runMigrations(client, dir));
    expect(await withDatabase((client) => runMigrations(client, dir))).toEqual([]);
  });

  it('TX-01 rolls a failing file back whole and stops there', async () => {
    await writeFile(
      join(dir, '0001_bad.sql'),
      'CREATE TABLE half (id INT); SELECT no_such_column;',
    );
    await writeFile(join(dir, '0002_next.sql'), 'CREATE TABLE next (id INT)');
    await expect(withDatabase((client) => runMigrations(client, dir))).rejects.toThrow(
      '0001_bad.sql',
    );
    expect(await tableNames()).toEqual([]);
  });

  it('TX-01 refuses an applied file that was edited afterwards', async () => {
    const file = join(dir, '0001_first.sql');
    await writeFile(file, 'CREATE TABLE first (id INT PRIMARY KEY)');
    await withDatabase((client) => runMigrations(client, dir));
    await writeFile(file, 'CREATE TABLE first (id BIGINT PRIMARY KEY)');
    await expect(withDatabase((client) => runMigrations(client, dir))).rejects.toThrow(
      '0001_first.sql was edited after it was applied',
    );
  });
});
