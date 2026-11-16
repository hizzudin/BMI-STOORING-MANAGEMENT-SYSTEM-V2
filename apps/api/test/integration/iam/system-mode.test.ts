import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, SystemModeResponse } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
} from '../../../src/app.tokens.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-17 08:00');
const BEING_SET_UP = 'The system is being set up.';
let app: INestApplication;
let baseUrl: string;
const accounts = new Map<string, { email: string; password: string }>();
const tokens = new Map<string, { accessToken: string; refreshToken: string }>();
let keySeq = 0;

async function setMode(mode: 'Setup' | 'Live'): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', $1::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [JSON.stringify(mode)],
  );
}

const signIn = (who: string) => {
  const account = accounts.get(who);
  return postJson(baseUrl, '/auth/sign-in', {
    email: account?.email,
    password: account?.password,
    client: 'mobile',
  });
};

async function signedIn(who: string): Promise<void> {
  const response = await signIn(who);
  expect(response.status).toBe(200);
  tokens.set(who, (await response.json()) as { accessToken: string; refreshToken: string });
}

const auth = (who: string) => ({ authorization: `Bearer ${tokens.get(who)?.accessToken}` });
const get = (who: string, path: string) => fetch(`${baseUrl}${path}`, { headers: auth(who) });

function switchMode(
  who: string,
  to: 'go-live' | 'back-to-setup',
  body: { reason: string; confirmation: string },
  key = `mode-${(keySeq += 1)}`,
): Promise<Response> {
  return fetch(`${baseUrl}/system-mode/${to}`, {
    method: 'POST',
    headers: { ...auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

const message = async (response: Response) =>
  ((await response.json()) as { message: string }).message;
const modeAudits = async () =>
  (
    await testPool().query<{ action: string; reason: string; before: unknown; after: unknown }>(
      `SELECT action, reason, before, after FROM audit_logs WHERE entity = 'system_mode' ORDER BY id`,
    )
  ).rows;
const wentLiveAt = async () =>
  (
    await testPool().query<{ value: unknown }>(
      `SELECT setting_value AS value FROM app_settings WHERE setting_key = 'went_live_at'`,
    )
  ).rows[0]?.value ?? null;

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  accounts.set(key, { email: created.email, password: created.password });
}

beforeAll(async () => {
  await seedRolePermissions();
  await setMode('Setup');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PG_POOL)
    .useValue(testPool())
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(EMAIL)
    .useValue(new FakeEmail())
    .overrideProvider(PASSWORD_HASHER)
    .useValue(new ScryptPasswordHasher(2 ** 12))
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('admin', 'System_Admin');
  await account('am', 'Access_Manager');
  await account('planner', 'Planner');
  await signedIn('admin');
  await signedIn('am');
});

afterAll(async () => {
  await app.close();
});

// The tests run in order: Setup → Live → Setup → Live.
describe('Setup mode and Go live (REQ-IAM-010, DEC-56, DEC-132)', () => {
  it('AC-IAM-006 DEC-133 in Setup a Planner sign-in is refused with The system is being set up, and the System Admin holds Create SPK', async () => {
    const refused = await signIn('planner');
    expect(refused.status).toBe(403);
    expect(await message(refused)).toBe(BEING_SET_UP);
    const me = (await (await get('admin', '/me')).json()) as { capabilities: string[] };
    expect(me.capabilities).toEqual(expect.arrayContaining(['spk.create', 'spk.approve']));
  });

  it('DEC-132 shows the mode, the checklist with counts and what the System Admin may do', async () => {
    const response = await get('admin', '/system-mode');
    expect(response.status).toBe(200);
    const status = (await response.json()) as SystemModeResponse;
    expect(status.mode).toBe('Setup');
    expect(status.wentLiveAt).toBeNull();
    expect(status.allowedActions).toEqual(['go_live']);
    expect(status.checklist.map((item) => [item.key, item.label])).toEqual([
      ['accounts', 'Accounts'],
      ['master_data', 'Master data'],
      ['vehicles', 'Vehicles and documents'],
    ]);
    expect(status.checklist[0]?.count).toBe(3);
    expect(status.checklist[2]?.count).toBe(0);
  });

  it('DEC-132 Go live needs a reason and GO LIVE typed exactly', async () => {
    const noReason = await switchMode('admin', 'go-live', {
      reason: '  ',
      confirmation: 'GO LIVE',
    });
    expect(noReason.status).toBe(400);
    expect(await message(noReason)).toBe('Give a reason.');
    const wrong = await switchMode('admin', 'go-live', {
      reason: 'Ready',
      confirmation: 'go live',
    });
    expect(wrong.status).toBe(400);
    expect(await message(wrong)).toBe('Type GO LIVE to confirm.');
    expect(await modeAudits()).toEqual([]);
  });

  it('AC-IAM-006 after Go live the Planner signs in; one audit record with the reason; a retry switches nothing', async () => {
    const body = { reason: 'Master data is complete', confirmation: 'GO LIVE' };
    const live = await switchMode('admin', 'go-live', body, 'go-live-once');
    expect(live.status).toBe(200);
    expect(((await live.json()) as SystemModeResponse).mode).toBe('Live');
    const replay = await switchMode('admin', 'go-live', body, 'go-live-once');
    expect(replay.status).toBe(200);
    expect(await modeAudits()).toEqual([
      {
        action: 'go_live',
        reason: 'Master data is complete',
        before: { mode: 'Setup' },
        after: { mode: 'Live' },
      },
    ]);
    expect(await wentLiveAt()).toBe('2026-11-17T01:00:00.000Z');
    await signedIn('planner');
    expect((await get('planner', '/me')).status).toBe(200);
  });

  it('DEC-132 in Live: Go live again is refused, Back to Setup is offered, a Planner may not switch', async () => {
    const again = await switchMode('admin', 'go-live', {
      reason: 'Again',
      confirmation: 'GO LIVE',
    });
    expect(again.status).toBe(400);
    expect(await message(again)).toBe('The system is already Live.');
    const status = (await (await get('admin', '/system-mode')).json()) as SystemModeResponse;
    expect(status.allowedActions).toEqual(['back_to_setup']);
    expect(status.wentLiveAt).toBe('2026-11-17T01:00:00.000Z');
    const planner = await switchMode('planner', 'back-to-setup', {
      reason: 'No',
      confirmation: 'BACK TO SETUP',
    });
    expect(planner.status).toBe(403);
  });

  it('AC-IAM-006 DEC-132 Back to Setup ends the Planner session at once; the Access Manager keeps working', async () => {
    const wrong = await switchMode('admin', 'back-to-setup', {
      reason: 'Re-import parts',
      confirmation: 'BACK TO',
    });
    expect(wrong.status).toBe(400);
    expect(await message(wrong)).toBe('Type BACK TO SETUP to confirm.');
    const back = await switchMode('admin', 'back-to-setup', {
      reason: 'Re-import parts',
      confirmation: 'BACK TO SETUP',
    });
    expect(back.status).toBe(200);
    expect(((await back.json()) as SystemModeResponse).mode).toBe('Setup');

    const next = await get('planner', '/me');
    expect(next.status).toBe(403);
    expect(await message(next)).toBe(BEING_SET_UP);
    const refresh = await postJson(baseUrl, '/auth/refresh', {
      refreshToken: tokens.get('planner')?.refreshToken,
    });
    expect(refresh.status).toBe(403);
    expect((await signIn('planner')).status).toBe(403);
    expect((await get('am', '/me')).status).toBe(200);
    expect((await get('admin', '/system-mode')).status).toBe(200);
    expect((await modeAudits()).at(-1)).toEqual({
      action: 'back_to_setup',
      reason: 'Re-import parts',
      before: { mode: 'Live' },
      after: { mode: 'Setup' },
    });
  });

  it('DEC-132 going live again keeps the latest Go live and lets the Planner sign in again', async () => {
    clock.advanceMinutes(3);
    const live = await switchMode('admin', 'go-live', {
      reason: 'Parts re-imported',
      confirmation: 'GO LIVE',
    });
    expect(live.status).toBe(200);
    expect(await wentLiveAt()).toBe('2026-11-17T01:03:00.000Z');
    expect((await modeAudits()).map((row) => row.action)).toEqual([
      'go_live',
      'back_to_setup',
      'go_live',
    ]);
    // The session ended by Back to Setup stays ended; a new sign-in works.
    expect((await get('planner', '/me')).status).toBe(401);
    expect((await signIn('planner')).status).toBe(200);
  });
});
