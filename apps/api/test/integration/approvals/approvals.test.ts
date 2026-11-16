import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  ApprovalCountResponse,
  ApprovalHistoryResponse,
  ApprovalInboxResponse,
  ApprovalReviewResponse,
  Role,
  SpkListResponse,
} from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

// TASK-122: FLW-APR-01 and FLW-APR-06 at the API (REQ-SPK-005 to 007, REQ-APR-001 to 007, DEC-128).

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
let vehicleId = 0;
let sequence = 0;

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

function get(who: string, path: string, query: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  url.search = new URLSearchParams(query).toString();
  return fetch(url, { headers: auth(who) });
}

function decide(
  who: string,
  spkId: number,
  action: 'approve' | 'reject',
  body: Record<string, unknown>,
  key = `k-${who}-${spkId}-${action}-${(sequence += 1)}`,
): Promise<Response> {
  return fetch(`${baseUrl}/approvals/spk/${spkId}/${action}`, {
    method: 'POST',
    headers: { ...auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

const json = async <T>(response: Response) => (await response.json()) as T;

async function inbox(who: string, query: Record<string, string> = {}) {
  const response = await get(who, '/approvals/spk', query);
  expect(response.status).toBe(200);
  return (await json<ApprovalInboxResponse>(response)).items;
}

async function review(who: string, spkId: number) {
  const response = await get(who, `/approvals/spk/${spkId}`);
  expect(response.status).toBe(200);
  return (await json<ApprovalReviewResponse>(response)).review;
}

async function setting(key: string, value: unknown): Promise<void> {
  await testPool().query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ($1, $2::jsonb)
     ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
    [key, JSON.stringify(value)],
  );
}

/** An SPK waiting for creation approval: its Submit row and, as DEC-126 allows, its steps. */
async function waitingSpk(
  creator: string,
  values: { priority?: string; minutesAgo?: number; steps?: number; title?: string } = {},
): Promise<number> {
  sequence += 1;
  const minutesAgo = values.minutesAgo ?? 10;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       priority, created_by, created_at)
     VALUES ($1, $2, $3, 'Corrective', 'Manual_Planner', 'Brake pedal feels soft.', 'Pending_Approval',
       $4, $5, $6::timestamp)
     RETURNING id`,
    [
      // NFR-15: shaped as the API numbers them (SPK-yymmddNNNN, the WIB date of the clock).
      `SPK-261116${String(sequence).padStart(4, '0')}`,
      vehicleId,
      values.title ?? `Work ${sequence}`,
      values.priority ?? 'Normal',
      ids.get(creator),
      new Date(clock.now().getTime() - (minutesAgo + 5) * 60_000).toISOString(),
    ],
  );
  const spkId = Number(rows[0]?.id);
  for (let step = 1; step <= (values.steps ?? 3); step += 1) {
    await testPool().query(
      `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status)
       VALUES ($1, $2, 'Test_Step', $3::role_t[], 'Planner', 'Locked')`,
      [spkId, step, step === 1 ? '{Warehouse_Manager}' : '{Mechanic}'],
    );
  }
  await testPool().query(
    `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role, acted_at)
     VALUES ($1, 'Creation', 'Submit', $2, (SELECT role FROM user_roles WHERE user_id = $2),
       $3::timestamp)`,
    [spkId, ids.get(creator), new Date(clock.now().getTime() - minutesAgo * 60_000).toISOString()],
  );
  return spkId;
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
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('rina', 'Planner');
  await account('dewi', 'Planner');
  await account('budi', 'Supervisor');
  await account('hendra', 'GM');
  await account('admin', 'System_Admin');
  await account('andi', 'Mechanic');
  await account('wati', 'Warehouse_Manager');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('L_APR', 'L_APR', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('C_APR', 'Tractor head', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 1234 APR', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  vehicleId = Number(vehicle[0]?.id);
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Test_Step', 'Stock', 'TestStep', '{Warehouse_Manager}', '{}', '{}', 'None')`,
  );
});

beforeEach(async () => {
  await setting('planner_approval_kinds', []);
  await setting('planner_approval_until', null);
  // Each test reads only the items it makes: older ones leave the inbox.
  await testPool().query(
    `UPDATE spks SET status = 'Cancelled', cancel_reason = 'Test done' WHERE status = 'Pending_Approval'`,
  );
});

afterAll(async () => {
  await app.close();
});

describe('FLW-APR-01 ApprovalReview (REQ-SPK-005, REQ-SPK-006, REQ-SPK-007, C-24, C-25)', () => {
  it('AC-SPK-001 BR-03 the creating Planner is refused; a Supervisor approves', async () => {
    await setting('planner_approval_kinds', ['spk_creation']);
    const spkId = await waitingSpk('rina');
    const version = (await review('budi', spkId)).version;

    const own = await decide('rina', spkId, 'approve', { version });
    expect(own.status).toBe(403);
    expect(((await own.json()) as { message: string }).message).toBe(
      'You cannot decide an item you created.',
    );
    const accepted = await decide('budi', spkId, 'approve', { version });
    expect(accepted.status).toBe(200);
    expect((await json<ApprovalReviewResponse>(accepted)).review.status).toBe('Active');
  });

  it('AC-SPK-002 T3 TX-02 approval: Active, step 1 Open, steps 2 and 3 Locked, one stamp', async () => {
    const spkId = await waitingSpk('rina');
    const before = await review('budi', spkId);
    expect(before.allowedActions).toEqual(['approve', 'reject']);

    const response = await decide('budi', spkId, 'approve', { version: before.version });
    const after = (await json<ApprovalReviewResponse>(response)).review;
    expect(after.status).toBe('Active');
    expect(after.allowedActions).toEqual([]);
    expect(after.decision).toMatchObject({ action: 'Approve', selfApproved: false, reason: null });
    expect(after.decision?.by.role).toBe('Supervisor');

    const { rows: steps } = await testPool().query<{ status: string; opened: boolean }>(
      `SELECT status, opened_at IS NOT NULL AS opened FROM spk_assignments WHERE spk_id = $1
       ORDER BY sequence_no`,
      [spkId],
    );
    expect(steps).toEqual([
      { status: 'Open', opened: true },
      { status: 'Locked', opened: false },
      { status: 'Locked', opened: false },
    ]);
    const { rows: stamps } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM spk_approvals WHERE spk_id = $1 AND action = 'Approve'`,
      [spkId],
    );
    expect(stamps[0]?.n).toBe('1');
    // TX-02: the executor of step 1 (a Warehouse Manager) is notified.
    const { rows: notices } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND link_record = $2`,
      [ids.get('wati'), `/spk/${spkId}`],
    );
    expect(notices[0]?.n).toBe('1');
  });

  it('AC-APR-004 C-25 a rejection without a reason, or with spaces only, is refused', async () => {
    const spkId = await waitingSpk('rina');
    const { version } = await review('budi', spkId);
    for (const body of [{ version }, { version, reason: '   ' }]) {
      const blank = await decide('budi', spkId, 'reject', body);
      expect(blank.status).toBe(400);
      expect(((await blank.json()) as { message: string }).message).toBe(
        'Give a reason to reject.',
      );
    }
    expect((await review('budi', spkId)).status).toBe('Pending_Approval');
  });

  it("AC-SPK-005 T4 a rejection with a reason: Rejected, in the creator's tab with it, creator notified", async () => {
    const spkId = await waitingSpk('rina');
    const { version } = await review('budi', spkId);

    const rejected = await decide('budi', spkId, 'reject', { version, reason: 'Wrong vehicle' });
    expect(rejected.status).toBe(200);
    const after = (await json<ApprovalReviewResponse>(rejected)).review;
    expect(after.status).toBe('Rejected');
    expect(after.decision).toMatchObject({ action: 'Reject', reason: 'Wrong vehicle' });

    const tab = await json<SpkListResponse>(await get('rina', '/spks', { tab: 'rejected' }));
    const row = tab.items.find((item) => item.id === spkId);
    // DEC-129: SPKRejected shows the reason; Waiting on is the creator again.
    expect(row?.status).toBe('Rejected');
    expect(row?.waitingOn).toMatch(/^Planner /);
    // REQ-SPK-007: the creator is notified.
    const { rows } = await testPool().query<{ body: string }>(
      `SELECT body FROM notifications WHERE user_id = $1 AND link_record = $2`,
      [ids.get('rina'), `/spk/${spkId}`],
    );
    expect(rows.map((notice) => notice.body)).toEqual([expect.stringContaining('Wrong vehicle')]);
  });

  it('AC-SPK-006 BR-03 DEC-133 the System Admin cannot approve its own SPK while Live; in Setup mode it can, Self-approved', async () => {
    const spkId = await waitingSpk('admin');
    const { rows: current } = await testPool().query<{ version: number }>(
      'SELECT version FROM spks WHERE id = $1',
      [spkId],
    );
    const refused = await decide('admin', spkId, 'approve', { version: current[0]?.version });
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toBe(
      'You cannot decide an item you created.',
    );

    await setting('system_mode', 'Setup');
    const before = await review('admin', spkId);
    expect(before.yours).toBe(true);
    const response = await decide('admin', spkId, 'approve', { version: before.version });
    await setting('system_mode', 'Live');
    expect(response.status).toBe(200);
    expect((await json<ApprovalReviewResponse>(response)).review.decision?.selfApproved).toBe(true);
    const { rows: stamp } = await testPool().query<{ self_approved: boolean }>(
      `SELECT self_approved FROM spk_approvals WHERE spk_id = $1 AND action = 'Approve'`,
      [spkId],
    );
    expect(stamp).toEqual([{ self_approved: true }]);
    const { rows: audit } = await testPool().query<{ self_decision: boolean }>(
      `SELECT self_decision FROM audit_logs WHERE entity = 'spk' AND entity_id = $1 AND action = 'approve'`,
      [spkId],
    );
    expect(audit).toEqual([{ self_decision: true }]);
  });

  it('NFR-01 TX-22 approve is idempotent on retry: same answer, one stamp', async () => {
    const spkId = await waitingSpk('rina');
    const { version } = await review('budi', spkId);
    const first = await decide('budi', spkId, 'approve', { version }, 'retry-1');
    const second = await decide('budi', spkId, 'approve', { version }, 'retry-1');
    expect(second.status).toBe(first.status);
    expect(await second.json()).toEqual(await first.json());
    const { rows } = await testPool().query<{ n: string }>(
      `SELECT count(*)::text AS n FROM spk_approvals WHERE spk_id = $1 AND action = 'Approve'`,
      [spkId],
    );
    expect(rows[0]?.n).toBe('1');
  });

  it('NFR-03 a decision on a stale version, or an item already decided, is refused', async () => {
    const spkId = await waitingSpk('rina');
    const { version } = await review('budi', spkId);
    expect((await decide('budi', spkId, 'approve', { version: version + 1 })).status).toBe(409);
    expect((await decide('hendra', spkId, 'approve', { version })).status).toBe(200);
    const late = await decide('budi', spkId, 'reject', { version, reason: 'Too late' });
    expect(late.status).toBe(403);
    expect(((await late.json()) as { message: string }).message).toBe(
      'This item is no longer waiting for approval.',
    );
  });

  it('404 for an unknown SPK; a user without spk.approve is refused', async () => {
    expect((await get('budi', '/approvals/spk/999999')).status).toBe(404);
    const spkId = await waitingSpk('rina');
    expect((await get('andi', `/approvals/spk/${spkId}`)).status).toBe(403);
    expect((await decide('andi', spkId, 'approve', { version: 1 })).status).toBe(403);
  });
});

describe('FLW-APR-01 the Approvals inbox (REQ-APR-001, REQ-APR-002, REQ-APR-005, REQ-APR-006, DEC-128)', () => {
  it('AC-APR-001 a Mechanic and a Planner with the switch off have no Approvals; the System Admin has', async () => {
    expect((await get('andi', '/approvals/count')).status).toBe(403);
    expect((await get('rina', '/approvals/count')).status).toBe(403);
    expect((await get('rina', '/approvals/spk')).status).toBe(403);
    expect((await get('admin', '/approvals/count')).status).toBe(200);
  });

  it('REQ-APR-002 DEC-128 the columns, Urgent and High first, then the longest waiting; search and chip', async () => {
    const normalOld = await waitingSpk('rina', { minutesAgo: 90, title: 'Oil leak' });
    const urgent = await waitingSpk('rina', { priority: 'Urgent', minutesAgo: 5 });
    const normalNew = await waitingSpk('rina', { minutesAgo: 20 });
    const high = await waitingSpk('dewi', { priority: 'High', minutesAgo: 1 });

    const items = await inbox('budi');
    expect(items.map((item) => item.spkId)).toEqual([urgent, high, normalOld, normalNew]);
    const old = items.find((item) => item.spkId === normalOld);
    expect(old).toMatchObject({
      title: 'Oil leak',
      category: 'Corrective',
      kind: 'Creation',
      vehicle: { licensePlate: 'B 1234 APR' },
      waitingSeconds: 90 * 60,
      yours: false,
      description: 'Brake pedal feels soft.',
    });
    expect(old?.requestedBy.role).toBe('Planner');
    expect(old?.steps.map((step) => [step.sequenceNo, step.name])).toEqual([
      [1, 'Stock'],
      [2, 'Stock'],
      [3, 'Stock'],
    ]);
    expect((await inbox('budi', { search: 'oil' })).map((item) => item.spkId)).toEqual([normalOld]);
    expect(await inbox('budi', { search: 'b 1234' })).toHaveLength(4);
    expect(await inbox('budi', { kind: 'Creation' })).toHaveLength(4);
    expect((await json<ApprovalCountResponse>(await get('budi', '/approvals/count'))).count).toBe(
      4,
    );
  });

  it("AC-APR-002 REQ-APR-005 BR-04 once a Supervisor approves, the item leaves the GM's list", async () => {
    const spkId = await waitingSpk('rina');
    expect((await inbox('hendra')).map((item) => item.spkId)).toEqual([spkId]);
    const { version } = await review('budi', spkId);
    expect((await decide('budi', spkId, 'approve', { version })).status).toBe(200);
    expect(await inbox('hendra')).toEqual([]);
    expect((await json<ApprovalCountResponse>(await get('hendra', '/approvals/count'))).count).toBe(
      0,
    );
  });

  it('AC-APR-003 REQ-APR-006 DEC-133 the viewer never sees its own SPK while Live; in Setup mode it shows as Yours', async () => {
    await setting('planner_approval_kinds', ['spk_creation']);
    const byRina = await waitingSpk('rina');
    const byAdmin = await waitingSpk('admin');
    expect((await inbox('rina')).map((item) => item.spkId)).toEqual([byAdmin]);
    const live = (await inbox('admin')).map((item) => item.spkId);
    expect(live).toContain(byRina);
    expect(live).not.toContain(byAdmin);

    await setting('system_mode', 'Setup');
    const setupItems = await inbox('admin');
    await setting('system_mode', 'Live');
    expect(setupItems.map((item) => [item.spkId, item.yours])).toEqual(
      expect.arrayContaining([
        [byRina, false],
        [byAdmin, true],
      ]),
    );
  });

  it("AC-IAM-005 BR-04 with the switch on until 18:00 a Planner decides others' SPKs, not its own; after 18:00 it loses Approvals", async () => {
    await setting('planner_approval_kinds', ['spk_creation']);
    // Until 08:05 WIB, as the AC's 18:00.
    await setting('planner_approval_until', '2026-11-16T01:05:00.000Z');
    const byMechanicDesk = await waitingSpk('dewi');
    const own = await waitingSpk('rina');
    const { version } = await review('rina', byMechanicDesk);
    expect((await decide('rina', byMechanicDesk, 'approve', { version })).status).toBe(200);
    expect((await get('rina', `/approvals/spk/${own}`)).status).toBe(200);
    expect((await review('rina', own)).allowedActions).toEqual([]);
    expect((await decide('rina', own, 'approve', { version })).status).toBe(403);

    // The end time has passed (capabilities read it on every request, DEC-118).
    await setting('planner_approval_until', '2026-11-16T00:59:00.000Z');
    expect((await get('rina', '/approvals/count')).status).toBe(403);
  });

  it('BR-04 a Planner whose switch lacks the creation kind does not see creation items', async () => {
    await setting('planner_approval_kinds', ['spk_completion']);
    await waitingSpk('dewi');
    expect(await inbox('rina')).toEqual([]);
    expect((await json<ApprovalCountResponse>(await get('rina', '/approvals/count'))).count).toBe(
      0,
    );
  });
});

describe('FLW-APR-06 History (REQ-APR-007, DEC-128)', () => {
  it("REQ-APR-007 every Approver's decisions, newest first, with the reason and the stamp; chips filter", async () => {
    const approved = await waitingSpk('rina');
    const rejected = await waitingSpk('dewi');
    const first = await review('budi', approved);
    expect((await decide('budi', approved, 'approve', { version: first.version })).status).toBe(
      200,
    );
    clock.advanceMinutes(1);
    const second = await review('hendra', rejected);
    expect(
      (await decide('hendra', rejected, 'reject', { version: second.version, reason: 'No budget' }))
        .status,
    ).toBe(200);

    const response = await get('budi', '/approvals/history');
    expect(response.status).toBe(200);
    const items = (await json<ApprovalHistoryResponse>(response)).items.filter((item) =>
      [approved, rejected].includes(item.spkId),
    );
    expect(items.map((item) => [item.spkId, item.decision.action, item.decision.by.role])).toEqual([
      [rejected, 'Reject', 'GM'],
      [approved, 'Approve', 'Supervisor'],
    ]);
    expect(items[0]?.decision.reason).toBe('No budget');
    expect(items[0]?.requestedBy.role).toBe('Planner');

    const onlyRejected = await json<ApprovalHistoryResponse>(
      await get('budi', '/approvals/history', { decision: 'Reject' }),
    );
    expect(onlyRejected.items.every((item) => item.decision.action === 'Reject')).toBe(true);
    expect((await get('andi', '/approvals/history')).status).toBe(403);
  });
});
