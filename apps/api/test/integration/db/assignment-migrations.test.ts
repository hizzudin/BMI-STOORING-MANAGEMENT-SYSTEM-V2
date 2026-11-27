import { beforeAll, describe, expect, it } from 'vitest';
import { testPool } from '../harness/database.js';
import { insertAccount } from '../iam/auth-harness.js';

// TASK-201: the engine tables of §9.6 and the references DEC-124 left open (DEC-95, DEC-144).

const ENGINE_TABLES = [
  'spk_presets',
  'spk_preset_steps',
  'step_time_events',
  'step_time_corrections',
  'spk_change_requests',
  'mobilisation_location_trail',
  'spk_check_items',
];

let userId = 0;
let assignmentId = 0;
let run = 0;

const query = (sql: string, params: unknown[] = []) => testPool().query(sql, params);

/** One SPK with one step; DEC-144: the dummy module is registered by the tests, never a migration. */
async function insertAssignment(): Promise<number> {
  run += 1;
  const tag = `${Date.now().toString(36)}${run}`.toUpperCase();
  const { rows: layout } = await query(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ($1, $1, '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
    [`L_${tag}`],
  );
  const { rows: klass } = await query(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ($1, $1, $2) RETURNING id`,
    [`C_${tag}`, layout[0]?.id],
  );
  const { rows: vehicle } = await query(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ($1, $2, $3, 0) RETURNING id`,
    [`B ${tag}`, klass[0]?.id, layout[0]?.id],
  );
  await query(
    `INSERT INTO assignment_modules (code, name, ui_component, executor_roles, scope_rules, completion_section, cost_kind)
     VALUES ('Dummy', 'Dummy', 'DummyStep', '{Mechanic}', '{}', '{}', 'None')
     ON CONFLICT (code) DO NOTHING`,
  );
  const { rows: spk } = await query(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status, created_by)
     VALUES ($1, $2, 'Engine table check', 'Corrective', 'Manual_Planner', '', 'Draft', $3) RETURNING id`,
    [`SPK-E${tag}`, vehicle[0]?.id, userId],
  );
  const { rows: step } = await query(
    `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role)
     VALUES ($1, 1, 'Dummy', '{Mechanic}', 'Planner') RETURNING id`,
    [spk[0]?.id],
  );
  return Number(step[0]?.id);
}

async function insertEvent(
  event: string,
  extra: { pauseReason?: string; note?: string } = {},
): Promise<number> {
  const { rows } = await query(
    `INSERT INTO step_time_events (assignment_id, attempt_no, event, at, pause_reason, note, actor_id)
     VALUES ($1, 1, $2, now(), $3, $4, $5) RETURNING id`,
    [assignmentId, event, extra.pauseReason ?? null, extra.note ?? null, userId],
  );
  return Number(rows[0]?.id);
}

beforeAll(async () => {
  userId = (await insertAccount({ role: 'Planner' })).id;
  assignmentId = await insertAssignment();
});

describe('assignment migrations', () => {
  it('DEC-144 the seven engine tables exist with the standard columns of §9.0', async () => {
    const { rows } = await query(
      `SELECT table_name, array_agg(column_name::text) AS columns FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1) GROUP BY table_name`,
      [ENGINE_TABLES],
    );
    expect(rows.map((row) => row.table_name).sort()).toEqual([...ENGINE_TABLES].sort());
    for (const row of rows) {
      expect(row.columns).toEqual(expect.arrayContaining(['id', 'created_at', 'updated_at']));
    }
  });

  it.each([
    ['spks', 'preset_id', 'spk_presets'],
    ['spk_attachments', 'check_item_id', 'spk_check_items'],
    ['spk_approvals', 'change_request_id', 'spk_change_requests'],
  ])('DEC-124 %s.%s now references %s (ON DELETE RESTRICT)', async (table, column, target) => {
    const { rows } = await query(
      `SELECT confrel.relname AS target, c.confdeltype AS on_delete
       FROM pg_constraint c
       JOIN pg_class rel ON rel.oid = c.conrelid
       JOIN pg_class confrel ON confrel.oid = c.confrelid
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
       WHERE c.contype = 'f' AND rel.relname = $1 AND a.attname = $2`,
      [table, column],
    );
    expect(rows).toEqual([{ target, on_delete: 'r' }]);
  });

  it('DEC-87 step_time_events refuses an UPDATE and a DELETE (append-only)', async () => {
    const id = await insertEvent('Open');
    await expect(
      query(`UPDATE step_time_events SET note = 'x' WHERE id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
    await expect(query(`DELETE FROM step_time_events WHERE id = $1`, [id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('DEC-87 step_time_corrections refuses an UPDATE and a DELETE (append-only)', async () => {
    const eventId = await insertEvent('Start');
    const { rows } = await query(
      `INSERT INTO step_time_corrections (event_id, old_at, new_at, reason, corrected_by)
       VALUES ($1, now(), now() - interval '5 minutes', 'Forgot to press Start', $2) RETURNING id`,
      [eventId, userId],
    );
    const id = rows[0]?.id;
    await expect(
      query(`UPDATE step_time_corrections SET reason = 'x' WHERE id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
    await expect(query(`DELETE FROM step_time_corrections WHERE id = $1`, [id])).rejects.toThrow(
      /append-only/,
    );
  });

  it('REQ-MBL-005 mobilisation_location_trail refuses an UPDATE and a DELETE (append-only)', async () => {
    const { rows } = await query(
      `INSERT INTO mobilisation_location_trail (assignment_id, attempt_no, lat, lng, accuracy_m, recorded_at)
       VALUES ($1, 1, -6.200000, 106.816666, 12, now()) RETURNING id`,
      [assignmentId],
    );
    const id = rows[0]?.id;
    await expect(
      query(`UPDATE mobilisation_location_trail SET accuracy_m = 1 WHERE id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
    await expect(
      query(`DELETE FROM mobilisation_location_trail WHERE id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
  });

  it('DEC-87 a Pause needs a pause reason, and the reason Other needs a note', async () => {
    await expect(insertEvent('Pause')).rejects.toThrow(/check constraint/);
    await expect(insertEvent('Pause', { pauseReason: 'Other' })).rejects.toThrow(
      /check constraint/,
    );
    await expect(
      insertEvent('Pause', { pauseReason: 'Other', note: 'Rain stopped the work' }),
    ).resolves.toBeGreaterThan(0);
    await expect(insertEvent('Pause', { pauseReason: 'Waiting_Parts' })).resolves.toBeGreaterThan(
      0,
    );
  });

  it('REQ-REG-003 a preset name and version are unique among non-deleted presets; a deleted one frees the pair', async () => {
    const name = `Preset ${Date.now()}`;
    const insert = () =>
      query(
        `INSERT INTO spk_presets (name, category, created_by) VALUES ($1, 'PM', $2) RETURNING id`,
        [name, userId],
      );
    const { rows } = await insert();
    await expect(insert()).rejects.toThrow(/duplicate key/);
    await query(`UPDATE spk_presets SET deleted_at = now() WHERE id = $1`, [rows[0]?.id]);
    await expect(insert()).resolves.toBeTruthy();
  });

  it('REQ-CHK-002 a check item cannot be unsafe to drive without a decision, nor when it is Good', async () => {
    const insert = (line: number, decision: string | null, unsafe: boolean) =>
      query(
        `INSERT INTO spk_check_items (assignment_id, line_no, label, decision, unsafe_to_drive)
         VALUES ($1, $2, 'Air brake hose, axle 2', $3, $4)`,
        [assignmentId, line, decision, unsafe],
      );
    await expect(insert(1, null, true)).rejects.toThrow(/check constraint/);
    await expect(insert(2, 'Good', true)).rejects.toThrow(/check constraint/);
    await expect(insert(3, 'Replace', true)).resolves.toBeTruthy();
    await expect(insert(4, null, false)).resolves.toBeTruthy();
  });

  it('NFR-15 cr_number_seq exists and counts up', async () => {
    const first = await query(`SELECT nextval('cr_number_seq')::int AS value`);
    const second = await query(`SELECT nextval('cr_number_seq')::int AS value`);
    expect(second.rows[0]?.value).toBe(Number(first.rows[0]?.value) + 1);
  });

  it('DEC-95 assignment_modules.tracks_work_time defaults to true', async () => {
    const { rows } = await query(
      `SELECT tracks_work_time FROM assignment_modules WHERE code = 'Dummy'`,
    );
    expect(rows).toEqual([{ tracks_work_time: true }]);
  });
});
