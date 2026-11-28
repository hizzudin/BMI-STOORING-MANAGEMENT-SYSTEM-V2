import type { SpkDetailResponse } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MODULES } from '../../../src/app.modules.js';
import { DrizzleAuditGateway } from '../../../src/infra/db/account-gateways.js';
import { dummyModule } from '../../../src/modules/dummy/dummy-module.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import {
  codelessRow,
  insertModuleRow,
  insertSpkWithSteps,
  insertVehicle,
  startEngineApp,
  stepStatus,
  submitStep,
  testModule,
  type EngineApp,
} from '../harness/modules.js';

// TASK-203 (specs/design.md 5.26, DEC-148, DEC-149): the engine takes a step's execute capability
// and its submit hooks from the module catalog, and runs the hooks inside its own transaction.

const clock = FakeClock.atWib('2026-11-28 09:00');
const hooked = [
  testModule('Hooked_Ok', {
    onSubmit: async (ctx, tx) => {
      await new DrizzleAuditGateway(tx).write({
        entity: 'spk_assignment',
        entityId: ctx.stepId,
        action: 'hook_ran',
        userId: ctx.actor.user.id,
        userRole: ctx.actor.user.role,
      });
    },
  }),
  testModule('Hooked_Refuse_Input', {
    validateSubmit: () => Promise.resolve({ status: 400, sentence: 'The odometer is missing.' }),
  }),
  testModule('Hooked_Refuse_Conflict', {
    validateSubmit: () => Promise.resolve({ status: 409, sentence: 'The part was taken.' }),
  }),
  testModule('Hooked_Throw', {
    onSubmit: () => Promise.reject(new Error('module failure')),
  }),
];

let engine: EngineApp;
let vehicleId = 0;
let planner = 0;
let mechanic = 0;
let keys = 0;
const key = () => `reg-hooks-${(keys += 1)}`;

const count = async (sql: string, params: unknown[]) =>
  Number((await testPool().query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);
const messageOf = async (response: Response) =>
  ((await response.json()) as { message: string }).message;

beforeAll(async () => {
  engine = await startEngineApp([...MODULES, ...hooked], clock);
  planner = await engine.account('rina', 'Planner');
  mechanic = await engine.account('joko', 'Mechanic');
  await engine.account('yusuf', 'System_Admin');
  await engine.account('sari', 'Accounting');
  vehicleId = await insertVehicle();
  await insertModuleRow(dummyModule.row);
  for (const module of hooked) await insertModuleRow(module.contract.row);
  await insertModuleRow(codelessRow('Mechanic_Action', 'Mechanic Action'));
});

afterAll(async () => {
  await engine.app.close();
});

describe('TASK-203 the engine runs registered modules (REQ-REG-006, DEC-148, DEC-149)', () => {
  it("REQ-REG-006 onSubmit runs in the submit's transaction", async () => {
    const { spkId, stepIds } = await insertSpkWithSteps(vehicleId, planner, ['Hooked_Ok']);
    const response = await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, key());
    expect(response.status).toBe(200);
    expect(await stepStatus(stepIds[0] ?? 0)).toBe('Submitted');
    expect(
      await count(
        `SELECT count(*) AS n FROM audit_logs WHERE action = 'hook_ran' AND entity_id = $1`,
        [stepIds[0]],
      ),
    ).toBe(1);
  });

  it.each([
    ['Hooked_Refuse_Input', 400, 'The odometer is missing.'],
    ['Hooked_Refuse_Conflict', 409, 'The part was taken.'],
  ])(
    'REQ-REG-006 validateSubmit of %s refuses with its status and sentence',
    async (module, status, sentence) => {
      const { spkId, stepIds } = await insertSpkWithSteps(vehicleId, planner, [module]);
      const response = await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, key());
      expect(response.status).toBe(status);
      expect(await messageOf(response)).toBe(sentence);
      expect(await stepStatus(stepIds[0] ?? 0)).toBe('Open');
    },
  );

  it('REQ-REG-006 a throwing onSubmit rolls the whole submit back, and a retry runs again', async () => {
    const { spkId, stepIds } = await insertSpkWithSteps(vehicleId, planner, ['Hooked_Throw']);
    const { rows } = await testPool().query<{ id: string }>(
      `INSERT INTO stored_files (storage_key, profile, mime_type, original_name, status, sha256, uploaded_by)
       VALUES ('test/reg-hooks/1.jpg', 'Photo', 'image/jpeg', 'gauge.jpg', 'Ready', $1, $2) RETURNING id`,
      ['a'.repeat(64), mechanic],
    );
    const fileId = Number(rows[0]?.id);
    const retried = key();
    expect(
      (await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, retried, [fileId])).status,
    ).toBe(500);
    expect(await stepStatus(stepIds[0] ?? 0)).toBe('Open');
    expect(
      await count(
        `SELECT count(*) AS n FROM stored_files WHERE id = $1 AND attached_at IS NOT NULL`,
        [fileId],
      ),
    ).toBe(0);
    expect(
      await count(`SELECT count(*) AS n FROM idempotency_keys WHERE idem_key = $1`, [retried]),
    ).toBe(0);
    expect(
      await count(`SELECT count(*) AS n FROM notifications WHERE dedupe_key LIKE $1`, [
        `spk:${spkId}:%`,
      ]),
    ).toBe(0);
    expect(
      (await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, retried, [fileId])).status,
    ).toBe(500);
  });

  it('REQ-REG-006 DEC-148 a step of a row with no module in code offers no submit and is refused', async () => {
    const { spkId, stepIds } = await insertSpkWithSteps(vehicleId, planner, [
      'Mechanic_Action',
      'Dummy',
    ]);
    const detail = await fetch(`${engine.baseUrl}/spks/${spkId}/detail`, {
      headers: engine.auth('yusuf'),
    });
    const body = (await detail.json()) as SpkDetailResponse;
    expect(body.detail.steps[0]?.allowedActions).toEqual([]);
    const response = await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, key());
    expect(response.status).toBe(403);
    expect(await messageOf(response)).toBe('The module of this step is not available yet.');
    expect(await stepStatus(stepIds[0] ?? 0)).toBe('Open');
  });

  it('REQ-REG-006 the Dummy step of the same kind of SPK still lists submit for its executor', async () => {
    const { spkId } = await insertSpkWithSteps(vehicleId, planner, ['Dummy']);
    const detail = await fetch(`${engine.baseUrl}/spks/${spkId}/detail`, {
      headers: engine.auth('yusuf'),
    });
    const body = (await detail.json()) as SpkDetailResponse;
    expect(body.detail.steps[0]?.allowedActions).toEqual(['submit']);
  });

  it('REQ-ENG-003 a user with no execute capability is refused 403 at the guard, even for an unknown SPK', async () => {
    const unknown = await submitStep(engine, 'sari', 999999, 1, key());
    expect(unknown.status).toBe(403);
    expect(await messageOf(unknown)).toBe('You do not have permission to do this.');
  });
});
