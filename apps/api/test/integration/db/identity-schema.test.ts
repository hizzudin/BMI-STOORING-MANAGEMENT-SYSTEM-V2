import { SQL_ENUMS } from '@bmi/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { testPool } from '../harness/database.js';
import { insertUsers } from '../harness/users.js';

const query = (sql: string, params: unknown[] = []) => testPool().query(sql, params);

async function refused(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await query(sql, params);
  } catch (error) {
    return (error as { code?: string }).code ?? 'error';
  }
  return 'accepted';
}

describe('§9.1 enums in the database', () => {
  it('TX-01 every enum of section 9.1 exists with the values of @bmi/shared', async () => {
    const { rows } = await query(`
      SELECT t.typname AS name, array_agg(e.enumlabel::text ORDER BY e.enumsortorder) AS labels
      FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' GROUP BY t.typname`);
    const inDatabase = Object.fromEntries(rows.map((row) => [row.name, row.labels]));
    expect(inDatabase).toEqual(
      Object.fromEntries(Object.entries(SQL_ENUMS).map(([name, values]) => [name, [...values]])),
    );
  });
});

describe('§9.2 identity and access', () => {
  beforeEach(async () => {
    await query('DELETE FROM user_roles');
  });

  it('BR-14 an account holds exactly one role', async () => {
    const [user] = await insertUsers(1);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'Planner')`, [user]);
    expect(
      await refused(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'Mechanic')`, [user]),
    ).toBe('23505');
  });

  it('BR-14 exactly one account holds System Admin', async () => {
    const [first, second] = await insertUsers(2);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'System_Admin')`, [first]);
    expect(
      await refused(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'System_Admin')`, [second]),
    ).toBe('23505');
  });

  it('BR-14 many accounts may hold any other role', async () => {
    const [first, second] = await insertUsers(2);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'Planner'), ($2, 'Planner')`, [
      first,
      second,
    ]);
    const { rows } = await query(
      `SELECT count(*)::int AS total FROM user_roles WHERE role = 'Planner'`,
    );
    expect(rows[0].total).toBe(2);
  });

  it('BR-14 a role outside role_t is refused', async () => {
    const [user] = await insertUsers(1);
    expect(
      await refused(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'Owner')`, [user]),
    ).toBe('22P02');
  });

  it('TX-18 an email is unique among accounts that are not soft-deleted, and reusable after', async () => {
    await query(
      `INSERT INTO users (name, email, password_hash) VALUES ('A', 'same@bmi.test', 'x')`,
    );
    expect(
      await refused(
        `INSERT INTO users (name, email, password_hash) VALUES ('B', 'same@bmi.test', 'x')`,
      ),
    ).toBe('23505');
    await query(`UPDATE users SET deleted_at = now() WHERE email = 'same@bmi.test'`);
    expect(
      await refused(
        `INSERT INTO users (name, email, password_hash) VALUES ('C', 'same@bmi.test', 'x')`,
      ),
    ).toBe('accepted');
  });

  it('REQ-IAM-009 a new account must change its password first', async () => {
    const [user] = await insertUsers(1);
    const { rows } = await query(
      'SELECT must_change_password, failed_logins, is_active FROM users WHERE id = $1',
      [user],
    );
    expect(rows[0]).toEqual({ must_change_password: true, failed_logins: 0, is_active: true });
  });

  it('BR-10 a referenced account cannot be physically deleted', async () => {
    const [user] = await insertUsers(1);
    await query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'Mechanic')`, [user]);
    expect(await refused('DELETE FROM users WHERE id = $1', [user])).toBe('23503');
  });

  it('REQ-IAM-005 a permission cell is stored once per role and code', async () => {
    await query(
      `INSERT INTO role_permissions (role, permission_code, allowed) VALUES ('Planner', 'spk.create', true)`,
    );
    expect(
      await refused(
        `INSERT INTO role_permissions (role, permission_code, allowed) VALUES ('Planner', 'spk.create', false)`,
      ),
    ).toBe('23505');
    await query(`DELETE FROM role_permissions`);
  });
});

describe('§9.2 audit log', () => {
  it('NFR-02 an audit record keeps user, role, time, before, after and the self-decision flag', async () => {
    const [user] = await insertUsers(1);
    await query(
      `INSERT INTO audit_logs (entity, entity_id, action, before, after, user_id, user_role, self_decision)
       VALUES ('spks', 1, 'Approve', '{"status":"Pending_Approval"}', '{"status":"Active"}', $1, 'System_Admin', true)`,
      [user],
    );
    const { rows } = await query(
      `SELECT action, before, after, user_role, self_decision, at IS NOT NULL AS has_time FROM audit_logs WHERE entity = 'spks'`,
    );
    expect(rows[0]).toEqual({
      action: 'Approve',
      before: { status: 'Pending_Approval' },
      after: { status: 'Active' },
      user_role: 'System_Admin',
      self_decision: true,
      has_time: true,
    });
  });

  it('BR-10 NFR-02 an audit record cannot be updated', async () => {
    await query(`INSERT INTO audit_logs (entity, entity_id, action) VALUES ('users', 1, 'Create')`);
    expect(await refused(`UPDATE audit_logs SET action = 'Changed' WHERE entity = 'users'`)).toBe(
      'P0001',
    );
  });

  it('BR-10 NFR-02 an audit record cannot be deleted', async () => {
    await query(`INSERT INTO audit_logs (entity, entity_id, action) VALUES ('users', 2, 'Create')`);
    expect(await refused(`DELETE FROM audit_logs WHERE entity = 'users'`)).toBe('P0001');
  });
});

describe('§9.12 platform tables', () => {
  it('TX-22 an idempotency key belongs to an existing account', async () => {
    expect(
      await refused(
        `INSERT INTO idempotency_keys (user_id, idem_key, request_hash) VALUES (999999, 'k', $1)`,
        ['a'.repeat(64)],
      ),
    ).toBe('23503');
  });

  it('REQ-FUP a Ready file needs its sha256', async () => {
    const [user] = await insertUsers(1);
    expect(
      await refused(
        `INSERT INTO stored_files (storage_key, profile, mime_type, status, uploaded_by) VALUES ('local/2026/11/x/1.jpg', 'Photo', 'image/jpeg', 'Ready', $1)`,
        [user],
      ),
    ).toBe('23514');
  });

  it('REQ-TYR-004 a table preference is stored once per user and table', async () => {
    const [user] = await insertUsers(1);
    await query(
      `INSERT INTO user_table_preferences (user_id, table_key, columns) VALUES ($1, 'tyres_list', '["code"]')`,
      [user],
    );
    expect(
      await refused(
        `INSERT INTO user_table_preferences (user_id, table_key, columns) VALUES ($1, 'tyres_list', '["serial"]')`,
        [user],
      ),
    ).toBe('23505');
  });

  it('NFR-15 a setting key is stored once', async () => {
    await query(`INSERT INTO app_settings (setting_key, setting_value) VALUES ('probe_key', '1')`);
    expect(
      await refused(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES ('probe_key', '2')`,
      ),
    ).toBe('23505');
    await query(`DELETE FROM app_settings WHERE setting_key = 'probe_key'`);
  });
});
