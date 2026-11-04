import { join } from 'node:path';
import pg from 'pg';
import { runMigrations } from './migrate.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const applied = await runMigrations(client, join(import.meta.dirname, '../../../migrations'));
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Nothing to apply');
} finally {
  await client.end();
}
