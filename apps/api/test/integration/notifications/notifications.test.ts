import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NotificationKind, NotificationListResponse, Role } from '@bmi/shared';
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
  PLANNER_SWITCH_TITLES,
  PlannerApprovalService,
} from '../../../src/core/iam/planner-approval-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { notificationGateways } from '../../../src/infra/db/notification-gateways.js';
import { DrizzleUnitOfWork } from '../../../src/infra/db/unit-of-work.js';
import type { NotificationGateways } from '../../../src/ports/notifications.js';
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

const clock = FakeClock.atWib('2026-11-11 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();

async function account(key: string, role: Role, active = true): Promise<void> {
  const created = await insertAccount({ role, active });
  ids.set(key, created.id);
  if (!active) return;
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
const list = async (who: string) =>
  json<NotificationListResponse>(await call(who, 'GET', '/notifications'));
const titles = async (who: string) => (await list(who)).notifications.map((n) => n.title);
const unitOfWork = () =>
  new DrizzleUnitOfWork<NotificationGateways>(testPool(), notificationGateways);

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
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('am', 'Access_Manager');
  await account('budi', 'Supervisor');
  await account('sari', 'Supervisor');
  await account('hendra', 'GM');
  await account('rina', 'Planner');
  await account('yusuf', 'System_Admin');
  await account('gone', 'Supervisor', false);
});

beforeEach(async () => {
  await testPool().query(
    `DELETE FROM app_settings WHERE setting_key IN ('planner_approval_kinds', 'planner_approval_until')`,
  );
  await testPool().query('DELETE FROM notification_deliveries');
  await testPool().query('DELETE FROM notifications');
});

afterAll(async () => {
  await app.close();
});

describe('Planner approval switch notices (REQ-NTF-005, DEC-118, DEC-125)', () => {
  it('REQ-NTF-005 on, changed and off reach every active Supervisor and GM, as kind Approval with no link', async () => {
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_creation'],
      until: null,
      reason: 'Supervisor on leave',
    });
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_creation', 'spk_amendment'],
      until: null,
      reason: 'Amendments too',
    });
    await call('am', 'POST', '/planner-approval/switch-off', { reason: 'Back from leave' });

    const expected = [
      PLANNER_SWITCH_TITLES.switch_off,
      PLANNER_SWITCH_TITLES.change,
      PLANNER_SWITCH_TITLES.switch_on,
    ];
    for (const who of ['budi', 'sari', 'hendra']) expect(await titles(who), who).toEqual(expected);
    for (const who of ['rina', 'yusuf', 'am']) expect(await titles(who), who).toEqual([]);
    const { rows } = await testPool().query<{ n: string }>(
      'SELECT count(*)::text AS n FROM notifications WHERE user_id = $1',
      [ids.get('gone')],
    );
    expect(rows[0]?.n).toBe('0');

    const on = (await list('budi')).notifications.at(-1);
    expect(on).toMatchObject({ kind: 'Approval', link: null, read: false });
    expect(on?.body).toContain('SPK creation');
    expect(on?.body).toContain('Supervisor on leave');
  });

  it('DEC-125 the InApp delivery is written Sent with the notice; the ended switch gives one notice per user', async () => {
    const until = new Date(clock.now().getTime() + 60_000);
    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_completion'],
      until: until.toISOString(),
      reason: 'One minute',
    });
    clock.advanceMinutes(1);
    const service = app.get(PlannerApprovalService);
    await service.endIfDue();
    await service.endIfDue();
    expect(await titles('hendra')).toEqual([
      PLANNER_SWITCH_TITLES.end,
      PLANNER_SWITCH_TITLES.switch_on,
    ]);

    const { rows } = await testPool().query<{ channel: string; status: string; sent: boolean }>(
      `SELECT d.channel, d.status, d.sent_at IS NOT NULL AS sent FROM notification_deliveries d
       JOIN notifications n ON n.id = d.notification_id WHERE n.user_id = $1`,
      [ids.get('hendra')],
    );
    expect(rows).toEqual([
      { channel: 'InApp', status: 'Sent', sent: true },
      { channel: 'InApp', status: 'Sent', sent: true },
    ]);
  });

  it('DEC-125 the same event written twice gives each recipient one notice', async () => {
    const notice = {
      kind: 'Approval' as const,
      title: 'Same event',
      body: null,
      linkRecord: null,
      dedupeKey: 'test:same-event',
    };
    const budi = ids.get('budi') as number;
    await unitOfWork().run(({ notifications }) => notifications.send([budi], notice));
    await unitOfWork().run(({ notifications }) => notifications.send([budi], notice));
    expect(await titles('budi')).toEqual(['Same event']);
  });
});

describe('NotificationCenter (REQ-NTF-001, C-03)', () => {
  it('REQ-NTF-001 lists the own notices newest first with unread counts per tab; read one, read all', async () => {
    const rina = ids.get('rina') as number;
    const send = (kind: NotificationKind, title: string) =>
      unitOfWork().run(({ notifications }) =>
        notifications.send([rina], {
          kind,
          title,
          body: null,
          linkRecord: kind === 'Step' ? '/vehicles/1' : null,
          dedupeKey: `test:${title}`,
        }),
      );
    await send('Approval', 'SPK waits for approval');
    await send('Change_Request', 'Change request raised');
    await send('Step', 'Step opened');
    await send('Alert', 'KIR expires');

    const page = await list('rina');
    expect(page.notifications.map((n) => n.title)).toEqual([
      'KIR expires',
      'Step opened',
      'Change request raised',
      'SPK waits for approval',
    ]);
    expect(page.notifications[1]?.link).toBe('/vehicles/1');
    expect(page.unread).toEqual({ all: 4, approvals: 2, steps: 1, alerts: 1, schedule: 0 });
    expect(await json(await call('rina', 'GET', '/notifications/unread-count'))).toEqual({
      unread: 4,
    });
    expect(await titles('budi')).toEqual([]);

    const step = page.notifications[1]?.id as number;
    expect((await call('budi', 'POST', `/notifications/${step}/read`)).status).toBe(404);
    expect((await call('rina', 'POST', `/notifications/${step}/read`)).status).toBe(200);
    const after = await list('rina');
    expect(after.notifications.find((n) => n.id === step)?.read).toBe(true);
    expect(after.unread).toEqual({ all: 3, approvals: 2, steps: 0, alerts: 1, schedule: 0 });

    expect((await call('rina', 'POST', '/notifications/read-all')).status).toBe(200);
    expect((await list('rina')).unread.all).toBe(0);
    expect(await json(await call('rina', 'GET', '/notifications/unread-count'))).toEqual({
      unread: 0,
    });
  });

  it('needs a signed-in session', async () => {
    expect((await fetch(`${baseUrl}/notifications`)).status).toBe(401);
  });
});
