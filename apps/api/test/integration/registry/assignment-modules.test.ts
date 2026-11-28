import type { AssignmentModule, AssignmentModuleListResponse } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MODULES } from '../../../src/app.modules.js';
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
  type EngineApp,
} from '../harness/modules.js';

// TASK-203 (specs/design.md 5.26, DEC-148): the registry routes. REQ-REG-002 offers only active
// rows with a module in code; REQ-REG-005 deactivates and activates with a reason, stops new use
// only, and keeps old SPKs readable and running (BR-10).

const clock = FakeClock.atWib('2026-11-28 10:00');
let engine: EngineApp;
let planner = 0;
let keys = 0;
const key = () => `reg-routes-${(keys += 1)}`;

const list = async (who: string) => {
  const response = await fetch(`${engine.baseUrl}/assignment-modules`, {
    headers: engine.auth(who),
  });
  const items = response.ok ? ((await response.json()) as AssignmentModuleListResponse).items : [];
  return { status: response.status, items };
};
const change = (
  who: string,
  code: string,
  action: 'deactivate' | 'activate',
  body: unknown,
  k = key(),
) =>
  fetch(`${engine.baseUrl}/assignment-modules/${code}/${action}`, {
    method: 'POST',
    headers: { ...engine.auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': k },
    body: JSON.stringify(body),
  });
const messageOf = async (response: Response) =>
  ((await response.json()) as { message: string }).message;
const audits = async (action: string) =>
  (
    await testPool().query<{ reason: string; before: unknown; after: unknown }>(
      `SELECT reason, before, after FROM audit_logs
       WHERE entity = 'assignment_module' AND action = $1 ORDER BY id`,
      [action],
    )
  ).rows;

beforeAll(async () => {
  engine = await startEngineApp(MODULES, clock);
  planner = await engine.account('rina', 'Planner');
  await engine.account('yusuf', 'System_Admin');
  await engine.account('joko', 'Mechanic');
  await insertModuleRow(dummyModule.row);
  await insertModuleRow({ ...codelessRow('Mechanic_Action', 'Mechanic Action'), sortOrder: 1 });
  await insertModuleRow({
    ...codelessRow('Old_Module', 'Old module'),
    isActive: false,
    sortOrder: 2,
  });
});

afterAll(async () => {
  await engine.app.close();
});

describe('TASK-203 registry routes (REQ-REG-002, REQ-REG-005, DEC-148)', () => {
  it('REQ-REG-002 GET /assignment-modules offers only active rows with a module in code', async () => {
    for (const who of ['rina', 'yusuf']) {
      const { status, items } = await list(who);
      expect(status).toBe(200);
      expect(
        items.map((m: AssignmentModule) => [m.code, m.isActive, m.implemented, m.offered]),
      ).toEqual([
        ['Dummy', true, true, true],
        ['Mechanic_Action', true, false, false],
        ['Old_Module', false, false, false],
      ]);
    }
    expect((await list('joko')).status).toBe(403);
  });

  it('REQ-REG-005 deactivate needs a reason, an existing code and registry.manage', async () => {
    const blank = await change('rina', 'Dummy', 'deactivate', { reason: ' ' });
    expect(blank.status).toBe(400);
    const issues = ((await blank.json()) as { issues: { path: string; message: string }[] }).issues;
    expect(issues).toEqual([{ path: 'reason', message: 'Give a reason.' }]);
    const unknown = await change('rina', 'Unknown_Module', 'deactivate', { reason: 'x' });
    expect(unknown.status).toBe(404);
    expect(await messageOf(unknown)).toBe('This module was not found.');
    expect((await change('joko', 'Dummy', 'deactivate', { reason: 'x' })).status).toBe(403);
  });

  it('REQ-REG-005 deactivate stops the offer and activate brings it back, each with an audit record', async () => {
    const off = await change('rina', 'Dummy', 'deactivate', { reason: 'Replaced by a new module' });
    expect(off.status).toBe(200);
    expect(((await off.json()) as AssignmentModule).offered).toBe(false);
    expect((await list('rina')).items.find((m) => m.code === 'Dummy')?.offered).toBe(false);
    const again = await change('rina', 'Dummy', 'deactivate', { reason: 'Twice' });
    expect(again.status).toBe(409);
    expect(await messageOf(again)).toBe('This module is already inactive.');

    const on = await change('yusuf', 'Dummy', 'activate', { reason: 'Still needed' });
    expect(on.status).toBe(200);
    expect((await list('rina')).items.find((m) => m.code === 'Dummy')?.offered).toBe(true);
    expect(await audits('deactivate')).toEqual([
      {
        reason: 'Replaced by a new module',
        before: { isActive: true },
        after: { isActive: false },
      },
    ]);
    expect(await audits('activate')).toEqual([
      { reason: 'Still needed', before: { isActive: false }, after: { isActive: true } },
    ]);
  });

  it('REQ-REG-005 NFR-01 the same Idempotency-Key replays without a second audit record', async () => {
    const k = key();
    expect((await change('rina', 'Dummy', 'deactivate', { reason: 'Retry' }, k)).status).toBe(200);
    expect((await change('rina', 'Dummy', 'deactivate', { reason: 'Retry' }, k)).status).toBe(200);
    expect((await audits('deactivate')).filter((a) => a.reason === 'Retry')).toHaveLength(1);
    expect((await change('rina', 'Dummy', 'activate', { reason: 'Back' })).status).toBe(200);
  });

  it('REQ-REG-005 BR-10 an SPK with a step of a deactivated module stays readable and its running step can still be submitted', async () => {
    const vehicleId = await insertVehicle();
    const { spkId, stepIds } = await insertSpkWithSteps(vehicleId, planner, ['Dummy']);
    expect((await change('rina', 'Dummy', 'deactivate', { reason: 'Retired' })).status).toBe(200);
    const detail = await fetch(`${engine.baseUrl}/spks/${spkId}/detail`, {
      headers: engine.auth('rina'),
    });
    expect(detail.status).toBe(200);
    expect((await submitStep(engine, 'joko', spkId, stepIds[0] ?? 0, key())).status).toBe(200);
    expect(await stepStatus(stepIds[0] ?? 0)).toBe('Submitted');
    expect((await change('rina', 'Dummy', 'activate', { reason: 'Back' })).status).toBe(200);
  });
});
