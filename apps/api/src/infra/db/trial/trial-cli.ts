import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';
import { runMigrations } from '../migrate.js';
import { seedTrial, TrialAlreadySeededError, type TrialAccount } from './trial-seed.js';
import { TRIAL_DATABASE, trialDatabaseUrl } from './trial-target.js';

/**
 * DEC-130: prepares the local trial database. Without --reset it creates bmi_trial when missing,
 * migrates it and seeds it once; with --reset it drops and recreates it first. Passwords go to
 * .data/trial-accounts.md (gitignored), never to the console.
 */
const reset = process.argv.includes('--reset');
const url = trialDatabaseUrl(process.env);
const repoRoot = resolve(import.meta.dirname, '../../../../../..');
const accountsFile = join(repoRoot, '.data', 'trial-accounts.md');

const adminUrl = new URL(url);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  if (reset) await admin.query(`DROP DATABASE IF EXISTS ${TRIAL_DATABASE} WITH (FORCE)`);
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    TRIAL_DATABASE,
  ]);
  if (rows.length === 0) await admin.query(`CREATE DATABASE ${TRIAL_DATABASE}`);
} finally {
  await admin.end();
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await runMigrations(client, join(import.meta.dirname, '../../../../migrations'));
  let accounts: TrialAccount[];
  try {
    accounts = await seedTrial(client, {
      now: new Date(),
      password: () => `Trial${randomBytes(6).toString('base64url')}7`,
    });
  } catch (error) {
    if (!(error instanceof TrialAlreadySeededError)) throw error;
    console.log(`The local trial keeps its data. Accounts: ${accountsFile}`);
    accounts = [];
  }
  if (accounts.length > 0) {
    mkdirSync(join(repoRoot, '.data'), { recursive: true });
    const lines = [
      '# Local trial accounts (bmi_trial, DEC-130)',
      '',
      'Made by `pnpm trial` or `pnpm trial:reset`; never commit this file.',
      '',
      '| Role | Name | Email | Password |',
      '| --- | --- | --- | --- |',
      ...accounts.map(
        (a) => `| ${a.role.replaceAll('_', ' ')} | ${a.name} | ${a.email} | ${a.password} |`,
      ),
    ];
    writeFileSync(accountsFile, `${lines.join('\n')}\n`);
    console.log(`The local trial is ready with ${accounts.length} accounts:`);
    for (const a of accounts) console.log(`  ${a.role.replaceAll('_', ' ').padEnd(18)} ${a.email}`);
    console.log(`Passwords: ${accountsFile}`);
  }
} finally {
  await client.end();
}
