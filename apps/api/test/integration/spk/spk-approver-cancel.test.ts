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

// TASK-124: FLW-APR-05 at the API (REQ-SPK-008, T15, TX-14, DEC-140), next to T6 (spk-cancel.test.ts).

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-27 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
let vehicleId = 0;
let sequence = 0;
let keys = 0;

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
  ids.set(key, created.id);
  const response = await postJson(baseUrl, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
}

const auth = (who: string) => ({ authorization: `Bearer ${tokens.get(who)}` });
const json = async <T>(response: Response) => (await response.json()) as T;
const messageOf = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

function get(who: string, path: string, query: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  url.search = new URLSearchParams(query).toString();
  return fetch(url, { headers: auth(who) });
}

const approverCancel = (
  who: string,
  spkId: number,
  body: unknown,
  key = `approver-cancel-${(keys += 1)}`,
) =>
  fetch(`${baseUrl}/spks/${spkId}/approver-cancel`, {
    method: 'POST',
    headers: { ...auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });

async function spkOf(who: string, spkId: number) {
  const response = await get(who, `/spks/${spkId}`);
  expect(response.status).toBe(200);
  return (await json<SpkResponse>(response)).spk;
}

/** An SPK written straight to the table (no composer yet, DEC-126); the Planner rina made it. */
async function insertSpk(status: string, creator = 'rina'): Promise<number> {
  sequence += 1;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       created_by)
     VALUES ($1, $2, 'Brake check', 'Corrective', 'Manual_Planner', 'Rem blong.', 'Draft', $3)
     RETURNING id`,
    [`SPK-261127${String(sequence).padStart(4, '0')}`, vehicleId, ids.get(creator)],
  );
  const spkId = Number(rows[0]?.id);
  await testPool().query(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status)
     VALUES ($1, 1, 'Cancel_Step', '{Warehouse_Manager}', 'Planner', 'Locked')`,
    [spkId],
  );
  // DEC-145: the steps are written while Draft, then the SPK takes the status under test.
  await testPool().query(`UPDATE spks SET status = $2 WHERE id = $1`, [spkId, status]);
  return spkId;
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await testPool().query<{ n: string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

async function setMode(mode: 'Setup' | 'Live'): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('system_mode', $1::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [JSON.stringify(mode)],
  );
}

beforeAll(async () => {
  await seedRolePermissions();
  await setMode('Live');
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
  await account('budi', 'Supervisor');
  await account('gita', 'GM');
  await account('yusuf', 'System_Admin');
  await account('andi', 'Warehouse_Manager');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('L_T15', 'L_T15', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('C_T15', 'Tractor head', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 1515 TC', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  vehicleId = Number(vehicle[0]?.id);
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Cancel_Step', 'Stock', 'TestStep', '{Warehouse_Manager}', '{}', '{}', 'None')`,
  );
});

afterAll(async () => {
  await setMode('Live');
  await app.close();
});

describe('FLW-APR-05 approver cancel (REQ-SPK-008, T15, TX-14, DEC-140)', () => {
  it.each(['budi', 'gita', 'yusuf'])(
    'REQ-SPK-008 T15 the Approver %s cancels a Pending_Approval SPK with a reason: Cancelled with who and why',
    async (who) => {
      const spkId = await insertSpk('Pending_Approval');
      const { version } = await spkOf(who, spkId);
      const response = await approverCancel(who, spkId, { version, reason: '  Vehicle sold  ' });
      expect(response.status).toBe(200);
      const after = (await json<SpkResponse>(response)).spk;
      expect(after.status).toBe('Cancelled');
      expect(after.allowedActions).toEqual([]);
      const { rows } = await testPool().query<{ cancel_reason: string; cancelled_by: string }>(
        `SELECT cancel_reason, cancelled_by::text FROM spks WHERE id = $1`,
        [spkId],
      );
      expect(rows[0]).toEqual({
        cancel_reason: 'Vehicle sold',
        cancelled_by: String(ids.get(who)),
      });
    },
  );

  it.each(['Draft', 'Rejected', 'Active', 'In_Progress'])(
    'DEC-140 an Approver cancels an SPK in %s',
    async (status) => {
      const spkId = await insertSpk(status);
      const { version } = await spkOf('budi', spkId);
      const response = await approverCancel('budi', spkId, { version, reason: 'Not needed' });
      expect(response.status).toBe(200);
      expect((await json<SpkResponse>(response)).spk.status).toBe('Cancelled');
    },
  );

  it('REQ-SPK-011 DEC-93 the SPK lists approverCancel for a Supervisor and not for a Planner', async () => {
    const spkId = await insertSpk('Pending_Approval');
    expect((await spkOf('budi', spkId)).allowedActions).toContain('approverCancel');
    expect((await spkOf('rina', spkId)).allowedActions).not.toContain('approverCancel');
    const detail = await json<SpkDetailResponse>(await get('budi', `/spks/${spkId}/detail`));
    expect(detail.detail.spk.allowedActions).toContain('approverCancel');
  });

  it('REQ-SPK-008 a cancel without a reason is refused and changes nothing', async () => {
    const spkId = await insertSpk('Pending_Approval');
    const { version } = await spkOf('budi', spkId);
    expect((await approverCancel('budi', spkId, { version, reason: '   ' })).status).toBe(400);
    expect((await approverCancel('budi', spkId, { version })).status).toBe(400);
    expect((await spkOf('budi', spkId)).status).toBe('Pending_Approval');
  });

  it('DEC-93 a Planner and a Warehouse Manager are refused with 403', async () => {
    const spkId = await insertSpk('Pending_Approval');
    const { version } = await spkOf('budi', spkId);
    expect((await approverCancel('rina', spkId, { version, reason: 'Mine' })).status).toBe(403);
    expect((await approverCancel('andi', spkId, { version, reason: 'Mine' })).status).toBe(403);
    expect((await spkOf('budi', spkId)).status).toBe('Pending_Approval');
  });

  it('REQ-SPK-008 an unknown SPK is 404', async () => {
    const response = await approverCancel('budi', 999_999, { version: 1, reason: 'Gone' });
    expect(response.status).toBe(404);
  });

  it.each(['Completed', 'Cancelled'])(
    'T15 a %s SPK is refused with one sentence',
    async (status) => {
      const spkId = await insertSpk('Draft');
      await testPool().query(
        `UPDATE spks SET status = $2, cancel_reason = 'Earlier' WHERE id = $1`,
        [spkId, status],
      );
      const { version } = await spkOf('budi', spkId);
      const refused = await approverCancel('budi', spkId, { version, reason: 'Again' });
      expect(refused.status).toBe(403);
      expect(await messageOf(refused)).toBe('This SPK is already Completed or Cancelled.');
    },
  );

  it('NFR-03 a cancel at a stale version is refused with 409', async () => {
    const spkId = await insertSpk('Pending_Approval');
    const { version } = await spkOf('budi', spkId);
    const stale = await approverCancel('budi', spkId, { version: version + 1, reason: 'Late' });
    expect(stale.status).toBe(409);
  });

  it('NFR-01 TX-22 a retried cancel with the same key replays the answer and writes everything once', async () => {
    const spkId = await insertSpk('Pending_Approval');
    const { version } = await spkOf('budi', spkId);
    const first = await approverCancel('budi', spkId, { version, reason: 'Twice' }, 'same-t15');
    const second = await approverCancel('budi', spkId, { version, reason: 'Twice' }, 'same-t15');
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    expect(
      await count(
        `SELECT count(*)::text AS n FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND action = 'approver_cancel'`,
        [spkId],
      ),
    ).toBe(1);
    expect(
      await count(
        `SELECT count(*)::text AS n FROM spk_approvals WHERE spk_id = $1 AND action = 'Cancel'`,
        [spkId],
      ),
    ).toBe(1);
    expect(
      await count(`SELECT count(*)::text AS n FROM notifications WHERE link_record = $1`, [
        `/spk/${spkId}`,
      ]),
    ).toBe(1);
  });

  it('NFR-02 DEC-140 one audit record with before, after and the reason; one Cancel row; the creator has one Approval notice', async () => {
    const spkId = await insertSpk('Active');
    const { version, spkNumber } = await spkOf('budi', spkId);
    const response = await approverCancel('budi', spkId, { version, reason: 'Vehicle sold' });
    expect(response.status).toBe(200);
    const { rows: audit } = await testPool().query<{
      reason: string;
      self_decision: boolean;
      before: { status: string };
      after: { status: string };
    }>(
      `SELECT reason, self_decision, before, after FROM audit_logs
       WHERE entity = 'spk' AND entity_id = $1 AND action = 'approver_cancel'`,
      [spkId],
    );
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      reason: 'Vehicle sold',
      self_decision: false,
      before: { status: 'Active' },
      after: { status: 'Cancelled' },
    });
    const detail = await json<SpkDetailResponse>(await get('budi', `/spks/${spkId}/detail`));
    expect(detail.detail.approvals.at(-1)).toMatchObject({
      stage: 'Completion',
      action: 'Cancel',
      note: 'Vehicle sold',
      by: { role: 'Supervisor' },
    });
    const { rows: notices } = await testPool().query<{
      user_id: string;
      kind: string;
      title: string;
      body: string;
    }>(`SELECT user_id::text, kind, title, body FROM notifications WHERE link_record = $1`, [
      `/spk/${spkId}`,
    ]);
    expect(notices).toEqual([
      {
        user_id: String(ids.get('rina')),
        kind: 'Approval',
        title: `${spkNumber} was cancelled`,
        body: 'Vehicle sold',
      },
    ]);
  });

  it('REQ-SPK-010 the cancelled SPK is in the Cancelled tab of SPKList', async () => {
    const spkId = await insertSpk('Pending_Approval');
    const { version } = await spkOf('budi', spkId);
    await approverCancel('budi', spkId, { version, reason: 'Duplicate' });
    const tab = await json<SpkListResponse>(await get('budi', '/spks', { tab: 'cancelled' }));
    expect(tab.items.map((item) => item.id)).toContain(spkId);
  });

  // Last: it switches the system to Setup mode, where only the System Admin may work (DEC-56).
  it('DEC-133 the System Admin cancels its own SPK in Setup mode; the audit record is not a self-decision', async () => {
    const spkId = await insertSpk('Draft', 'yusuf');
    await setMode('Setup');
    const { version } = await spkOf('yusuf', spkId);
    const response = await approverCancel('yusuf', spkId, { version, reason: 'Set up again' });
    expect(response.status).toBe(200);
    const { rows } = await testPool().query<{ self_decision: boolean }>(
      `SELECT self_decision FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND action = 'approver_cancel'`,
      [spkId],
    );
    expect(rows).toEqual([{ self_decision: false }]);
    expect(
      await count(`SELECT count(*)::text AS n FROM notifications WHERE link_record = $1`, [
        `/spk/${spkId}`,
      ]),
    ).toBe(0);
    await setMode('Live');
  });
});
