import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NUMBERING_CONFIG } from '@bmi/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { spkGateways } from '../../../src/infra/db/spk-gateways.js';
import { DrizzleUnitOfWork } from '../../../src/infra/db/unit-of-work.js';
import { NumberingConfigError } from '../../../src/ports/numbering.js';
import type { NewSpk, SpkGateways } from '../../../src/ports/spks.js';
import { testPool } from '../harness/database.js';
import { insertUsers } from '../harness/users.js';

/** The worker setup empties every table, so the numbering_formats row of migration 0009 is written again. */
const SEED_FORMATS = /INSERT INTO app_settings[\s\S]*?;/.exec(
  readFileSync(join(import.meta.dirname, '../../../migrations/0009_spks.sql'), 'utf8'),
)?.[0];

const unitOfWork = () => new DrizzleUnitOfWork<SpkGateways>(testPool(), spkGateways);
// 2026-11-04 01:30 WIB is still 2026-11-03 in UTC: the date part follows WIB (NFR-14).
const earlyWib = new Date('2026-11-03T18:30:00Z');
let creator = 0;
let vehicleId = 0;

async function insertVehicle(plate: string): Promise<number> {
  const code = plate.replace(/\W/g, '');
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ($1, $1, '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
    [`L_${code}`],
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ($1, $1, $2) RETURNING id`,
    [`C_${code}`, layout[0]?.id],
  );
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id) VALUES ($1, $2, $3) RETURNING id`,
    [plate, klass[0]?.id, layout[0]?.id],
  );
  return Number(rows[0]?.id);
}

const draft = (overrides: Partial<NewSpk> = {}): NewSpk => ({
  vehicleId,
  title: 'PM 20.000 km',
  category: 'PM',
  requestSource: 'Manual_Planner',
  description: 'Service at 20.000 km',
  createdBy: creator,
  ...overrides,
});

const insertDraft = (overrides: Partial<NewSpk> = {}) =>
  unitOfWork().run(async ({ numbers, spks }) =>
    spks.insert({ ...draft(overrides), spkNumber: await numbers.next('SPK', earlyWib) }),
  );

const setStatus = (id: number, status: string, reason: string | null = null) =>
  testPool().query(`UPDATE spks SET status = $2, cancel_reason = $3 WHERE id = $1`, [
    id,
    status,
    reason,
  ]);

const running = (spkNumber: string | undefined) => Number(spkNumber?.slice(10));

beforeAll(async () => {
  if (!SEED_FORMATS) throw new Error('migration 0009 has no INSERT of numbering_formats');
  [creator = 0] = await insertUsers(1);
  vehicleId = await insertVehicle('B 1 GW');
});

beforeEach(async () => {
  await testPool().query(`DELETE FROM app_settings WHERE setting_key = 'numbering_formats'`);
  await testPool().query(SEED_FORMATS as string);
});

describe('SPK numbering (NFR-15, DEC-104, DEC-111)', () => {
  it('DEC-111 the migration seeds numbering_formats with NUMBERING_CONFIG of @bmi/shared', async () => {
    const { rows } = await testPool().query<{ setting_value: unknown }>(
      `SELECT setting_value FROM app_settings WHERE setting_key = 'numbering_formats'`,
    );
    expect(rows[0]?.setting_value).toEqual(NUMBERING_CONFIG);
  });

  it('NFR-15 SPK-yymmddNNNN: the WIB date of creation and a running number of at least four digits', async () => {
    const [first, second] = await unitOfWork().run(async ({ numbers }) => [
      await numbers.next('SPK', earlyWib),
      await numbers.next('SPK', earlyWib),
    ]);
    expect(first).toMatch(/^SPK-261104\d{4,}$/);
    expect(running(second)).toBe(running(first) + 1);
  });

  it('DEC-104 a number is never reused: not after a cancel, not after a rolled-back transaction', async () => {
    const id = await insertDraft();
    const cancelled = await unitOfWork().run(({ spks }) => spks.findById(id));
    await setStatus(id, 'Cancelled', 'Duplicate');
    let lost = '';
    await expect(
      unitOfWork().run(async ({ numbers }) => {
        lost = await numbers.next('SPK', earlyWib);
        throw new Error('rolled back');
      }),
    ).rejects.toThrow('rolled back');
    const next = await unitOfWork().run(({ numbers }) => numbers.next('SPK', earlyWib));
    expect(running(lost)).toBeGreaterThan(running(cancelled?.spkNumber));
    expect(running(next)).toBeGreaterThan(running(lost));
  });

  it('DEC-111 the number is built from the stored format; a broken or missing format is refused', async () => {
    await testPool().query(
      `UPDATE app_settings SET setting_value = jsonb_set(setting_value, '{SPK}', '"SPK/{dd-mm-yy}/{NNNN}"')
       WHERE setting_key = 'numbering_formats'`,
    );
    const changed = await unitOfWork().run(({ numbers }) => numbers.next('SPK', earlyWib));
    expect(changed).toMatch(/^SPK\/04-11-26\/\d{4,}$/);

    await testPool().query(
      `UPDATE app_settings SET setting_value = jsonb_set(setting_value, '{SPK}', '"SPK-{yymmdd}"')
       WHERE setting_key = 'numbering_formats'`,
    );
    await expect(
      unitOfWork().run(({ numbers }) => numbers.next('SPK', earlyWib)),
    ).rejects.toBeInstanceOf(NumberingConfigError);
    await testPool().query(`DELETE FROM app_settings WHERE setting_key = 'numbering_formats'`);
    await expect(
      unitOfWork().run(({ numbers }) => numbers.next('SPK', earlyWib)),
    ).rejects.toBeInstanceOf(NumberingConfigError);
  });
});

describe('SpkGateway (§9.6, DEC-124)', () => {
  it('inserts a Draft SPK and reads it back', async () => {
    const id = await insertDraft();
    const row = await unitOfWork().run(({ spks }) => spks.findById(id));
    expect(row).toMatchObject({
      id,
      vehicleId,
      title: 'PM 20.000 km',
      category: 'PM',
      requestSource: 'Manual_Planner',
      priority: 'Normal',
      description: 'Service at 20.000 km',
      status: 'Draft',
      createdBy: creator,
      version: 1,
    });
    expect(row?.spkNumber).toMatch(/^SPK-261104\d{4,}$/);
    expect(await unitOfWork().run(({ spks }) => spks.findById(999999))).toBeNull();
  });

  it('REQ-SCH-001 open SPKs per vehicle: Draft to Pending_Amendment; Rejected, Completed and Cancelled are not open', async () => {
    const vehicle = await insertVehicle('B 3 GW');
    const other = await insertVehicle('B 2 GW');
    const statuses = [
      'Draft',
      'Pending_Approval',
      'Rejected',
      'Active',
      'In_Progress',
      'Pending_Verification',
      'Pending_Amendment',
      'Completed',
      'Cancelled',
    ];
    const numberOf = new Map<string, string>();
    for (const status of statuses) {
      const id = await insertDraft({ vehicleId: vehicle });
      await setStatus(id, status, status === 'Cancelled' ? 'Not needed' : null);
      const row = await unitOfWork().run(({ spks }) => spks.findById(id));
      numberOf.set(status, row?.spkNumber ?? '');
    }
    const open = await unitOfWork().run(({ spks }) => spks.openNumbersByVehicle([vehicle, other]));
    expect(open.get(vehicle)).toEqual(
      [
        'Draft',
        'Pending_Approval',
        'Active',
        'In_Progress',
        'Pending_Verification',
        'Pending_Amendment',
      ].map((status) => numberOf.get(status)),
    );
    expect(open.get(other)).toBeUndefined();
    expect(await unitOfWork().run(({ spks }) => spks.openNumbersByVehicle([]))).toEqual(new Map());
  });

  it('§9.6 the database refuses a cancel without a reason, a report SPK without its report, and a change of an approval', async () => {
    const id = await insertDraft();
    await expect(setStatus(id, 'Cancelled')).rejects.toThrow(/check constraint/);
    await expect(insertDraft({ requestSource: 'Breakdown_Report' })).rejects.toThrow();
    await testPool().query(
      `INSERT INTO spk_approvals (spk_id, stage, action, acted_by, approver_role)
       VALUES ($1, 'Creation', 'Submit', $2, 'Planner')`,
      [id, creator],
    );
    await expect(
      testPool().query(`UPDATE spk_approvals SET note = 'x' WHERE spk_id = $1`, [id]),
    ).rejects.toThrow(/append-only/);
  });
});
