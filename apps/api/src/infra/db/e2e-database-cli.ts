import { join } from 'node:path';
import pg from 'pg';
import { ScryptPasswordHasher } from '../crypto/scrypt-password-hasher.js';
import { runMigrations } from './migrate.js';

/**
 * E2E only: a fresh `bmi_e2e` database with the accounts the browser tests sign in with. The web app's
 * Playwright setup runs it as a command, so the web never imports a database driver (DEC-66). Never
 * used for the local trial or for staging (ADR-0003).
 */
interface Account {
  name: string;
  email: string;
  password: string;
  role: string;
  mustChangePassword: boolean;
}

const E2E_DATABASE = 'bmi_e2e';
const adminUrl = process.env.TEST_DATABASE_URL;
if (!adminUrl) throw new Error('TEST_DATABASE_URL is required');
const accounts = JSON.parse(process.env.E2E_ACCOUNTS ?? '[]') as Account[];

const admin = new pg.Client({ connectionString: adminUrl });
await admin.connect();
try {
  await admin.query(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${E2E_DATABASE}`);
} finally {
  await admin.end();
}

const url = new URL(adminUrl);
url.pathname = `/${E2E_DATABASE}`;
const client = new pg.Client({ connectionString: url.toString() });
await client.connect();
try {
  await runMigrations(client, join(import.meta.dirname, '../../../migrations'));
  // The browser tests run a live system; a fresh database would start in Setup mode (REQ-IAM-010).
  await client.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', '"Live"'::jsonb)`,
  );
  const hasher = new ScryptPasswordHasher();
  for (const account of accounts) {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (name, email, password_hash, must_change_password) VALUES ($1, $2, $3, $4) RETURNING id`,
      [
        account.name,
        account.email,
        await hasher.hash(account.password),
        account.mustChangePassword,
      ],
    );
    await client.query(`INSERT INTO user_roles (user_id, role) VALUES ($1, $2)`, [
      rows[0]?.id,
      account.role,
    ]);
  }
  console.log(`E2E database ready with ${accounts.length} accounts`);
} finally {
  await client.end();
}
