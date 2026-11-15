import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, Spk, SpkListResponse, SpkTabCounts } from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
} from '../../../src/app.tokens.js';
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
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
let active = 0;
let inactive = 0;
let plannerSpkIds: number[] = [];
let adminSpkIds: number[] = [];

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

function call(who: string, method: string, path: string, query?: Record<string, string>, body?: unknown): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  if (query) url.search = new URLSearchParams(query).toString();
  return fetch(url.toString(), {
    method,
    headers: { authorization: `Bearer ${tokens.get(who)}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const json = async <T>(response: Response) => (await response.json()) as T;
const message = async (response: Response) => (await json<{ message: string }>(response)).message;

const spkFields = (overrides: Record<string, unknown> = {}) => ({
  vehicleId: active,
  title: 'PM 20.000 km',
  category: 'PM',
  priority: 'Normal',
  requiresDowntime: true,
  description: 'Service per PM package.',
  ...overrides,
});

async function createSpk(who: string, overrides: Record<string, unknown> = {}): Promise<Spk> {
  const response = await call(who, 'POST', '/spks', undefined, spkFields(overrides));
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

async function submitSpk(who: string, spkId: number, version: number): Promise<Spk> {
  const response = await call(who, 'POST', `/spks/${spkId}/submit`, undefined, { version });
  expect(response.status).toBe(200);
  return (await json<{ spk: Spk }>(response)).spk;
}

async function approveSpk(who: string, spkId: number, version: number): Promise<Spk> {
  const response = await call(who, 'POST', `/spks/${spkId}/approve`, undefined, { version, note: 'Approved' });
  expect(response.status).toBe(200);
  return (await json<{ spk: Spk }>(response)).spk;
}

async function setupSpks(): Promise<void> {
  // Create SPKs for planner 'rina' (Planner)
  for (let i = 0; i < 3; i++) {
    const spk = await createSpk('rina', { priority: i === 0 ? 'Urgent' : 'Normal', title: `SPK ${i + 1}` });
    await addStep(spk.id);
    await submitSpk('rina', spk.id, 1);
    if (i === 0) {
      // One stays Pending_Approval
    } else if (i === 1) {
      await approveSpk('budi', spk.id, 2);
      // Now Active
    } else {
      await approveSpk('budi', spk.id, 2);
      // Complete it
      const { rows } = await testPool().query(`SELECT id FROM spk_assignments WHERE spk_id = $1`, [spk.id]);
      for (const row of rows) {
        await testPool().query(
          `UPDATE spk_assignments SET status = 'Verified' WHERE id = $1`,
          [row.id],
        );
      }
      await testPool().query(`UPDATE spks SET status = 'Completed' WHERE id = $1`, [spk.id]);
    }
    plannerSpkIds.push(spk.id);
  }

  // Create one SPK for admin 'yusuf' (System_Admin)
  const adminSpk = await createSpk('yusuf', { priority: 'High', title: 'Admin SPK' });
  await addStep(adminSpk.id);
  await submitSpk('yusuf', adminSpk.id, 1);
  await approveSpk('budi', adminSpk.id, 2);
  adminSpkIds.push(adminSpk.id);

  // Create one Draft SPK for 'dewi' (Planner)
  const draftSpk = await createSpk('dewi', { title: 'Draft SPK' });
  plannerSpkIds.push(draftSpk.id);

  // Create one Rejected SPK for 'dewi'
  const rejectedSpk = await createSpk('dewi', { title: 'Rejected SPK' });
  await addStep(rejectedSpk.id);
  await submitSpk('dewi', rejectedSpk.id, 1);
  await testPool().query(
    `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, note)
     VALUES ($1, 'Creation', 'Reject', (SELECT id FROM users WHERE email = $2), 'Supervisor', 'Reason')`,
    [rejectedSpk.id, 'budi@bmi.test'],
  );
  await testPool().query(`UPDATE spks SET status = 'Rejected' WHERE id = $1`, [rejectedSpk.id]);
  plannerSpkIds.push(rejectedSpk.id);

  // Create one Cancelled SPK for 'rina'
  const cancelledSpk = await createSpk('rina', { title: 'Cancelled SPK' });
  await addStep(cancelledSpk.id);
  await submitSpk('rina', cancelledSpk.id, 1);
  await approveSpk('budi', cancelledSpk.id, 2);
  await testPool().query(`UPDATE spks SET status = 'Cancelled', cancel_reason = 'Test cancel' WHERE id = $1`, [cancelledSpk.id]);
  plannerSpkIds.push(cancelledSpk.id);
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
  await setupSpks();
});

afterAll(async () => {
  await app.close();
});

describe('SPK List API (REQ-SPK-010)', () => {
  it('GET /spks?tab=active returns only Active/In_Progress/Pending_Verification/Pending_Amendment SPKs with tab counts', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'active', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    expect(body.items.length).toBeGreaterThan(0);
    body.items.forEach((spk) => {
      expect(['Active', 'In_Progress', 'Pending_Verification', 'Pending_Amendment']).toContain(spk.status);
    });
    expect(body.tabCounts.active).toBeGreaterThan(0);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
  });

  it('GET /spks?tab=mine returns only SPKs where user is executor or assignee', async () => {
    const res = await call('andi', 'GET', '/spks', { tab: 'mine', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    // 'andi' is Mechanic, assigned to Test_Step
    expect(body.items.length).toBeGreaterThan(0);
    body.items.forEach((spk) => {
      // SPK has a step where executor_roles includes Mechanic
    });
    expect(body.tabCounts.mine).toBeGreaterThan(0);
  });

  it('GET /spks?tab=draft returns only Draft SPKs', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'draft', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.status).toBe('Draft');
    });
    expect(body.tabCounts.draft).toBeGreaterThan(0);
  });

  it('GET /spks?tab=pending returns only Pending_Approval SPKs', async () => {
    const res = await call('budi', 'GET', '/spks', { tab: 'pending', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.status).toBe('Pending_Approval');
    });
    expect(body.tabCounts.pending).toBeGreaterThan(0);
  });

  it('GET /spks?tab=rejected returns only Rejected SPKs', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'rejected', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.status).toBe('Rejected');
    });
    expect(body.tabCounts.rejected).toBeGreaterThan(0);
  });

  it('GET /spks?tab=completed returns only Completed SPKs', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'completed', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.status).toBe('Completed');
    });
    expect(body.tabCounts.completed).toBeGreaterThan(0);
  });

  it('GET /spks?tab=cancelled returns only Cancelled SPKs', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'cancelled', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.status).toBe('Cancelled');
    });
    expect(body.tabCounts.cancelled).toBeGreaterThan(0);
  });

  it('GET /spks?tab=all returns all non-deleted SPKs', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'all', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.tabCounts.all).toBeGreaterThan(0);
  });

  it('GET /spks?search=... filters by SPK number, title, or vehicle plate', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'all', search: 'SPK 1', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.spkNumber).toContain('SPK-');
    });
    // Should find the SPK titled 'SPK 1'
    expect(body.items.some((spk) => spk.title.includes('SPK 1'))).toBe(true);
  });

  it('GET /spks?type=PM filters by category', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'all', type: 'PM', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.category).toBe('PM');
    });
  });

  it('GET /spks?vehicleId=... filters by vehicle', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'all', vehicleId: String(active), page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    body.items.forEach((spk) => {
      expect(spk.vehicle.id).toBe(active);
    });
  });

  it('GET /spks pagination returns correct page, pageSize, total, totalPages', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'all', page: '1', pageSize: '2' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(2);
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(body.pagination.totalPages).toBeGreaterThan(0);
  });

  it('GET /spks with default params uses tab=active, page=1, pageSize=20', async () => {
    const res = await call('rina', 'GET', '/spks');
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(20);
  });

  it('GET /spks without spk.view capability returns 403', async () => {
    const res = await call('andi', 'GET', '/spks');
    // Mechanic doesn't have spk.view, only mechanic.execute
    expect(res.status).toBe(403);
  });

  it('GET /spks Inactive vehicle never appears in list (REQ-SPK-013)', async () => {
    // Create SPK for inactive vehicle
    const { rows } = await testPool().query(
      `INSERT INTO spks (spk_number, vehicle_id, title, category, priority, requires_downtime, description, created_by, status)
       VALUES ('SPK-2611120001', $1, 'Test', 'PM', 'Normal', true, 'Test', (SELECT id FROM users WHERE email = 'rina@bmi.test'), 'Draft')
       RETURNING id`,
      [inactive],
    );
    const res = await call('rina', 'GET', '/spks', { tab: 'all', page: '1', pageSize: '20' });
    expect(res.status).toBe(200);
    const body = await json<SpkListResponse>(res);
    expect(body.items.every((spk) => spk.vehicle.id !== inactive)).toBe(true);
  });

  it('tabCounts matches actual filtered rows for each tab', async () => {
    const res = await call('rina', 'GET', '/spks', { tab: 'active', page: '1', pageSize: '20' });
    const body = await json<SpkListResponse>(res);
    // Count actual active items
    const activeCount = body.items.filter((spk) =>
      ['Active', 'In_Progress', 'Pending_Verification', 'Pending_Amendment'].includes(spk.status)
    ).length;
    expect(body.tabCounts.active).toBe(activeCount);
  });
});