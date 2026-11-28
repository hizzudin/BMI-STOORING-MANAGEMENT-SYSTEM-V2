import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, SpkDetailResponse, SpkListResponse, SpkResponse } from '@bmi/shared';
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

// TASK-123: FLW-PLN-03 at the API (REQ-SPK-007, AC-SPK-005, T5, T6, DQ-06, DEC-101, DEC-129).

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-16 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
const names = new Map<string, string>();
let vehicleId = 0;
let sequence = 0;

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  ids.set(key, created.id);
  const { rows } = await testPool().query<{ name: string }>(
    'SELECT name FROM users WHERE id = $1',
    [created.id],
  );
  names.set(key, rows[0]?.name ?? '');
  const response = await postJson(baseUrl, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
}

const auth = (who: string) => ({ authorization: `Bearer ${tokens.get(who)}` });
const json = async <T>(response: Response) => (await response.json()) as T;

function get(who: string, path: string, query: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  url.search = new URLSearchParams(query).toString();
  return fetch(url, { headers: auth(who) });
}

function send(
  who: string,
  method: 'POST' | 'PATCH',
  path: string,
  body: unknown,
  key?: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...auth(who),
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  });
}

const cancel = (who: string, spkId: number, body: unknown, key = `cancel-${(sequence += 1)}`) =>
  send(who, 'POST', `/spks/${spkId}/cancel`, body, key);

async function spkOf(who: string, spkId: number) {
  const response = await get(who, `/spks/${spkId}`);
  expect(response.status).toBe(200);
  return (await json<SpkResponse>(response)).spk;
}

/** An SPK written straight to the table; DEC-126: no composer yet, so the test writes the steps. */
async function insertSpk(status: string, creator: string): Promise<number> {
  sequence += 1;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       created_by)
     VALUES ($1, $2, 'Clutch replacement', 'Corrective', 'Manual_Planner', 'Kopling selip.', 'Draft', $3)
     RETURNING id`,
    [`SPK-261116${String(sequence).padStart(4, '0')}`, vehicleId, ids.get(creator)],
  );
  const spkId = Number(rows[0]?.id);
  await testPool().query(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status)
     VALUES ($1, 1, 'Test_Step', '{Warehouse_Manager}', 'Planner', 'Locked')`,
    [spkId],
  );
  // DEC-145: the steps are written while Draft, then the SPK takes the status under test.
  await testPool().query(`UPDATE spks SET status = $2 WHERE id = $1`, [spkId, status]);
  return spkId;
}

/** T4 as TASK-122 leaves it: Submit by the creator, then Reject by the Supervisor with a reason. */
async function rejectedSpk(creator: string): Promise<number> {
  const spkId = await insertSpk('Rejected', creator);
  await testPool().query(
    `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, acted_at, note)
     VALUES ($1, 'Creation', 'Submit', $2, 'Planner', now() - interval '2 hours', NULL),
            ($1, 'Creation', 'Reject', $3, 'Supervisor', now() - interval '1 hour', 'Wrong vehicle')`,
    [spkId, ids.get(creator), ids.get('budi')],
  );
  return spkId;
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
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('rina', 'Planner');
  await account('dewi', 'Planner');
  await account('budi', 'Supervisor');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('L_REJ', 'L_REJ', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('C_REJ', 'Trailer tail', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 7710 TR', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  vehicleId = Number(vehicle[0]?.id);
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Test_Step', 'Stock', 'TestStep', '{Warehouse_Manager}', '{}', '{}', 'None')`,
  );
});

afterAll(async () => {
  await app.close();
});

describe('FLW-PLN-03 Rejected SPK (REQ-SPK-007, DEC-101, DEC-129)', () => {
  it("AC-SPK-005 the rejected SPK is in its creator's Rejected tab, waiting on the creator, with the reason in its detail", async () => {
    const spkId = await rejectedSpk('rina');
    const tab = await json<SpkListResponse>(await get('rina', '/spks', { tab: 'rejected' }));
    const row = tab.items.find((item) => item.id === spkId);
    expect(row?.status).toBe('Rejected');
    // DEC-129: SPKRejected now shows the reason, so Waiting on is the creator again.
    expect(row?.waitingOn).toBe(`Planner ${names.get('rina')}`);
    const detail = await json<SpkDetailResponse>(await get('rina', `/spks/${spkId}/detail`));
    expect(detail.detail.approvals.at(-1)).toMatchObject({
      action: 'Reject',
      note: 'Wrong vehicle',
      by: { role: 'Supervisor' },
    });
  });

  it('T5 the creator edits the rejected SPK and submits it again: Pending approval, a second Submit, Approvers notified', async () => {
    const spkId = await rejectedSpk('rina');
    const before = await spkOf('rina', spkId);
    const saved = await send('rina', 'PATCH', `/spks/${spkId}`, {
      vehicleId,
      title: 'Clutch replacement, both sides',
      category: 'Corrective',
      priority: 'High',
      requiresDowntime: true,
      description: 'Kopling selip di tanjakan.',
      version: before.version,
    });
    expect(saved.status).toBe(200);
    const edited = (await json<SpkResponse>(saved)).spk;
    expect(edited.status).toBe('Rejected');
    const submitted = await send('rina', 'POST', `/spks/${spkId}/submit`, {
      version: edited.version,
    });
    expect(submitted.status).toBe(200);
    expect((await json<SpkResponse>(submitted)).spk.status).toBe('Pending_Approval');
    const { rows } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM spk_approvals WHERE spk_id = $1 AND action = 'Submit'`,
      [spkId],
    );
    expect(rows[0]?.n).toBe('2');
    const { rows: notices } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND link_record = $2`,
      [ids.get('budi'), `/spk/${spkId}`],
    );
    expect(notices[0]?.n).toBe('1');
  });

  it('T6 the creator of a Rejected SPK may edit, submit and cancel it; nobody else may', async () => {
    const spkId = await rejectedSpk('rina');
    expect((await spkOf('rina', spkId)).allowedActions).toEqual(['edit', 'submit', 'cancel']);
    expect((await spkOf('dewi', spkId)).allowedActions).toEqual([]);
  });

  it('T6 the creator cancels its Rejected SPK with a reason: Cancelled, who and why, one audit record', async () => {
    const spkId = await rejectedSpk('rina');
    const { version } = await spkOf('rina', spkId);
    const response = await cancel('rina', spkId, { version, reason: '  Raised twice  ' });
    expect(response.status).toBe(200);
    const after = (await json<SpkResponse>(response)).spk;
    expect(after.status).toBe('Cancelled');
    expect(after.allowedActions).toEqual([]);
    // §9.6 keeps who and why; when is in audit_logs (no cancelled_at column).
    const { rows } = await testPool().query<{ cancel_reason: string; cancelled_by: string }>(
      `SELECT cancel_reason, cancelled_by::text FROM spks WHERE id = $1`,
      [spkId],
    );
    expect(rows[0]).toEqual({
      cancel_reason: 'Raised twice',
      cancelled_by: String(ids.get('rina')),
    });
    const { rows: audit } = await testPool().query<{ reason: string }>(
      `SELECT reason FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND action = 'cancel'`,
      [spkId],
    );
    expect(audit).toEqual([{ reason: 'Raised twice' }]);
    // DEC-129: nobody is notified of a creator's cancel.
    const { rows: notices } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notifications WHERE link_record = $1`,
      [`/spk/${spkId}`],
    );
    expect(notices[0]?.n).toBe('0');
    const tab = await json<SpkListResponse>(await get('rina', '/spks', { tab: 'cancelled' }));
    expect(tab.items.map((item) => item.id)).toContain(spkId);
  });

  it('T6 the creator cancels its Draft too', async () => {
    const spkId = await insertSpk('Draft', 'rina');
    const { version } = await spkOf('rina', spkId);
    const response = await cancel('rina', spkId, { version, reason: 'Not needed' });
    expect(response.status).toBe(200);
    expect((await json<SpkResponse>(response)).spk.status).toBe('Cancelled');
  });

  it('T6 a cancel without a reason is refused', async () => {
    const spkId = await rejectedSpk('rina');
    const { version } = await spkOf('rina', spkId);
    expect((await cancel('rina', spkId, { version, reason: '   ' })).status).toBe(400);
    expect((await cancel('rina', spkId, { version })).status).toBe(400);
    expect((await spkOf('rina', spkId)).status).toBe('Rejected');
  });

  it('DQ-06 T6 another Planner, the rejector and an Active SPK are refused', async () => {
    const spkId = await rejectedSpk('rina');
    const { version } = await spkOf('rina', spkId);
    const other = await cancel('dewi', spkId, { version, reason: 'Mine now' });
    expect(other.status).toBe(403);
    expect(((await other.json()) as { message: string }).message).toBe(
      'Only the creator of this SPK can cancel it.',
    );
    // The Supervisor who rejected it holds no spk.create: the rejection cannot be reverted.
    expect((await cancel('budi', spkId, { version, reason: 'Undo' })).status).toBe(403);
    const active = await insertSpk('Active', 'rina');
    const activeVersion = (await spkOf('rina', active)).version;
    const refused = await cancel('rina', active, { version: activeVersion, reason: 'Too late' });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toBe(
      'Only a Draft or Rejected SPK can be cancelled by its creator.',
    );
  });

  it('NFR-03 a cancel at a stale version is refused', async () => {
    const spkId = await rejectedSpk('rina');
    const { version } = await spkOf('rina', spkId);
    expect((await cancel('rina', spkId, { version: version + 1, reason: 'Late' })).status).toBe(
      409,
    );
  });

  it('NFR-01 TX-22 a retried cancel with the same key replays the answer and writes one audit record', async () => {
    const spkId = await rejectedSpk('rina');
    const { version } = await spkOf('rina', spkId);
    const first = await cancel('rina', spkId, { version, reason: 'Raised twice' }, 'same-key');
    const second = await cancel('rina', spkId, { version, reason: 'Raised twice' }, 'same-key');
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    const { rows } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND action = 'cancel'`,
      [spkId],
    );
    expect(rows[0]?.n).toBe('1');
  });
});
