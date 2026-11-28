import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  STEP_ACTIONS,
  type Role,
  type SpkDetailResponse,
  type StepAction,
  type StepSubmitResponse,
} from '@bmi/shared';
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
import { findContractBreaks, type ContractCase } from '../harness/allowed-actions-contract.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

// TASK-202: the engine core on the tests' dummy module (REQ-ENG-001 to 003, BR-05, T7, T11,
// DEC-139, DEC-145, DEC-146). The module 'Dummy' is registered by this harness only (DEC-144).

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-28 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
let vehicleId = 0;
let sequence = 0;
let keys = 0;
let fileSequence = 0;

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

const idOf = (who: string) => ids.get(who) ?? 0;
const auth = (who: string) => ({ authorization: `Bearer ${tokens.get(who)}` });
const json = async <T>(response: Response) => (await response.json()) as T;
const messageOf = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

const submit = (
  who: string,
  spkId: number,
  stepId: number,
  fileIds: number[] = [],
  key = `step-submit-${(keys += 1)}`,
) =>
  fetch(`${baseUrl}/spks/${spkId}/steps/${stepId}/submit`, {
    method: 'POST',
    headers: { ...auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ fileIds }),
  });

const approve = async (who: string, spkId: number) => {
  const { rows } = await testPool().query<{ version: number }>(
    `SELECT version FROM spks WHERE id = $1`,
    [spkId],
  );
  return fetch(`${baseUrl}/approvals/spk/${spkId}/approve`, {
    method: 'POST',
    headers: { ...auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': `a-${spkId}` },
    body: JSON.stringify({ version: rows[0]?.version }),
  });
};

interface StepSpec {
  roles?: string;
  status?: string;
}

/**
 * An SPK written straight to the tables (no composer yet, DEC-126): its Dummy steps are written while
 * Draft (DEC-145), then the SPK takes the status under test. Returns the SPK and its step ids in order.
 */
async function insertSpk(
  status: string,
  steps: StepSpec[] = [{}, {}, {}],
): Promise<{ spkId: number; stepIds: number[] }> {
  sequence += 1;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       created_by)
     VALUES ($1, $2, 'Brake check', 'Corrective', 'Manual_Planner', 'Rem blong.', 'Draft', $3)
     RETURNING id`,
    [`SPK-261128${String(sequence).padStart(4, '0')}`, vehicleId, idOf('rina')],
  );
  const spkId = Number(rows[0]?.id);
  const stepIds: number[] = [];
  for (const [index, step] of steps.entries()) {
    const stepStatus = step.status ?? (index === 0 ? 'Open' : 'Locked');
    const { rows: inserted } = await testPool().query<{ id: string }>(
      `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status,
         opened_at)
       VALUES ($1, $2, 'Dummy', $3, 'Planner', $4, $5)
       RETURNING id`,
      [
        spkId,
        index + 1,
        step.roles ?? '{Mechanic}',
        stepStatus,
        stepStatus === 'Locked' ? null : new Date(),
      ],
    );
    stepIds.push(Number(inserted[0]?.id));
  }
  await testPool().query(`UPDATE spks SET status = $2 WHERE id = $1`, [spkId, status]);
  return { spkId, stepIds };
}

async function stepStatuses(spkId: number): Promise<string[]> {
  const { rows } = await testPool().query<{ status: string }>(
    `SELECT status FROM spk_assignments WHERE spk_id = $1 ORDER BY sequence_no`,
    [spkId],
  );
  return rows.map((row) => row.status);
}

async function spkStatus(spkId: number): Promise<{ status: string; version: number }> {
  const { rows } = await testPool().query<{ status: string; version: number }>(
    `SELECT status, version FROM spks WHERE id = $1`,
    [spkId],
  );
  return rows[0] ?? { status: '', version: 0 };
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const { rows } = await testPool().query<{ n: string }>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

/** A stored file of `who` in a given status (8.1); Ready carries its SHA-256. */
async function insertFile(who: string, status: string, name = 'brake.jpg'): Promise<number> {
  fileSequence += 1;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO stored_files (storage_key, profile, mime_type, original_name, status, sha256,
       reject_reason, uploaded_by)
     VALUES ($1, 'Photo', 'image/jpeg', $2, $3, $4, $5, $6) RETURNING id`,
    [
      `test/step-submit/${fileSequence}.jpg`,
      name,
      status,
      status === 'Ready' ? 'a'.repeat(64) : null,
      status === 'Rejected' ? 'The file could not be read.' : null,
      idOf(who),
    ],
  );
  return Number(rows[0]?.id);
}

const notices = (who: string, dedupeKey: string) =>
  count(`SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND dedupe_key = $2`, [
    idOf(who),
    dedupeKey,
  ]);

beforeAll(async () => {
  await seedRolePermissions();
  // DEC-56: only the System Admin signs in during Setup; the executors need Live.
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
  await account('budi', 'Supervisor');
  await account('yusuf', 'System_Admin');
  await account('joko', 'Mechanic');
  await account('andi', 'Warehouse_Manager');
  await account('dewi', 'Driver');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('L_ENG', 'L_ENG', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('C_ENG', 'Tractor head', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 2020 EN', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  vehicleId = Number(vehicle[0]?.id);
  // DEC-144: the dummy module is registered by the tests, never by a migration or a seed.
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Dummy', 'Dummy step', 'DummyStep', '{Mechanic}', '{}', '{}', 'None')`,
  );
});

afterAll(async () => {
  await app.close();
});

describe('TASK-202 step submit (REQ-ENG-001 to 003, BR-05, TX-02, DEC-145, DEC-146)', () => {
  it('AC-SPK-002 an approved SPK with three steps shows step 1 Open, steps 2 and 3 Locked', async () => {
    const { spkId } = await insertSpk('Pending_Approval', [
      { status: 'Locked' },
      { status: 'Locked' },
      { status: 'Locked' },
    ]);
    expect((await approve('budi', spkId)).status).toBe(200);
    expect(await stepStatuses(spkId)).toEqual(['Open', 'Locked', 'Locked']);
  });

  it('AC-ENG-001 when step 1 is submitted, step 2 is Open and step 3 stays Locked', async () => {
    const { spkId, stepIds } = await insertSpk('Pending_Approval', [
      { status: 'Locked' },
      { status: 'Locked' },
      { status: 'Locked' },
    ]);
    expect((await approve('budi', spkId)).status).toBe(200);
    const response = await submit('joko', spkId, stepIds[0] ?? 0);
    expect(response.status).toBe(200);
    const body = await json<StepSubmitResponse>(response);
    expect(body.steps.map((step) => step.status)).toEqual(['Submitted', 'Open', 'Locked']);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Open', 'Locked']);
    const { rows } = await testPool().query<{
      executed_by: string;
      submitted: boolean;
      opened: boolean;
    }>(
      `SELECT executed_by::text, submitted_at IS NOT NULL AS submitted,
         (SELECT opened_at IS NOT NULL FROM spk_assignments WHERE id = $2) AS opened
       FROM spk_assignments WHERE id = $1`,
      [stepIds[0], stepIds[1]],
    );
    expect(rows[0]).toEqual({ executed_by: String(idOf('joko')), submitted: true, opened: true });
  });

  it('REQ-ENG-003 a user of another role is refused 403; a role without the module capability is refused', async () => {
    // Mechanic holds mechanic.execute but is not an executor role of the step (L2);
    // Warehouse Manager is listed but lacks the Dummy module's capability (L1, DEC-146).
    const { spkId, stepIds } = await insertSpk('Active', [{ roles: '{Warehouse_Manager}' }]);
    const notExecutor = await submit('joko', spkId, stepIds[0] ?? 0);
    expect(notExecutor.status).toBe(403);
    expect(await messageOf(notExecutor)).toBe('Only an executor of this step may submit it.');
    expect((await submit('andi', spkId, stepIds[0] ?? 0)).status).toBe(403);
    expect((await submit('dewi', spkId, stepIds[0] ?? 0)).status).toBe(403);
    expect(await stepStatuses(spkId)).toEqual(['Open']);
  });

  it('REQ-ENG-003 RL-3 the System Admin may submit a step of any executor role', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{ roles: '{Mechanic}' }, {}]);
    expect((await submit('yusuf', spkId, stepIds[0] ?? 0)).status).toBe(200);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Open']);
  });

  it('T7 the first submit moves an Active SPK to In_Progress; T11 the last one to Pending_Verification', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const first = await submit('joko', spkId, stepIds[0] ?? 0);
    expect((await json<StepSubmitResponse>(first)).spk.status).toBe('In_Progress');
    const { rows } = await testPool().query<{ started: boolean }>(
      `SELECT started_at IS NOT NULL AS started FROM spks WHERE id = $1`,
      [spkId],
    );
    expect(rows[0]?.started).toBe(true);
    const second = await submit('joko', spkId, stepIds[1] ?? 0);
    expect((await json<StepSubmitResponse>(second)).spk.status).toBe('Pending_Verification');
    expect(
      await count(
        `SELECT count(*) AS n FROM audit_logs WHERE entity = 'spk' AND entity_id = $1
           AND after->>'status' IN ('In_Progress', 'Pending_Verification')`,
        [spkId],
      ),
    ).toBe(2);
  });

  it('T7 T11 a one-step SPK moves both in order, its version raised twice', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}]);
    const { version } = await spkStatus(spkId);
    expect((await submit('joko', spkId, stepIds[0] ?? 0)).status).toBe(200);
    expect(await spkStatus(spkId)).toEqual({
      status: 'Pending_Verification',
      version: version + 2,
    });
  });

  it('REQ-NTF-005 the verifiers and the next step executors are notified once', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const [first, second] = stepIds;
    expect((await submit('joko', spkId, first ?? 0)).status).toBe(200);
    expect(await notices('joko', `spk:${spkId}:step:${second}:open:a1`)).toBe(1);
    expect(await notices('rina', `spk:${spkId}:step:${first}:submitted:a1`)).toBe(1);
    expect(await notices('yusuf', `spk:${spkId}:step:${first}:submitted:a1`)).toBe(1);
    expect(await notices('andi', `spk:${spkId}:step:${second}:open:a1`)).toBe(0);
  });

  it('DEC-139 a Rejected file refuses the submit and its uploader gets one notice that survives the rollback', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const ready = await insertFile('joko', 'Ready');
    const failed = await insertFile('joko', 'Rejected', 'rem-depan.jpg');
    const response = await submit('joko', spkId, stepIds[0] ?? 0, [ready, failed]);
    expect(response.status).toBe(400);
    expect(await messageOf(response)).toContain('rem-depan.jpg');
    expect(await stepStatuses(spkId)).toEqual(['Open', 'Locked']);
    expect(await notices('joko', `file:${failed}:failed`)).toBe(1);
    const again = await submit('joko', spkId, stepIds[0] ?? 0, [failed]);
    expect(again.status).toBe(400);
    expect(await notices('joko', `file:${failed}:failed`)).toBe(1);
    expect(
      await count(`SELECT count(*) AS n FROM stored_files WHERE id = $1 AND attached_at IS NULL`, [
        ready,
      ]),
    ).toBe(1);
  });

  it('REQ-FUP-006 a Pending file refuses with 409 and a retry with the same key succeeds once Ready', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const pending = await insertFile('joko', 'Pending');
    const refused = await submit('joko', spkId, stepIds[0] ?? 0, [pending], 'pending-retry');
    expect(refused.status).toBe(409);
    expect(await messageOf(refused)).toBe('Wait until every file is ready.');
    await testPool().query(`UPDATE stored_files SET status = 'Ready', sha256 = $2 WHERE id = $1`, [
      pending,
      'b'.repeat(64),
    ]);
    const retried = await submit('joko', spkId, stepIds[0] ?? 0, [pending], 'pending-retry');
    expect(retried.status).toBe(200);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Open']);
  });

  it('REQ-FUP-009 a file is attached on success and cannot be submitted on a second step', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const file = await insertFile('joko', 'Ready');
    expect((await submit('joko', spkId, stepIds[0] ?? 0, [file])).status).toBe(200);
    expect(
      await count(
        `SELECT count(*) AS n FROM stored_files WHERE id = $1 AND attached_at IS NOT NULL`,
        [file],
      ),
    ).toBe(1);
    const reused = await submit('joko', spkId, stepIds[1] ?? 0, [file]);
    expect(reused.status).toBe(400);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Open']);
  });

  it("REQ-FUP-009 another user's file cannot be submitted", async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}]);
    const theirs = await insertFile('andi', 'Ready');
    expect((await submit('joko', spkId, stepIds[0] ?? 0, [theirs])).status).toBe(400);
    expect(await stepStatuses(spkId)).toEqual(['Open']);
  });

  it('NFR-01 the same key replays; another key gets 409 already submitted', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const first = await submit('joko', spkId, stepIds[0] ?? 0, [], 'replay-1');
    const replay = await submit('joko', spkId, stepIds[0] ?? 0, [], 'replay-1');
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await json<StepSubmitResponse>(replay)).toEqual(await json<StepSubmitResponse>(first));
    const other = await submit('joko', spkId, stepIds[0] ?? 0, [], 'replay-2');
    expect(other.status).toBe(409);
    expect(await messageOf(other)).toBe('This step is already submitted.');
    expect(
      await count(
        `SELECT count(*) AS n FROM audit_logs WHERE entity = 'spk_assignment' AND entity_id = $1`,
        [stepIds[0]],
      ),
    ).toBe(1);
  });

  it('NFR-01 two submits in parallel: one succeeds, one gets 409', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const answers = await Promise.all([
      submit('joko', spkId, stepIds[0] ?? 0),
      submit('yusuf', spkId, stepIds[0] ?? 0),
    ]);
    expect(answers.map((answer) => answer.status).sort()).toEqual([200, 409]);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Open']);
  });

  it('NFR-01 two different steps submitted in parallel both land, in a fixed lock order', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [
      { status: 'Open' },
      { status: 'Open' },
      {},
    ]);
    const answers = await Promise.all([
      submit('joko', spkId, stepIds[0] ?? 0),
      submit('yusuf', spkId, stepIds[1] ?? 0),
    ]);
    expect(answers.map((answer) => answer.status)).toEqual([200, 200]);
    expect(await stepStatuses(spkId)).toEqual(['Submitted', 'Submitted', 'Open']);
    expect((await spkStatus(spkId)).status).toBe('In_Progress');
  });

  it('T8 a step of a Pending_Amendment SPK is refused', async () => {
    const { spkId, stepIds } = await insertSpk('Pending_Amendment', [{}, {}]);
    const response = await submit('joko', spkId, stepIds[0] ?? 0);
    expect(response.status).toBe(409);
    expect(await stepStatuses(spkId)).toEqual(['Open', 'Locked']);
  });

  it('SM-STEP a Locked step cannot be submitted', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    expect((await submit('joko', spkId, stepIds[1] ?? 0)).status).toBe(409);
  });

  it('DEC-145 a step the SPK does not hold is 404', async () => {
    const { spkId } = await insertSpk('Active', [{}]);
    const other = await insertSpk('Active', [{}]);
    expect((await submit('joko', spkId, other.stepIds[0] ?? 0)).status).toBe(404);
    expect((await submit('joko', 999_999, other.stepIds[0] ?? 0)).status).toBe(404);
  });

  it('NFR-02 one step_submit audit record with before, after and fileIds', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const file = await insertFile('joko', 'Ready');
    expect((await submit('joko', spkId, stepIds[0] ?? 0, [file])).status).toBe(200);
    const { rows } = await testPool().query<{
      action: string;
      before: unknown;
      after: unknown;
      user_role: string;
    }>(
      `SELECT action, before, after, user_role FROM audit_logs
       WHERE entity = 'spk_assignment' AND entity_id = $1`,
      [stepIds[0]],
    );
    expect(rows).toEqual([
      {
        action: 'step_submit',
        before: { status: 'Open' },
        after: { status: 'Submitted', fileIds: [file] },
        user_role: 'Mechanic',
      },
    ]);
  });

  it('DEC-93 the step allowedActions in SPKDetail equal what the server accepts', async () => {
    const { spkId, stepIds } = await insertSpk('Active', [{}, {}]);
    const detailOf = async (who: string) =>
      (
        await json<SpkDetailResponse>(
          await fetch(`${baseUrl}/spks/${spkId}/detail`, { headers: auth(who) }),
        )
      ).detail.steps;
    expect((await detailOf('joko')).map((step) => step.allowedActions)).toEqual([['submit'], []]);
    expect((await detailOf('rina')).map((step) => step.allowedActions)).toEqual([[], []]);
    expect((await submit('joko', spkId, stepIds[0] ?? 0)).status).toBe(200);
    expect((await detailOf('joko')).map((step) => step.allowedActions)).toEqual([[], ['submit']]);
  });

  it('REQ-IAM-014 DEC-93 the step record type passes the allowedActions contract', async () => {
    const caseOf = (who: string, roles: string, label: string): ContractCase<StepAction> => {
      let current = { spkId: 0, stepId: 0 };
      return {
        label,
        listed: async () => {
          const { spkId, stepIds } = await insertSpk('Active', [{ roles }, {}]);
          current = { spkId, stepId: stepIds[0] ?? 0 };
          const response = await fetch(`${baseUrl}/spks/${spkId}/detail`, { headers: auth(who) });
          return (await json<SpkDetailResponse>(response)).detail.steps[0]?.allowedActions ?? [];
        },
        send: async () => (await submit(who, current.spkId, current.stepId)).status,
      };
    };
    const breaks = await findContractBreaks(STEP_ACTIONS, [
      caseOf('joko', '{Mechanic}', 'Mechanic on a Mechanic step'),
      caseOf('yusuf', '{Mechanic}', 'System Admin on a Mechanic step'),
      caseOf('joko', '{Warehouse_Manager}', 'Mechanic on a Warehouse Manager step'),
      caseOf('andi', '{Warehouse_Manager}', 'Warehouse Manager on a Dummy step'),
      caseOf('rina', '{Mechanic}', 'Planner on a Mechanic step'),
    ]);
    expect(breaks).toEqual([]);
  });
});
