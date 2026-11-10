import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ACCOUNT_ACTIONS, type Account, type AccountAction, type Role } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { ACCOUNT_MESSAGES } from '../../../src/core/iam/account-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { findContractBreaks, type ContractCase } from '../harness/allowed-actions-contract.js';
import { testPool } from '../harness/database.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeClock } from '../harness/fake-clock.js';
import { FakeEmail, insertAccount, postJson } from './auth-harness.js';

const clock = FakeClock.atWib('2026-11-10 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();

async function setting(key: string, value: unknown): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, JSON.stringify(value)],
  );
}

function signIn(email: string, password: string): Promise<Response> {
  return postJson(baseUrl, '/auth/sign-in', { email, password, client: 'mobile' });
}

async function tokenOf(email: string, password: string): Promise<string> {
  return ((await (await signIn(email, password)).json()) as { accessToken: string }).accessToken;
}

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  ids.set(key, created.id);
  tokens.set(key, await tokenOf(created.email, created.password));
}

function call(who: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${tokens.get(who)}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const me = (token: string) =>
  fetch(`${baseUrl}/me`, { headers: { authorization: `Bearer ${token}` } });

async function list(): Promise<Account[]> {
  const response = await call('am', 'GET', '/accounts');
  expect(response.status).toBe(200);
  return ((await response.json()) as { accounts: Account[] }).accounts;
}

const find = async (id: number) => (await list()).find((a) => a.id === id);
const id = (key: string) => ids.get(key) ?? 0;
const message = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

async function auditOf(entityId: number): Promise<{ action: string; reason: string | null }[]> {
  const { rows } = await testPool().query<{ action: string; reason: string | null }>(
    `SELECT action, reason FROM audit_logs WHERE entity = 'user' AND entity_id = $1 ORDER BY id`,
    [entityId],
  );
  return rows;
}

async function lock(userId: number): Promise<void> {
  await testPool().query(`UPDATE users SET locked_until = $1 WHERE id = $2`, [
    new Date(clock.now().getTime() + 15 * 60_000),
    userId,
  ]);
}

beforeAll(async () => {
  await seedRolePermissions();
  await setting('system_mode', 'Live');
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
  await account('am2', 'Access_Manager');
  await account('yusuf', 'System_Admin');
  await account('rina', 'Planner');
});

afterAll(async () => {
  await app.close();
});

describe('Users and roles', () => {
  it('AC-IAM-003 RL-4 the System Admin cannot open Users and roles or change an account', async () => {
    expect((await call('yusuf', 'GET', '/accounts')).status).toBe(403);
    const change = await call('yusuf', 'PATCH', `/accounts/${id('rina')}`, {
      name: 'Rina',
      email: 'rina@bmi.test',
      role: 'GM',
    });
    expect(change.status).toBe(403);
    expect((await call('yusuf', 'POST', `/accounts/${id('rina')}/deactivate`)).status).toBe(403);
    const move = await call('yusuf', 'POST', '/accounts/move-system-admin', {
      toUserId: id('rina'),
      reason: 'hand over',
    });
    expect(move.status).toBe(403);
  });

  it('REQ-IAM-002 only the Access Manager manages accounts; a Planner is refused too', async () => {
    expect((await call('rina', 'GET', '/accounts')).status).toBe(403);
    expect((await call('am', 'GET', '/accounts')).status).toBe(200);
  });

  it('REQ-IAM-002 REQ-IAM-009 FLW-AM-01 a new account gets one role and a one-time temporary password', async () => {
    const response = await call('am', 'POST', '/accounts', {
      name: 'Dewi',
      email: 'Dewi.New@bmi.test',
      role: 'Mechanic',
    });
    expect(response.status).toBe(201);
    const { account: created, temporaryPassword } = (await response.json()) as {
      account: Account;
      temporaryPassword: string;
    };
    expect(created).toMatchObject({
      name: 'Dewi',
      email: 'dewi.new@bmi.test',
      role: 'Mechanic',
      status: 'Active',
      lastSignInAt: null,
    });
    expect(temporaryPassword).toMatch(/^(?=.*[A-Za-z])(?=.*\d).{12}$/);
    const signedIn = await signIn('dewi.new@bmi.test', temporaryPassword);
    const user = ((await signedIn.json()) as { user: { mustChangePassword: boolean } }).user;
    expect(user.mustChangePassword).toBe(true);
    expect((await find(created.id))?.lastSignInAt).not.toBeNull();
    expect((await auditOf(created.id)).map((row) => row.action)).toEqual(['create']);
    const { rows } = await testPool().query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [created.id],
    );
    expect(rows[0]?.password_hash).not.toContain(temporaryPassword);
  });

  it('REQ-IAM-002 an email used by another account is refused with 409', async () => {
    await call('am', 'POST', '/accounts', { name: 'A', email: 'twice@bmi.test', role: 'GM' });
    const again = await call('am', 'POST', '/accounts', {
      name: 'B',
      email: 'TWICE@bmi.test',
      role: 'GM',
    });
    expect(again.status).toBe(409);
    expect(await message(again)).toBe(ACCOUNT_MESSAGES.emailTaken);
  });

  it('AC-IAM-004 RL-1 an account cannot be given a second role', async () => {
    const twoRoles = await call('am', 'POST', '/accounts', {
      name: 'Two',
      email: 'two@bmi.test',
      role: ['Planner', 'GM'],
    });
    expect(twoRoles.status).toBe(400);
    await expect(
      testPool().query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'GM')`, [id('rina')]),
    ).rejects.toThrow(/uq_one_role_per_user|duplicate key/);
  });

  it('AC-IAM-001 BR-14 the System Admin role cannot be given to a second account', async () => {
    const byForm = await call('am', 'PATCH', `/accounts/${id('rina')}`, {
      name: 'Rina',
      email: 'rina.form@bmi.test',
      role: 'System_Admin',
    });
    expect(byForm.status).toBe(403);
    expect(await message(byForm)).toBe(ACCOUNT_MESSAGES.systemAdminByMove);
    const byCreate = await call('am', 'POST', '/accounts', {
      name: 'Second',
      email: 'second.sa@bmi.test',
      role: 'System_Admin',
    });
    expect(byCreate.status).toBe(400);
    const created = await insertAccount({ role: 'GM' });
    await testPool().query('DELETE FROM user_roles WHERE user_id = $1', [created.id]);
    await expect(
      testPool().query(`INSERT INTO user_roles (user_id, role) VALUES ($1, 'System_Admin')`, [
        created.id,
      ]),
    ).rejects.toThrow(/uq_one_system_admin|duplicate key/);
  });

  it('REQ-IAM-002 editing the role writes a role_change audit record', async () => {
    const created = await insertAccount({ role: 'Driver' });
    const response = await call('am', 'PATCH', `/accounts/${created.id}`, {
      name: 'Pak Driver',
      email: created.email,
      role: 'Field_Coordinator',
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { account: Account }).account).toMatchObject({
      name: 'Pak Driver',
      role: 'Field_Coordinator',
    });
    expect((await auditOf(created.id)).map((row) => row.action)).toEqual(['role_change']);
  });

  it('BR-14 the System Admin holder keeps an editable name and email', async () => {
    const holder = await find(id('yusuf'));
    const renamed = await call('am', 'PATCH', `/accounts/${id('yusuf')}`, {
      name: 'Yusuf Admin',
      email: holder?.email,
      role: 'System_Admin',
    });
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as { account: Account }).account).toMatchObject({
      name: 'Yusuf Admin',
      role: 'System_Admin',
    });
  });

  it('BR-14 DEC-116 the System Admin keeps its role in the form, and an Access Manager keeps its own', async () => {
    const sa = await call('am', 'PATCH', `/accounts/${id('yusuf')}`, {
      name: 'Yusuf',
      email: (await find(id('yusuf')))?.email,
      role: 'GM',
    });
    expect(sa.status).toBe(403);
    expect(await message(sa)).toBe(ACCOUNT_MESSAGES.systemAdminRoleLocked);
    const self = await call('am', 'PATCH', `/accounts/${id('am')}`, {
      name: 'AM',
      email: (await find(id('am')))?.email,
      role: 'Planner',
    });
    expect(self.status).toBe(403);
    expect(await message(self)).toBe(ACCOUNT_MESSAGES.ownRole);
  });

  it('REQ-IAM-001 FLW-AM-04 the Access Manager unlocks a locked account and it signs in again', async () => {
    const locked = await insertAccount({ role: 'Planner' });
    await lock(locked.id);
    const before = await find(locked.id);
    expect(before?.status).toBe('Locked');
    expect(before?.allowedActions).toContain('unlock');
    const unlocked = await call('am', 'POST', `/accounts/${locked.id}/unlock`);
    expect(((await unlocked.json()) as { account: Account }).account.status).toBe('Active');
    expect((await signIn(locked.email, locked.password)).status).toBe(200);
    expect((await auditOf(locked.id)).map((row) => row.action)).toEqual(['unlock']);
  });

  it('FLW-AM-04 DEC-116 deactivation ends the sessions and the sign-in; Activate brings it back', async () => {
    const worker = await insertAccount({ role: 'Mechanic' });
    const session = await tokenOf(worker.email, worker.password);
    const off = await call('am', 'POST', `/accounts/${worker.id}/deactivate`);
    expect(((await off.json()) as { account: Account }).account).toMatchObject({
      status: 'Inactive',
      allowedActions: ['edit', 'activate'],
    });
    expect((await me(session)).status).toBe(401);
    expect((await signIn(worker.email, worker.password)).status).toBe(401);
    const on = await call('am', 'POST', `/accounts/${worker.id}/activate`);
    expect(((await on.json()) as { account: Account }).account.status).toBe('Active');
    expect((await signIn(worker.email, worker.password)).status).toBe(200);
    expect((await auditOf(worker.id)).map((row) => row.action)).toEqual(['deactivate', 'activate']);
  });

  it('BR-14 DEC-116 neither the System Admin nor the Access Manager itself can be deactivated', async () => {
    const sa = await call('am', 'POST', `/accounts/${id('yusuf')}/deactivate`);
    expect(sa.status).toBe(403);
    expect(await message(sa)).toBe(ACCOUNT_MESSAGES.systemAdminRoleLocked);
    const self = await call('am', 'POST', `/accounts/${id('am')}/deactivate`);
    expect(self.status).toBe(403);
    expect(await message(self)).toBe(ACCOUNT_MESSAGES.ownAccount);
    expect((await find(id('am')))?.allowedActions).not.toContain('deactivate');
    expect((await find(id('am2')))?.allowedActions).toContain('deactivate');
  });

  it('REQ-IAM-009 a reset gives a new temporary password and ends the old sessions', async () => {
    const user = await insertAccount({ role: 'GM' });
    const old = await tokenOf(user.email, user.password);
    const reset = await call('am', 'POST', `/accounts/${user.id}/reset-password`);
    const { temporaryPassword } = (await reset.json()) as { temporaryPassword: string };
    expect((await me(old)).status).toBe(401);
    expect((await signIn(user.email, user.password)).status).toBe(401);
    expect((await signIn(user.email, temporaryPassword)).status).toBe(200);
  });

  it('AC-IAM-002 REQ-IAM-004 FLW-AM-03 the role moves from Yusuf to Rina with exactly one audit record', async () => {
    const count = `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'move_system_admin'`;
    const before = (await testPool().query<{ n: number }>(count)).rows[0]?.n ?? 0;
    const moved = await call('am', 'POST', '/accounts/move-system-admin', {
      toUserId: id('rina'),
      reason: 'Yusuf moves to the Jakarta office',
    });
    expect(moved.status).toBe(200);
    const accounts = ((await moved.json()) as { accounts: Account[] }).accounts;
    expect(accounts.find((a) => a.id === id('rina'))?.role).toBe('System_Admin');
    expect(accounts.find((a) => a.id === id('yusuf'))?.role).toBeNull();
    const after = (await testPool().query<{ n: number }>(count)).rows[0]?.n ?? 0;
    expect(after - before).toBe(1);
    expect((await auditOf(id('rina'))).at(-1)).toEqual({
      action: 'move_system_admin',
      reason: 'Yusuf moves to the Jakarta office',
    });
    const holders = await testPool().query(
      `SELECT user_id FROM user_roles WHERE role = 'System_Admin'`,
    );
    expect(holders.rows).toEqual([{ user_id: String(id('rina')) }]);
  });

  it('REQ-IAM-004 the role moves only to another active account, with a reason', async () => {
    const inactive = await insertAccount({ role: 'GM', active: false });
    const toInactive = await call('am', 'POST', '/accounts/move-system-admin', {
      toUserId: inactive.id,
      reason: 'try',
    });
    expect(toInactive.status).toBe(403);
    expect(await message(toInactive)).toBe(ACCOUNT_MESSAGES.moveTarget);
    const noReason = await call('am', 'POST', '/accounts/move-system-admin', {
      toUserId: id('am2'),
      reason: '  ',
    });
    expect(noReason.status).toBe(400);
  });
});

describe('allowedActions contract', () => {
  /** A fresh account in the given state, so every send starts from the same record. */
  async function freshAccount(state: 'Active' | 'Locked' | 'Inactive'): Promise<number> {
    const created = await insertAccount({ role: 'Planner', active: state !== 'Inactive' });
    if (state === 'Locked') await lock(created.id);
    return created.id;
  }

  async function send(target: number, action: AccountAction): Promise<number> {
    if (action === 'edit') {
      const current = await find(target);
      const body = { name: current?.name, email: current?.email, role: current?.role };
      return (await call('am', 'PATCH', `/accounts/${target}`, body)).status;
    }
    const path = action === 'reset_password' ? 'reset-password' : action;
    return (await call('am', 'POST', `/accounts/${target}/${path}`)).status;
  }

  const stateCase = (state: 'Active' | 'Locked' | 'Inactive'): ContractCase<AccountAction> => ({
    label: `Access Manager on a ${state} account`,
    listed: async () => (await find(await freshAccount(state)))?.allowedActions ?? [],
    send: async (action) => send(await freshAccount(state), action),
  });

  it('REQ-IAM-014 every listed account action is accepted and every other is refused', async () => {
    expect(
      await findContractBreaks(ACCOUNT_ACTIONS, [
        stateCase('Active'),
        stateCase('Locked'),
        stateCase('Inactive'),
      ]),
    ).toEqual([]);
  });
});
