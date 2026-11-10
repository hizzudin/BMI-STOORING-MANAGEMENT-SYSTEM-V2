import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  defaultRolePermissions,
  menuFor,
  type PermissionCode,
  type Role,
  type RolePermissionCell,
} from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { ROLE_PERMISSION_MESSAGES } from '../../../src/core/iam/role-permission-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from './auth-harness.js';

const clock = FakeClock.atWib('2026-11-11 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
let auditFrom = 0;

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  const response = await postJson(baseUrl, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
}

function call(who: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${tokens.get(who)}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const message = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

async function matrix(): Promise<{ cells: RolePermissionCell[]; allowedActions: string[] }> {
  const response = await call('am', 'GET', '/role-permissions');
  expect(response.status).toBe(200);
  return (await response.json()) as { cells: RolePermissionCell[]; allowedActions: string[] };
}

const cellOf = (cells: RolePermissionCell[], role: Role, code: PermissionCode) =>
  cells.find((c) => c.role === role && c.permissionCode === code);

async function stored(role: Role, code: PermissionCode): Promise<boolean | undefined> {
  const { rows } = await testPool().query<{ allowed: boolean }>(
    'SELECT allowed FROM role_permissions WHERE role = $1 AND permission_code = $2',
    [role, code],
  );
  return rows[0]?.allowed;
}

async function matrixAudits(): Promise<{ before: unknown; after: unknown; user_role: string }[]> {
  const { rows } = await testPool().query<{ before: unknown; after: unknown; user_role: string }>(
    `SELECT before, after, user_role::text AS user_role FROM audit_logs
     WHERE entity = 'role_permissions' AND entity_id = 0 AND id > $1 ORDER BY id`,
    [auditFrom],
  );
  return rows;
}

beforeAll(async () => {
  await seedRolePermissions();
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', '"Live"'::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
  );
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(EMAIL)
    .useValue(new FakeEmail())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new ScryptPasswordHasher(2 ** 12))
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('am', 'Access_Manager');
  await account('yusuf', 'System_Admin');
  await account('rina', 'Planner');
  await account('acc', 'Accounting');
});

beforeEach(async () => {
  // Every test starts from the default matrix.
  await testPool().query('DELETE FROM role_permissions');
  await seedRolePermissions();
  // audit_logs is append only (BR-10): a test reads the rows written after it started.
  const { rows } = await testPool().query<{ last: string | null }>(
    'SELECT max(id)::text AS last FROM audit_logs',
  );
  auditFrom = Number(rows[0]?.last ?? 0);
});

afterAll(async () => {
  await app.close();
});

describe('Roles and permissions matrix', () => {
  it('AC-IAM-003 RL-4 the System Admin and a Planner cannot open or change the matrix', async () => {
    const change = { changes: [{ role: 'Mechanic', permissionCode: 'audit.view', allowed: true }] };
    for (const who of ['yusuf', 'rina']) {
      expect((await call(who, 'GET', '/role-permissions')).status, who).toBe(403);
      expect((await call(who, 'PATCH', '/role-permissions', change)).status, who).toBe(403);
    }
    expect(await stored('Mechanic', 'audit.view')).toBe(false);
  });

  it('REQ-IAM-005 the matrix is every role x every code, with locks, S cells and the edit action', async () => {
    const { cells, allowedActions } = await matrix();
    expect(allowedActions).toEqual(['edit']);
    const expected = defaultRolePermissions()
      .map((r) => `${r.role}|${r.permissionCode}|${r.allowed}|${r.isLocked}`)
      .sort();
    expect(
      cells.map((c) => `${c.role}|${c.permissionCode}|${c.allowed}|${c.isLocked}`).sort(),
    ).toEqual(expected);
    expect(cellOf(cells, 'Planner', 'spk.approve')).toMatchObject({
      switchable: true,
      isLocked: true,
    });
    expect(cells.filter((c) => c.switchable)).toHaveLength(2);
  });

  it('REQ-IAM-005 a locked cell cannot change, and the whole save is refused', async () => {
    const response = await call('am', 'PATCH', '/role-permissions', {
      changes: [
        { role: 'Mechanic', permissionCode: 'audit.view', allowed: true },
        { role: 'Mechanic', permissionCode: 'spk.approve', allowed: true },
      ],
    });
    expect(response.status).toBe(403);
    expect(await message(response)).toBe(ROLE_PERMISSION_MESSAGES.locked);
    expect(await stored('Mechanic', 'spk.approve')).toBe(false);
    expect(await stored('Mechanic', 'audit.view')).toBe(false);
    expect(await matrixAudits()).toEqual([]);
  });

  it('REQ-IAM-005 the System Admin column and the account codes stay as the rule fixes them', async () => {
    for (const change of [
      { role: 'System_Admin', permissionCode: 'vehicle.manage', allowed: false },
      { role: 'Supervisor', permissionCode: 'accounts.manage', allowed: true },
      { role: 'Access_Manager', permissionCode: 'spk.create', allowed: true },
    ]) {
      const response = await call('am', 'PATCH', '/role-permissions', { changes: [change] });
      expect(response.status, change.permissionCode).toBe(403);
    }
  });

  it('REQ-IAM-008 an S cell changes only through the Planner approval switch', async () => {
    const response = await call('am', 'PATCH', '/role-permissions', {
      changes: [{ role: 'Planner', permissionCode: 'count.approve', allowed: true }],
    });
    expect(response.status).toBe(403);
    expect(await message(response)).toBe(ROLE_PERMISSION_MESSAGES.switchable);
  });

  it('DEC-117 Save writes every staged cell together with one audit record of what changed', async () => {
    const response = await call('am', 'PATCH', '/role-permissions', {
      changes: [
        { role: 'Driver', permissionCode: 'vehicle.view', allowed: true },
        { role: 'Mechanic', permissionCode: 'audit.view', allowed: true },
        // Already allowed: kept out of the audit record.
        { role: 'Planner', permissionCode: 'spk.create', allowed: true },
      ],
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { cells: RolePermissionCell[] };
    expect(cellOf(body.cells, 'Driver', 'vehicle.view')?.allowed).toBe(true);
    expect(await stored('Mechanic', 'audit.view')).toBe(true);
    expect(await matrixAudits()).toEqual([
      {
        before: { Driver: { 'vehicle.view': false }, Mechanic: { 'audit.view': false } },
        after: { Driver: { 'vehicle.view': true }, Mechanic: { 'audit.view': true } },
        user_role: 'Access_Manager',
      },
    ]);
  });

  it('DEC-117 a save that changes nothing writes no audit record', async () => {
    const response = await call('am', 'PATCH', '/role-permissions', {
      changes: [{ role: 'Planner', permissionCode: 'spk.create', allowed: true }],
    });
    expect(response.status).toBe(200);
    expect(await matrixAudits()).toEqual([]);
  });

  it('AC-IAM-009 NAV-9 removing vehicle.view from Accounting takes it away on the next request', async () => {
    const before = (await (await call('acc', 'GET', '/me')).json()) as {
      capabilities: PermissionCode[];
    };
    expect(before.capabilities).toContain('vehicle.view');
    const response = await call('am', 'PATCH', '/role-permissions', {
      changes: [{ role: 'Accounting', permissionCode: 'vehicle.view', allowed: false }],
    });
    expect(response.status).toBe(200);
    const after = (await (await call('acc', 'GET', '/me')).json()) as {
      capabilities: PermissionCode[];
    };
    expect(after.capabilities).not.toContain('vehicle.view');
    expect(menuFor(new Set(after.capabilities), 'Live').map((i) => i.label)).not.toContain(
      'Vehicles',
    );
  });

  it('REQ-IAM-005 an invalid save is refused with its first issue', async () => {
    const response = await call('am', 'PATCH', '/role-permissions', { changes: [] });
    expect(response.status).toBe(400);
  });
});
