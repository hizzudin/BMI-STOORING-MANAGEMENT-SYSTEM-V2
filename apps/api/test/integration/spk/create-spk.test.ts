import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, Spk, SpkFormOptionsResponse } from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
} from '../../../src/app.tokens.js';
import { SPK_MESSAGES } from '../../../src/core/spk/spk-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

const SEED_FORMATS = /INSERT INTO app_settings[\s\S]*?;/.exec(
  readFileSync(join(import.meta.dirname, '../../../migrations/0009_spks.sql'), 'utf8'),
)?.[0];

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-12 08:00');
let app: INestApplication;
let baseUrl: string;
let auditFrom = 0;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
let active = 0;
let inactive = 0;

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

function call(who: string, method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${tokens.get(who)}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const json = async <T>(response: Response) => (await response.json()) as T;
const message = async (response: Response) => (await json<{ message: string }>(response)).message;

const fields = (overrides: Record<string, unknown> = {}) => ({
  vehicleId: active,
  title: 'PM 20.000 km',
  category: 'PM',
  priority: 'Normal',
  requiresDowntime: true,
  description: 'Service per PM package TH-20K.',
  ...overrides,
});

async function create(who: string, overrides: Record<string, unknown> = {}): Promise<Spk> {
  const response = await call(who, 'POST', '/spks', fields(overrides));
  expect(response.status).toBe(201);
  return (await json<{ spk: Spk }>(response)).spk;
}

async function insertVehicle(plate: string, status: string): Promise<number> {
  const code = plate.replace(/\W/g, '');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ($1, $1, '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
    [`L_${code}`],
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ($1, 'Tractor head', $2) RETURNING id`,
    [`C_${code}`, layout[0]?.id],
  );
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, status)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [plate, klass[0]?.id, layout[0]?.id, status],
  );
  return Number(rows[0]?.id);
}

/** DEC-126: the composer comes with TASK-207; until then a test writes the step itself. */
async function addStep(spkId: number): Promise<void> {
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Test_Step', 'Test step', 'TestStep', '{Mechanic}', '{}', '{}', 'None')
     ON CONFLICT (code) DO NOTHING`,
  );
  await testPool().query(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role)
     VALUES ($1, 1, 'Test_Step', '{Mechanic}', 'Planner')`,
    [spkId],
  );
}

async function audits(spkId: number): Promise<string[]> {
  const { rows } = await testPool().query<{ action: string }>(
    `SELECT action FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND id > $2 ORDER BY id`,
    [spkId, auditFrom],
  );
  return rows.map((row) => row.action);
}

async function notices(who: string): Promise<string[]> {
  const { rows } = await testPool().query<{ title: string }>(
    'SELECT title FROM notifications WHERE user_id = $1 ORDER BY id',
    [ids.get(who)],
  );
  return rows.map((row) => row.title);
}

beforeAll(async () => {
  if (!SEED_FORMATS) throw new Error('migration 0009 has no INSERT of numbering_formats');
  await seedRolePermissions();
  await testPool().query(SEED_FORMATS);
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
  await account('yusuf', 'System_Admin');
  await account('budi', 'Supervisor');
  await account('hendra', 'GM');
  await account('andi', 'Mechanic');
  await account('am', 'Access_Manager');
  active = await insertVehicle('B 9012 KX', 'Active');
  inactive = await insertVehicle('B 3300 ZZ', 'Inactive');
});

beforeEach(async () => {
  const { rows } = await testPool().query<{ last: string | null }>(
    'SELECT max(id)::text AS last FROM audit_logs',
  );
  auditFrom = Number(rows[0]?.last ?? 0);
  await testPool().query('DELETE FROM notification_deliveries');
  await testPool().query('DELETE FROM notifications');
  await testPool().query(
    `DELETE FROM app_settings WHERE setting_key IN ('planner_approval_kinds', 'planner_approval_until')`,
  );
});

afterAll(async () => {
  await app.close();
});

describe('Create SPK (REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015, DEC-126)', () => {
  it('REQ-SPK-001 a Planner saves a Draft with a number and the source Manual_Planner; one audit record', async () => {
    const spk = await create('rina', { priority: 'High', requiresDowntime: false });
    expect(spk).toMatchObject({
      vehicle: { id: active, licensePlate: 'B 9012 KX', className: 'Tractor head' },
      title: 'PM 20.000 km',
      category: 'PM',
      priority: 'High',
      requiresDowntime: false,
      requestSource: 'Manual_Planner',
      status: 'Draft',
      stepCount: 0,
      version: 1,
      allowedActions: ['edit', 'submit'],
    });
    expect(spk.spkNumber).toMatch(/^SPK-261112\d{4,}$/);
    expect(await audits(spk.id)).toEqual(['create']);
  });

  it('REQ-SPK-002 the System Admin creates with the source Manual_Admin; a Mechanic cannot create', async () => {
    expect((await create('yusuf')).requestSource).toBe('Manual_Admin');
    expect((await call('andi', 'POST', '/spks', fields())).status).toBe(403);
  });

  it('REQ-SPK-013 an Inactive vehicle is refused and not offered', async () => {
    const refused = await call('rina', 'POST', '/spks', fields({ vehicleId: inactive }));
    expect(refused.status).toBe(400);
    expect(await message(refused)).toBe(SPK_MESSAGES.inactiveVehicle);
    const options = await json<SpkFormOptionsResponse>(await call('rina', 'GET', '/spks/options'));
    expect(options.vehicles.map((v) => v.licensePlate)).toEqual(['B 9012 KX']);
    expect(options.allowedActions).toEqual(['create']);
    expect((await call('andi', 'GET', '/spks/options')).status).toBe(403);
  });

  it('C-15 Save draft keeps editing the draft with its version; only the creator edits it', async () => {
    const spk = await create('rina');
    const update = { ...fields({ title: 'PM 20.000 km and brakes' }), version: spk.version };
    const saved = await call('rina', 'PATCH', `/spks/${spk.id}`, update);
    expect(saved.status).toBe(200);
    expect((await json<{ spk: Spk }>(saved)).spk).toMatchObject({
      title: 'PM 20.000 km and brakes',
      version: 2,
    });
    expect((await call('rina', 'PATCH', `/spks/${spk.id}`, update)).status).toBe(409);
    const other = await call('dewi', 'PATCH', `/spks/${spk.id}`, { ...update, version: 2 });
    expect(other.status).toBe(403);
    expect(await message(other)).toBe(SPK_MESSAGES.onlyCreator);
    const shown = await json<{ spk: Spk }>(await call('dewi', 'GET', `/spks/${spk.id}`));
    expect(shown.spk.allowedActions).toEqual([]);
    expect((await call('rina', 'GET', '/spks/999999')).status).toBe(404);
    expect(await audits(spk.id)).toEqual(['create', 'update']);
  });

  it('DEC-126 Submit is refused while the SPK has no step', async () => {
    const spk = await create('rina');
    const refused = await call('rina', 'POST', `/spks/${spk.id}/submit`, {
      version: spk.version,
    });
    expect(refused.status).toBe(403);
    expect(await message(refused)).toBe(SPK_MESSAGES.noStep);
  });

  it('REQ-NTF-005 T2 Submit: Pending approval, one Submit row, the Approvers notified; Planners only while the switch covers creation', async () => {
    const spk = await create('rina');
    await addStep(spk.id);
    const response = await call('rina', 'POST', `/spks/${spk.id}/submit`, {
      version: spk.version,
    });
    expect(response.status).toBe(200);
    expect((await json<{ spk: Spk }>(response)).spk).toMatchObject({
      status: 'Pending_Approval',
      stepCount: 1,
      allowedActions: [],
    });
    const { rows } = await testPool().query(
      `SELECT stage, action, approver_role FROM spk_approvals WHERE spk_id = $1`,
      [spk.id],
    );
    expect(rows).toEqual([{ stage: 'Creation', action: 'Submit', approver_role: 'Planner' }]);
    const title = `${spk.spkNumber} waits for your approval`;
    for (const who of ['budi', 'hendra', 'yusuf']) expect(await notices(who), who).toEqual([title]);
    for (const who of ['rina', 'dewi', 'andi', 'am']) expect(await notices(who), who).toEqual([]);
    expect(await audits(spk.id)).toEqual(['create', 'submit']);
    const late = await call('rina', 'PATCH', `/spks/${spk.id}`, { ...fields(), version: 2 });
    expect(late.status).toBe(403);

    await call('am', 'PUT', '/planner-approval', {
      kinds: ['spk_creation'],
      until: null,
      reason: 'Supervisor on leave',
    });
    const covered = await create('rina', { priority: 'Urgent' });
    await addStep(covered.id);
    await call('rina', 'POST', `/spks/${covered.id}/submit`, { version: covered.version });
    expect(await notices('dewi')).toContain(`${covered.spkNumber} waits for your approval`);
  });

  it('REQ-SPK-015 the urgency is Low, Normal, High or Urgent; title, category and description are required', async () => {
    expect((await call('rina', 'POST', '/spks', fields({ priority: 'Critical' }))).status).toBe(
      400,
    );
    const empty = await call('rina', 'POST', '/spks', fields({ title: ' ' }));
    expect(empty.status).toBe(400);
    expect((await json<{ issues: { message: string }[] }>(empty)).issues[0]?.message).toBe(
      'Enter a title.',
    );
    expect((await call('rina', 'POST', '/spks', fields({ description: '' }))).status).toBe(400);
  });
});
