import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Controller, Get, Module, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  defaultRolePermissions,
  menuFor,
  PERMISSION_CODES,
  type PermissionCode,
  type Role,
} from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { RequireCapability, SessionGuard } from '../../../src/http/auth/auth-http.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { FakeEmail, insertAccount, postJson } from './auth-harness.js';

const ROLES: Role[] = [
  'Planner',
  'Mechanic',
  'Warehouse_Manager',
  'Supervisor',
  'GM',
  'System_Admin',
  'Access_Manager',
  'Driver',
  'Field_Coordinator',
  'Accounting',
];

/** A generated controller: one route per catalogue code, each guarded by that code alone (2.4 L1). */
class ProbeController {
  readonly purpose = 'one guarded route per permission code';
}
for (const code of PERMISSION_CODES) {
  const name = `probe_${code.replace(/\W/g, '_')}`;
  Object.defineProperty(ProbeController.prototype, name, {
    value: () => ({ ok: true }),
    writable: true,
    configurable: true,
  });
  const descriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, name);
  if (!descriptor) throw new Error(`probe route ${name} was not defined`);
  Get(code)(ProbeController.prototype, name, descriptor);
  UseGuards(SessionGuard)(ProbeController.prototype, name, descriptor);
  RequireCapability(code)(ProbeController.prototype, name, descriptor);
}
Controller('probe')(ProbeController);

@Module({ imports: [AppModule], controllers: [ProbeController] })
class ProbeModule {}

const clock = FakeClock.atWib('2026-11-10 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<Role, string>();

async function setting(key: string, value: unknown): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, JSON.stringify(value)],
  );
}

const call = (role: Role, path: string) =>
  fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${tokens.get(role)}` } });

async function me(role: Role): Promise<{ capabilities: PermissionCode[]; systemMode: string }> {
  const response = await call(role, '/me');
  expect(response.status).toBe(200);
  return (await response.json()) as { capabilities: PermissionCode[]; systemMode: string };
}

const menuOf = (codes: PermissionCode[]) => menuFor(new Set(codes), 'Live').map((i) => i.label);

const expected = (role: Role) =>
  defaultRolePermissions()
    .filter((row) => row.role === role && row.allowed)
    .map((row) => row.permissionCode)
    .sort();

beforeAll(async () => {
  // The worker setup empties every table, so the seed migration of TASK-105 runs again here.
  const seed = await readFile(
    join(import.meta.dirname, '../../../migrations/0004_role_permissions_seed.sql'),
    'utf8',
  );
  await testPool().query(seed);
  await setting('system_mode', 'Live');
  const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] })
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
  for (const role of ROLES) {
    const account = await insertAccount({ role });
    const response = await postJson(baseUrl, '/auth/sign-in', {
      email: account.email,
      password: account.password,
      client: 'mobile',
    });
    tokens.set(role, ((await response.json()) as { accessToken: string }).accessToken);
  }
});

afterAll(async () => {
  await app.close();
});

describe('capability matrix', () => {
  it('REQ-IAM-005 the seed migration is the 2.2 matrix of @bmi/shared, row for row', async () => {
    const { rows } = await testPool().query<{
      role: Role;
      permission_code: PermissionCode;
      allowed: boolean;
      is_locked: boolean;
    }>('SELECT role::text AS role, permission_code, allowed, is_locked FROM role_permissions');
    const stored = rows
      .map((r) => `${r.role}|${r.permission_code}|${r.allowed}|${r.is_locked}`)
      .sort();
    const source = defaultRolePermissions()
      .map((r) => `${r.role}|${r.permissionCode}|${r.allowed}|${r.isLocked}`)
      .sort();
    expect(stored).toEqual(source);
  });

  it('REQ-IAM-013 GET /me returns, for every role, exactly the codes of its column and the mode', async () => {
    for (const role of ROLES) {
      const answer = await me(role);
      expect(answer.capabilities, role).toEqual(expected(role));
      expect(answer.systemMode).toBe('Live');
    }
  });

  it('REQ-IAM-006 NFR-04 every guarded route accepts exactly the roles that hold its code (10 x 44)', async () => {
    const mismatches: string[] = [];
    for (const role of ROLES) {
      const held = new Set(expected(role));
      for (const code of PERMISSION_CODES) {
        const status = (await call(role, `/probe/${code}`)).status;
        const want = held.has(code) ? 200 : 403;
        if (status !== want) mismatches.push(`${role} ${code}: ${status}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('REQ-IAM-006 a guarded route without a session answers 401, and a refusal names no code', async () => {
    expect((await fetch(`${baseUrl}/probe/spk.create`)).status).toBe(401);
    const refused = await call('Accounting', '/probe/spk.create');
    expect(((await refused.json()) as { message: string }).message).toBe(
      'You do not have permission to do this.',
    );
  });

  it('AC-IAM-008 the Planner approval switch changes the next request, without a new sign-in', async () => {
    await setting('planner_approval_kinds', ['spk_creation']);
    await setting('planner_approval_until', null);
    const on = await me('Planner');
    expect(on.capabilities).toContain('spk.approve');
    expect(on.capabilities).not.toContain('count.approve');
    expect(menuOf(on.capabilities)).toContain('Approvals');
    expect((await call('Planner', '/probe/spk.approve')).status).toBe(200);
    expect((await call('Planner', '/probe/count.approve')).status).toBe(403);
    await setting('planner_approval_kinds', []);
    const off = await me('Planner');
    expect(off.capabilities).not.toContain('spk.approve');
    expect(menuOf(off.capabilities)).not.toContain('Approvals');
    expect((await call('Planner', '/probe/spk.approve')).status).toBe(403);
  });

  it('AC-IAM-005 the switch ends by itself at its end time', async () => {
    await setting('planner_approval_kinds', ['spk_completion']);
    await setting('planner_approval_until', new Date(clock.now().getTime() + 60_000).toISOString());
    expect((await me('Planner')).capabilities).toContain('spk.approve');
    clock.advanceMinutes(1);
    expect((await me('Planner')).capabilities).not.toContain('spk.approve');
    await setting('planner_approval_kinds', []);
  });

  it('AC-IAM-009 removing vehicle.view from Accounting takes it away on the next request', async () => {
    const vehicleView = `role = 'Accounting' AND permission_code = 'vehicle.view'`;
    await testPool().query(`UPDATE role_permissions SET allowed = false WHERE ${vehicleView}`);
    const after = await me('Accounting');
    expect(after.capabilities).not.toContain('vehicle.view');
    expect(menuOf(after.capabilities)).not.toContain('Vehicles');
    expect((await call('Accounting', '/probe/vehicle.view')).status).toBe(403);
    await testPool().query(`UPDATE role_permissions SET allowed = true WHERE ${vehicleView}`);
  });

  it('REQ-IAM-010 Setup mode removes the operational codes from every set', async () => {
    await setting('system_mode', 'Setup');
    const admin = await me('System_Admin');
    expect(admin.systemMode).toBe('Setup');
    expect(admin.capabilities).not.toContain('spk.create');
    expect(admin.capabilities).toContain('setup.golive');
    expect(admin.capabilities).toContain('vehicle.manage');
    await setting('system_mode', 'Live');
  });
});
