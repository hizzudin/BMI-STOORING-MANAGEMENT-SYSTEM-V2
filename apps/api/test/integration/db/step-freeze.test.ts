import { beforeAll, describe, expect, it } from 'vitest';
import { testPool } from '../harness/database.js';
import { insertAccount } from '../iam/auth-harness.js';

// TASK-202: the steps of an SPK are frozen at approval by a trigger (DEC-145, DEC-146).

/** DEC-146: every column of spk_assignments is either frozen at approval or part of the lifecycle. */
const FROZEN = [
  'spk_id',
  'sequence_no',
  'module',
  'step_config',
  'is_optional',
  'executor_roles',
  'verifier_role',
];
const LIFECYCLE = [
  'id',
  'created_at',
  'updated_at',
  'status',
  'team',
  'location_lat',
  'location_lng',
  'location_accuracy_m',
  'location_captured_at',
  'location_capture',
  'stooring_rate_id',
  'stooring_fee',
  'assigned_to',
  'claimed_at',
  'opened_at',
  'executed_by',
  'started_at',
  'start_entered',
  'attempt_no',
  'worked_seconds',
  'paused_seconds',
  'submitted_at',
  'verified_by',
  'verified_at',
  'self_verified',
  'return_note',
  'skip_reason',
];

let userId = 0;
let vehicleId = 0;
let run = 0;
const query = (sql: string, params: unknown[] = []) => testPool().query(sql, params);

/** An SPK with two steps of the tests' dummy module (DEC-144), in the given status. */
async function spkWithSteps(status: string): Promise<{ spkId: number; stepIds: number[] }> {
  run += 1;
  const { rows } = await query(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status, created_by)
     VALUES ($1, $2, 'Freeze check', 'Corrective', 'Manual_Planner', '', 'Draft', $3) RETURNING id`,
    [`SPK-F${Date.now().toString(36)}${run}`, vehicleId, userId],
  );
  const spkId = Number(rows[0]?.id);
  const { rows: steps } = await query(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role)
     VALUES ($1, 1, 'Dummy', '{Mechanic}', 'Planner'), ($1, 2, 'Dummy', '{Mechanic}', 'Planner')
     RETURNING id`,
    [spkId],
  );
  if (status !== 'Draft') await query(`UPDATE spks SET status = $2 WHERE id = $1`, [spkId, status]);
  return { spkId, stepIds: steps.map((step) => Number(step.id)) };
}

beforeAll(async () => {
  userId = (await insertAccount({ role: 'Planner' })).id;
  const tag = Date.now().toString(36).toUpperCase();
  const { rows: layout } = await query(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ($1, $1, '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
    [`LF_${tag}`],
  );
  const { rows: klass } = await query(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ($1, $1, $2) RETURNING id`,
    [`CF_${tag}`, layout[0]?.id],
  );
  const { rows: vehicle } = await query(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ($1, $2, $3, 0) RETURNING id`,
    [`B F${tag}`, klass[0]?.id, layout[0]?.id],
  );
  vehicleId = Number(vehicle[0]?.id);
  await query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Dummy', 'Dummy', 'DummyStep', '{Mechanic}', '{}', '{}', 'None')
     ON CONFLICT (code) DO NOTHING`,
  );
});

describe('DEC-145 steps frozen at approval', () => {
  it('DEC-146 every spk_assignments column is listed as frozen or lifecycle', async () => {
    const { rows } = await query(
      `SELECT column_name::text AS name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'spk_assignments'`,
    );
    expect(rows.map((row) => row.name).sort()).toEqual([...FROZEN, ...LIFECYCLE].sort());
  });

  it('DEC-145 a Draft or Rejected SPK may still change its steps', async () => {
    for (const status of ['Draft', 'Rejected']) {
      const { stepIds } = await spkWithSteps(status);
      await expect(
        query(`UPDATE spk_assignments SET step_config = '{"x":1}' WHERE id = $1`, [stepIds[0]]),
      ).resolves.toBeTruthy();
    }
  });

  it.each([
    ['module', `'Other'`],
    ['sequence_no', '9'],
    ['step_config', `'{"x":1}'`],
    ['is_optional', 'true'],
    ['executor_roles', `'{Planner}'`],
    ['verifier_role', `'System_Admin'`],
  ])('DEC-145 after approval an UPDATE of %s is refused', async (column, value) => {
    const { stepIds } = await spkWithSteps('Active');
    await expect(
      query(`UPDATE spk_assignments SET ${column} = ${value} WHERE id = $1`, [stepIds[0]]),
    ).rejects.toThrow(/frozen/);
  });

  it('DEC-146 after approval moving a step to another SPK (spk_id) is refused', async () => {
    const { stepIds } = await spkWithSteps('Active');
    const { spkId: other } = await spkWithSteps('Draft');
    await expect(
      query(`UPDATE spk_assignments SET spk_id = $2 WHERE id = $1`, [stepIds[0], other]),
    ).rejects.toThrow(/frozen/);
  });

  it('DEC-146 an INSERT and a DELETE of a step of an Active SPK are refused', async () => {
    const { spkId, stepIds } = await spkWithSteps('Active');
    await expect(
      query(
        `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role)
         VALUES ($1, 3, 'Dummy', '{Mechanic}', 'Planner')`,
        [spkId],
      ),
    ).rejects.toThrow(/frozen/);
    await expect(query(`DELETE FROM spk_assignments WHERE id = $1`, [stepIds[1]])).rejects.toThrow(
      /frozen/,
    );
  });

  it('DEC-145 the lifecycle columns stay writable after approval', async () => {
    const { stepIds } = await spkWithSteps('In_Progress');
    await expect(
      query(
        `UPDATE spk_assignments SET status = 'Submitted', submitted_at = now(), executed_by = $2 WHERE id = $1`,
        [stepIds[0], userId],
      ),
    ).resolves.toBeTruthy();
  });

  it('DEC-146 bmi.step_revision lets a change request revision through, inside its transaction only', async () => {
    const { stepIds } = await spkWithSteps('Pending_Amendment');
    const client = await testPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL bmi.step_revision = 'on'`);
      await client.query(`UPDATE spk_assignments SET step_config = '{"rev":2}' WHERE id = $1`, [
        stepIds[0],
      ]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    await expect(
      query(`UPDATE spk_assignments SET step_config = '{"rev":3}' WHERE id = $1`, [stepIds[0]]),
    ).rejects.toThrow(/frozen/);
  });
});
