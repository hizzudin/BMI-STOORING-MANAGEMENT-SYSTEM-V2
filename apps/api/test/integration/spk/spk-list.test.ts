import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, SpkDetailResponse, SpkListResponse } from '@bmi/shared';
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

const clock = FakeClock.atWib('2026-11-16 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
const names = new Map<string, string>();
const vehicles = new Map<string, number>();
const spkIds = new Map<string, number>();

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

function get(who: string, path: string, query: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  url.search = new URLSearchParams(query).toString();
  return fetch(url, { headers: { authorization: `Bearer ${tokens.get(who)}` } });
}

const json = async <T>(response: Response) => (await response.json()) as T;
const list = async (who: string, query: Record<string, string> = {}) => {
  const response = await get(who, '/spks', query);
  expect(response.status).toBe(200);
  return json<SpkListResponse>(response);
};
const numbers = (page: SpkListResponse) => page.items.map((item) => item.spkNumber);

async function insertVehicle(plate: string): Promise<number> {
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
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ($1, $2, $3, 48210) RETURNING id`,
    [plate, klass[0]?.id, layout[0]?.id],
  );
  return Number(rows[0]?.id);
}

/** A test SPK written straight to the table; created_at orders the newest first. */
async function insertSpk(
  key: string,
  values: {
    status: string;
    priority?: string;
    vehicle?: string;
    creator?: string;
    title?: string;
    category?: string;
    minutesAgo: number;
  },
): Promise<number> {
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       priority, created_by, cancel_reason, created_at)
     VALUES ($1, $2, $3, $4, 'Manual_Planner', 'Test', $5, $6, $7, $8, now() - make_interval(mins => $9))
     RETURNING id`,
    [
      key,
      vehicles.get(values.vehicle ?? 'kx'),
      values.title ?? `Work ${key}`,
      values.category ?? 'PM',
      values.status,
      values.priority ?? 'Normal',
      ids.get(values.creator ?? 'rina'),
      values.status === 'Cancelled' ? 'Raised twice' : null,
      values.minutesAgo,
    ],
  );
  const id = Number(rows[0]?.id);
  spkIds.set(key, id);
  return id;
}

/** One statement with `bmi.step_revision` on, in its own transaction (DEC-146, migration 0015). */
async function withStepRevision(sql: string, params: unknown[]): Promise<void> {
  const client = await testPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL bmi.step_revision = 'on'`);
    await client.query(sql, params);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** DEC-126: no composer yet, so the test writes the steps. */
async function insertStep(
  spk: string,
  sequenceNo: number,
  values: { status: string; executorRoles?: string; assignee?: string; verifier?: string },
): Promise<void> {
  // DEC-145: the SPK already holds its status; a fixture writes its steps through the named
  // exception of the freeze trigger, inside one transaction (migration 0015).
  await withStepRevision(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status,
       assigned_to, opened_at, submitted_at, verified_at, verified_by)
     VALUES ($1, $2, 'Test_Step', $3::role_t[], 'Planner', $4::asg_status_t, $5,
       CASE WHEN $4::asg_status_t <> 'Locked' THEN now() END,
       CASE WHEN $4::asg_status_t IN ('Submitted', 'Verified') THEN now() END,
       CASE WHEN $4::asg_status_t = 'Verified' THEN now() END, $6)`,
    [
      spkIds.get(spk),
      sequenceNo,
      values.executorRoles ?? '{Mechanic}',
      values.status,
      values.assignee ? ids.get(values.assignee) : null,
      values.verifier ? ids.get(values.verifier) : null,
    ],
  );
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
  await account('andi', 'Mechanic');
  await account('joko', 'Mechanic');
  await account('wati', 'Warehouse_Manager');
  await account('acc', 'Accounting');
  vehicles.set('kx', await insertVehicle('B 9012 KX'));
  vehicles.set('qa', await insertVehicle('B 4410 QA'));
  await insertVehicle('B 7777 NO');
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Test_Step', 'Test step', 'TestStep', '{Mechanic}', '{}', '{}', 'None')`,
  );

  // One SPK per status (REQ-SPK-010 tabs), newest last in this list.
  await insertSpk('SPK-T-DRAFT', { status: 'Draft', minutesAgo: 1 });
  await insertSpk('SPK-T-PENDING', { status: 'Pending_Approval', minutesAgo: 2, vehicle: 'qa' });
  await insertSpk('SPK-T-REJECTED', { status: 'Rejected', minutesAgo: 3, creator: 'dewi' });
  await insertSpk('SPK-T-ACTIVE', {
    status: 'Active',
    minutesAgo: 4,
    priority: 'Low',
    category: 'Tyre',
    vehicle: 'qa',
  });
  await insertSpk('SPK-T-PROGRESS', {
    status: 'In_Progress',
    minutesAgo: 5,
    priority: 'High',
    title: 'Brake overhaul',
  });
  await insertSpk('SPK-T-VERIFY', { status: 'Pending_Verification', minutesAgo: 6 });
  await insertSpk('SPK-T-AMEND', {
    status: 'Pending_Amendment',
    minutesAgo: 7,
    priority: 'Urgent',
  });
  await insertSpk('SPK-T-DONE', { status: 'Completed', minutesAgo: 8 });
  await insertSpk('SPK-T-CANCEL', { status: 'Cancelled', minutesAgo: 9 });

  // Steps: In_Progress waits on Andi (step 2 assigned); Active waits on any Warehouse Manager.
  await insertStep('SPK-T-PROGRESS', 1, { status: 'Verified', verifier: 'rina' });
  await insertStep('SPK-T-PROGRESS', 2, { status: 'Open', assignee: 'andi' });
  await insertStep('SPK-T-PROGRESS', 3, { status: 'Locked' });
  await insertStep('SPK-T-ACTIVE', 1, { status: 'Open', executorRoles: '{Warehouse_Manager}' });
  await insertStep('SPK-T-VERIFY', 1, { status: 'Submitted', assignee: 'joko' });
  await testPool().query(
    `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, acted_at)
     VALUES ($1, 'Creation', 'Submit', $2, 'Planner', now() - interval '2 minutes')`,
    [spkIds.get('SPK-T-PENDING'), ids.get('rina')],
  );
});

afterAll(async () => {
  await app.close();
});

describe('SPKList (REQ-SPK-010, REQ-SPK-015, DEC-127)', () => {
  it('REQ-SPK-010 each tab lists its statuses, with the count of every tab', async () => {
    const active = await list('rina');
    expect(active.tabCounts).toEqual({
      active: 4,
      mine: 0,
      draft: 1,
      pending: 1,
      rejected: 1,
      completed: 1,
      cancelled: 1,
      all: 9,
    });
    expect(numbers(await list('rina', { tab: 'draft' }))).toEqual(['SPK-T-DRAFT']);
    expect(numbers(await list('rina', { tab: 'cancelled' }))).toEqual(['SPK-T-CANCEL']);
    expect((await list('rina', { tab: 'all' })).items).toHaveLength(9);
  });

  it('REQ-SPK-015 Urgent and High sort first, then Normal and Low; newest first within each', async () => {
    expect(numbers(await list('rina'))).toEqual([
      'SPK-T-AMEND',
      'SPK-T-PROGRESS',
      'SPK-T-VERIFY',
      'SPK-T-ACTIVE',
    ]);
  });

  it('REQ-SPK-010 search (number, title or plate, any case), type and vehicle filter rows and counts', async () => {
    const byPlate = await list('rina', { tab: 'all', search: '4410 qa' });
    expect(numbers(byPlate)).toEqual(['SPK-T-PENDING', 'SPK-T-ACTIVE']);
    expect(byPlate.tabCounts).toMatchObject({ all: 2, active: 1, pending: 1, draft: 0 });
    expect(numbers(await list('rina', { tab: 'all', search: 'brake' }))).toEqual([
      'SPK-T-PROGRESS',
    ]);
    expect(numbers(await list('rina', { tab: 'all', search: 't-done' }))).toEqual(['SPK-T-DONE']);
    expect(numbers(await list('rina', { tab: 'all', type: 'Tyre' }))).toEqual(['SPK-T-ACTIVE']);
    const byVehicle = await list('rina', { tab: 'all', vehicleId: String(vehicles.get('qa')) });
    expect(numbers(byVehicle)).toEqual(['SPK-T-PENDING', 'SPK-T-ACTIVE']);
    // The vehicle filter offers the vehicles that have an SPK.
    expect(byVehicle.vehicles.map((v) => v.licensePlate)).toEqual(['B 4410 QA', 'B 9012 KX']);
  });

  it('DEC-127 pages of the chosen size; a page past the end is empty; no rows is page 1 of 1', async () => {
    const none = await list('rina', { tab: 'all', search: 'no such spk' });
    expect(none.items).toEqual([]);
    expect(none.pagination).toEqual({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
    expect((await get('rina', '/spks', { pageSize: '25' })).status).toBe(400);

    // Three older Normal SPKs make twelve: page 2 of 10 holds the oldest Normal and the Low one
    // (urgency sorts before age, REQ-SPK-015).
    for (const n of [1, 2, 3]) {
      await insertSpk(`SPK-T-OLD-${n}`, { status: 'Completed', minutesAgo: 100 + n });
    }
    const first = await list('rina', { tab: 'all', pageSize: '10' });
    expect(first.items).toHaveLength(10);
    expect(first.pagination).toEqual({ page: 1, pageSize: 10, total: 12, totalPages: 2 });
    const second = await list('rina', { tab: 'all', pageSize: '10', page: '2' });
    expect(numbers(second)).toEqual(['SPK-T-OLD-3', 'SPK-T-ACTIVE']);
    const past = await list('rina', { tab: 'all', pageSize: '10', page: '3' });
    expect(past.items).toEqual([]);
    expect(past.pagination).toEqual({ page: 3, pageSize: 10, total: 12, totalPages: 2 });
  });

  it('REQ-SPK-010 My steps: open steps assigned to the user, or unassigned for one of its roles', async () => {
    const andi = await list('andi', { tab: 'mine' });
    expect(numbers(andi)).toEqual(['SPK-T-PROGRESS']);
    expect(andi.tabCounts.mine).toBe(1);
    // Joko is a Mechanic too, but step 2 is assigned to Andi; his own step is Submitted, not open.
    expect(numbers(await list('joko', { tab: 'mine' }))).toEqual([]);
    expect(numbers(await list('wati', { tab: 'mine' }))).toEqual(['SPK-T-ACTIVE']);
    expect(numbers(await list('rina', { tab: 'mine' }))).toEqual([]);
  });

  it('REQ-SPK-010 current step and waiting on follow the status and the open step', async () => {
    const all = await list('rina', { tab: 'all' });
    const row = (key: string) => all.items.find((item) => item.spkNumber === key);
    expect(row('SPK-T-PROGRESS')).toMatchObject({
      currentStep: { sequenceNo: 2, name: 'Test step', status: 'Open' },
      waitingOn: `Mechanic ${names.get('andi')}`,
    });
    expect(row('SPK-T-ACTIVE')).toMatchObject({
      currentStep: { sequenceNo: 1, status: 'Open' },
      waitingOn: 'Warehouse Manager',
    });
    expect(row('SPK-T-VERIFY')).toMatchObject({
      currentStep: { sequenceNo: 1, status: 'Submitted' },
      waitingOn: 'Planner',
    });
    expect(row('SPK-T-DRAFT')).toMatchObject({
      currentStep: null,
      waitingOn: `Planner ${names.get('rina')}`,
    });
    expect(row('SPK-T-REJECTED')?.waitingOn).toBe(`Planner ${names.get('dewi')}`);
    expect(row('SPK-T-PENDING')?.waitingOn).toBe('Approvers');
    expect(row('SPK-T-DONE')?.waitingOn).toBeNull();
    expect(row('SPK-T-CANCEL')?.waitingOn).toBeNull();
  });

  it('DEC-127 each row carries its allowedActions; the page offers Create only with spk.create', async () => {
    const rina = await list('rina', { tab: 'all' });
    expect(rina.allowedActions).toEqual(['create']);
    expect(rina.items.find((i) => i.spkNumber === 'SPK-T-DRAFT')?.allowedActions).toEqual([
      'edit',
      'submit',
      'cancel',
    ]);
    expect(rina.items.find((i) => i.spkNumber === 'SPK-T-REJECTED')?.allowedActions).toEqual([]);
    const andi = await list('andi', { tab: 'all' });
    expect(andi.allowedActions).toEqual([]);
    expect(andi.items.every((item) => item.allowedActions.length === 0)).toBe(true);
    expect((await get('acc', '/spks')).status).toBe(403);
  });
});

describe('SPKDetail (REQ-SPK-011, DEC-127)', () => {
  it('REQ-SPK-011 the header, vehicle, creator, step cards, approval rows and costs', async () => {
    const response = await get('andi', `/spks/${spkIds.get('SPK-T-PROGRESS')}/detail`);
    expect(response.status).toBe(200);
    const { detail } = await json<SpkDetailResponse>(response);
    expect(detail.spk).toMatchObject({
      spkNumber: 'SPK-T-PROGRESS',
      title: 'Brake overhaul',
      status: 'In_Progress',
      priority: 'High',
      allowedActions: [],
    });
    expect(detail.vehicle).toMatchObject({
      licensePlate: 'B 9012 KX',
      className: 'Tractor head',
      unitKind: 'Powered',
      currentOdometer: 48210,
    });
    expect(detail.createdBy).toEqual({ name: names.get('rina'), role: 'Planner' });
    expect(detail.steps.map((s) => [s.sequenceNo, s.name, s.status])).toEqual([
      [1, 'Test step', 'Verified'],
      [2, 'Test step', 'Open'],
      [3, 'Test step', 'Locked'],
    ]);
    expect(detail.steps[0]?.verifiedBy).toEqual({ name: names.get('rina'), role: 'Planner' });
    expect(detail.steps[1]).toMatchObject({
      executorRoles: ['Mechanic'],
      assignee: { name: names.get('andi'), role: 'Mechanic' },
      submittedAt: null,
    });
    expect(detail.costs).toEqual({
      labor: '0.00',
      parts: '0.00',
      document: '0.00',
      stooring: '0.00',
      total: '0.00',
    });
  });

  it('REQ-SPK-011 the History rows come from spk_approvals; an unknown SPK is 404; spk.view is needed', async () => {
    const { detail } = await json<SpkDetailResponse>(
      await get('dewi', `/spks/${spkIds.get('SPK-T-PENDING')}/detail`),
    );
    expect(detail.approvals).toEqual([
      {
        stage: 'Creation',
        action: 'Submit',
        by: { name: names.get('rina'), role: 'Planner' },
        actedAt: expect.any(String),
        note: null,
        selfApproved: false,
      },
    ]);
    expect(detail.steps).toEqual([]);
    expect((await get('rina', '/spks/999999/detail')).status).toBe(404);
    expect((await get('acc', `/spks/${spkIds.get('SPK-T-PENDING')}/detail`)).status).toBe(403);
  });
});
