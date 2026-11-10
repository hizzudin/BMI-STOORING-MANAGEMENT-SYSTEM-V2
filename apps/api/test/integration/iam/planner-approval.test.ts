import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PermissionCode, PlannerApprovalResponse, Role } from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
} from '../../../src/app.tokens.js';
import {
  PLANNER_APPROVAL_MESSAGES,
  PlannerApprovalService,
} from '../../../src/core/iam/planner-approval-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from './auth-harness.js';

/** Records the end jobs instead of reaching Redis (the queue adapter has its own test). */
class RecordingScheduler implements PlannerApprovalEndScheduler {
  readonly ends: Date[] = [];
  scheduleEnd(until: Date): Promise<void> {
    this.ends.push(until);
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-11 08:00');
const scheduler = new RecordingScheduler();
let app: INestApplication;
let baseUrl: string;
let auditFrom = 0;
const tokens = new Map<string, string>();

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

const json = async <T>(response: Response) => (await response.json()) as T;

async function planner(): Promise<PermissionCode[]> {
  return (await json<{ capabilities: PermissionCode[] }>(await call('rina', 'GET', '/me')))
    .capabilities;
}

async function audits(): Promise<
  {
    action: string;
    reason: string | null;
    before: unknown;
    after: unknown;
    user_id: string | null;
  }[]
> {
  const { rows } = await testPool().query<{
    action: string;
    reason: string | null;
    before: unknown;
    after: unknown;
    user_id: string | null;
  }>(
    `SELECT action, reason, before, after, user_id::text AS user_id FROM audit_logs
     WHERE entity = 'planner_approval' AND entity_id = 0 AND id > $1 ORDER BY id`,
    [auditFrom],
  );
  return rows;
}

const at = (wib: string) => FakeClock.atWib(wib).now().toISOString();

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
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(scheduler)
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('am', 'Access_Manager');
  await account('yusuf', 'System_Admin');
  await account('rina', 'Planner');
  await account('budi', 'Supervisor');
});

beforeEach(async () => {
  await testPool().query(
    `DELETE FROM app_settings WHERE setting_key IN ('planner_approval_kinds', 'planner_approval_until')`,
  );
  // audit_logs is append only (BR-10): a test reads the rows written after it started.
  const { rows } = await testPool().query<{ last: string | null }>(
    'SELECT max(id)::text AS last FROM audit_logs',
  );
  auditFrom = Number(rows[0]?.last ?? 0);
  scheduler.ends.length = 0;
});

afterAll(async () => {
  await app.close();
});

describe('Planner approval switch', () => {
  it('RL-7 AC-IAM-003 only the Access Manager reads or switches it', async () => {
    const on = { kinds: ['spk_creation'], until: null, reason: 'Urgent' };
    for (const who of ['yusuf', 'rina', 'budi']) {
      expect((await call(who, 'GET', '/planner-approval')).status, who).toBe(403);
      expect((await call(who, 'PUT', '/planner-approval', on)).status, who).toBe(403);
    }
    const state = await json<PlannerApprovalResponse>(await call('am', 'GET', '/planner-approval'));
    expect(state).toEqual({ on: false, kinds: [], until: null, allowedActions: ['switch_on'] });
  });

  it('REQ-IAM-008 TX-20 switching on gives Planners the ticked kinds, with one audit record and an end job', async () => {
    expect(await planner()).not.toContain('spk.approve');
    const until = at('2026-11-11 18:00');
    const response = await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_creation', 'spk_completion'],
      until,
      reason: 'Supervisor and GM on site visit',
    });
    expect(response.status).toBe(200);
    expect(await json<PlannerApprovalResponse>(response)).toEqual({
      on: true,
      kinds: ['spk_creation', 'spk_completion'],
      until,
      allowedActions: ['change', 'switch_off'],
    });
    const codes = await planner();
    expect(codes).toContain('spk.approve');
    expect(codes).not.toContain('count.approve');
    expect(await audits()).toEqual([
      {
        action: 'switch_on',
        reason: 'Supervisor and GM on site visit',
        before: { kinds: [], until: null },
        after: { kinds: ['spk_creation', 'spk_completion'], until },
        user_id: expect.any(String),
      },
    ]);
    expect(scheduler.ends.map((d) => d.toISOString())).toEqual([until]);
  });

  it('DEC-118 Change while on and Switch off each need a reason and write one audit record', async () => {
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_creation'],
      until: null,
      reason: 'A',
    });
    const changed = await call('am', 'PUT', '/planner-approval', {
      kinds: ['stock_opname'],
      until: null,
      reason: 'Count today',
    });
    expect(changed.status).toBe(200);
    const codes = await planner();
    expect(codes).toContain('count.approve');
    expect(codes).not.toContain('spk.approve');
    expect((await call('am', 'POST', '/planner-approval/switch-off', { reason: '' })).status).toBe(
      400,
    );
    const off = await call('am', 'POST', '/planner-approval/switch-off', { reason: 'Done' });
    expect(off.status).toBe(200);
    expect((await json<PlannerApprovalResponse>(off)).on).toBe(false);
    expect(await planner()).not.toContain('count.approve');
    expect((await audits()).map((row) => [row.action, row.reason])).toEqual([
      ['switch_on', 'A'],
      ['change', 'Count today'],
      ['switch_off', 'Done'],
    ]);
  });

  it('DEC-118 an end time must be later than now; switching off an off switch is refused', async () => {
    const past = await call('am', 'PUT', '/planner-approval', {
      kinds: ['tyre_count'],
      until: at('2026-11-11 07:00'),
      reason: 'Late',
    });
    expect(past.status).toBe(400);
    expect((await json<{ message: string }>(past)).message).toBe(
      PLANNER_APPROVAL_MESSAGES.endInPast,
    );
    const off = await call('am', 'POST', '/planner-approval/switch-off', { reason: 'x' });
    expect(off.status).toBe(403);
    expect((await json<{ message: string }>(off)).message).toBe(
      PLANNER_APPROVAL_MESSAGES.alreadyOff,
    );
    expect(await audits()).toEqual([]);
  });

  it('REQ-IAM-008 DEC-118 at the end time the kinds go at once, and the end is audited once', async () => {
    const until = new Date(clock.now().getTime() + 60_000);
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_amendment'],
      until: until.toISOString(),
      reason: 'One minute',
    });
    expect(await planner()).toContain('spk.approve');
    clock.advanceMinutes(1);
    expect(await planner()).not.toContain('spk.approve');
    const service = app.get(PlannerApprovalService);
    await service.endIfDue();
    await service.endIfDue();
    const state = await json<PlannerApprovalResponse>(await call('am', 'GET', '/planner-approval'));
    expect(state).toMatchObject({ on: false, kinds: [], until: null });
    const ended = (await audits()).filter((row) => row.action === 'end');
    expect(ended).toEqual([
      {
        action: 'end',
        reason: PLANNER_APPROVAL_MESSAGES.ended,
        before: { kinds: ['spk_amendment'], until: until.toISOString() },
        after: { kinds: [], until: null },
        user_id: null,
      },
    ]);
  });

  it('DEC-118 the switch page ends a switch whose end time passed, even before the job runs', async () => {
    const until = new Date(clock.now().getTime() + 60_000);
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['tyre_count'],
      until: until.toISOString(),
      reason: 'Short',
    });
    clock.advanceMinutes(2);
    const state = await json<PlannerApprovalResponse>(await call('am', 'GET', '/planner-approval'));
    expect(state.on).toBe(false);
    expect((await audits()).map((row) => row.action)).toEqual(['switch_on', 'end']);
  });
});
