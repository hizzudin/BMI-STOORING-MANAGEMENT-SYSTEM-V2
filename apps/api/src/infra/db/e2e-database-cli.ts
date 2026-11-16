import { join } from 'node:path';
import { formatDocumentNumber, NumberingConfigSchema } from '@bmi/shared';
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
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error('TEST_DATABASE_URL is required');
const accounts = JSON.parse(process.env.E2E_ACCOUNTS ?? '[]') as Account[];

// Drop and create through the postgres database, so TEST_DATABASE_URL may name any database.
const adminUrl = new URL(testUrl);
adminUrl.pathname = '/postgres';
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  await admin.query(`DROP DATABASE IF EXISTS ${E2E_DATABASE} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${E2E_DATABASE}`);
} finally {
  await admin.end();
}

const url = new URL(testUrl);
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
  await seedApprovalFixtures(client);
  console.log(`E2E database ready with ${accounts.length} accounts`);
} finally {
  await client.end();
}

/**
 * DEC-126: until the step composer (TASK-207) no screen adds steps, so the approval journeys
 * (FLW-APR-01, FLW-APR-06 of TASK-122) start from SPKs the Planner submitted, with their steps,
 * written here. One vehicle; each SPK waits for creation approval.
 */
async function seedApprovalFixtures(db: pg.Client): Promise<void> {
  const { rows: planner } = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE email = 'planner@e2e.test'`,
  );
  const plannerId = planner[0]?.id;
  if (!plannerId) return;
  await db.query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('E2e_Stock', 'Stock', 'StockStep', '{Warehouse_Manager}', '{}', '{}', 'None'),
            ('E2e_Mechanic', 'Mechanic Action', 'MechanicStep', '{Mechanic}', '{}', '{}', 'None')`,
  );
  const { rows: layout } = await db.query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('E2e_Apr', 'E2E approvals', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await db.query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('E2e_Apr', 'E2E head', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await db.query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 1234 APR', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  // NFR-15, DEC-104: numbered as the API numbers them, SPK-yymmddNNNN from spk_number_seq.
  const { rows: formats } = await db.query<{ value: unknown }>(
    `SELECT setting_value AS value FROM app_settings WHERE setting_key = 'numbering_formats'`,
  );
  const numbering = NumberingConfigSchema.parse(formats[0]?.value);
  const createdAt = new Date(Date.now() - 50 * 60_000);
  // The journeys find each SPK by its title, never by a made-up number.
  const fixtures = [
    { title: 'Approve me', priority: 'Urgent' },
    { title: 'Reject me', priority: 'High' },
    { title: 'Look back at me', priority: 'Normal' },
  ];
  for (const fixture of fixtures) {
    const { rows: next } = await db.query<{ value: string }>(
      `SELECT nextval('spk_number_seq')::text AS value`,
    );
    const spkNumber = formatDocumentNumber(
      'SPK',
      BigInt(next[0]?.value ?? '0'),
      createdAt,
      numbering,
    );
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
         priority, created_by, created_at)
       VALUES ($1, $2, $3, 'Corrective', 'Manual_Planner', 'Brake pedal feels soft.', 'Pending_Approval', $4, $5,
         $6::timestamptz AT TIME ZONE 'UTC')
       RETURNING id`,
      [
        spkNumber,
        vehicle[0]?.id,
        fixture.title,
        fixture.priority,
        plannerId,
        createdAt.toISOString(),
      ],
    );
    const spkId = rows[0]?.id;
    await db.query(
      `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status)
       VALUES ($1, 1, 'E2e_Stock', '{Warehouse_Manager}', 'Planner', 'Locked'),
              ($1, 2, 'E2e_Mechanic', '{Mechanic}', 'Planner', 'Locked')`,
      [spkId],
    );
    // UTC wall time whatever the session time zone (NFR-14): the columns hold UTC.
    await db.query(
      `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, acted_at)
       VALUES ($1, 'Creation', 'Submit', $2, 'Planner', (now() AT TIME ZONE 'UTC') - interval '42 minutes')`,
      [spkId, plannerId],
    );
  }
}
