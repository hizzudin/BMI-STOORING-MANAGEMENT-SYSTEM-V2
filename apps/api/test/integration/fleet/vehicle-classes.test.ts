import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, VehicleClass, VehicleClassListResponse } from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { VEHICLE_CLASS_MESSAGES } from '../../../src/core/fleet/vehicle-class-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

const clock = FakeClock.atWib('2026-11-11 08:00');
let app: INestApplication;
let baseUrl: string;
let auditFrom = 0;
const tokens = new Map<string, string>();

async function account(key: string, role: Role): Promise<void> {
  const created = await insertAccount({ role });
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

const trailer3 = {
  frontDrawing: 'Kingpin',
  spareCount: 1,
  axles: [
    { role: 'Trailer', tyresPerSide: 2 },
    { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
    { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
  ],
};

const powered8x4 = {
  frontDrawing: 'None',
  spareCount: 0,
  axles: [
    { role: 'Steer', tyresPerSide: 1 },
    { role: 'Steer', tyresPerSide: 1, spacing: 'Close' },
    { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
    { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
  ],
};

async function create(body: Record<string, unknown>): Promise<Response> {
  return call('yusuf', 'POST', '/vehicle-classes', body);
}

async function positionsOf(layoutId: number): Promise<string[]> {
  const { rows } = await testPool().query<{ code: string }>(
    'SELECT code FROM part_positions WHERE chassis_layout_id = $1 ORDER BY id',
    [layoutId],
  );
  return rows.map((row) => row.code);
}

async function audits(): Promise<{ entity: string; action: string }[]> {
  const { rows } = await testPool().query<{ entity: string; action: string }>(
    `SELECT entity, action FROM audit_logs WHERE entity = 'vehicle_class' AND id > $1 ORDER BY id`,
    [auditFrom],
  );
  return rows;
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
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('yusuf', 'System_Admin');
  await account('rina', 'Planner');
  await account('am', 'Access_Manager');
});

beforeEach(async () => {
  const { rows } = await testPool().query<{ last: string | null }>(
    'SELECT max(id)::text AS last FROM audit_logs',
  );
  auditFrom = Number(rows[0]?.last ?? 0);
});

afterAll(async () => {
  await app.close();
});

describe('Vehicle classes and chassis layouts', () => {
  it('REQ-PLC-013 only the System Admin manages classes and layouts', async () => {
    for (const who of ['rina', 'am']) {
      expect((await call(who, 'GET', '/vehicle-classes')).status, who).toBe(403);
      const refused = await call(who, 'POST', '/vehicle-classes', {
        code: 'Nope',
        name: 'Nope',
        unitKind: 'Powered',
        definition: powered8x4,
      });
      expect(refused.status, who).toBe(403);
    }
    const list = await json<VehicleClassListResponse>(
      await call('yusuf', 'GET', '/vehicle-classes'),
    );
    expect(list.allowedActions).toEqual(['create', 'new_layout_version']);
  });

  it('AC-PLC-007 a Towed class with 3 dual Trailer axles and 1 spare generates 13 positions, A1_LO to A3_RO and SP1', async () => {
    const response = await create({
      code: 'Trailer_Tail_3',
      name: 'Trailer tail 3 axles',
      unitKind: 'Towed',
      definition: trailer3,
    });
    expect(response.status).toBe(201);
    const { vehicleClass } = await json<{ vehicleClass: VehicleClass }>(response);
    expect(vehicleClass).toMatchObject({
      code: 'Trailer_Tail_3',
      unitKind: 'Towed',
      layout: { code: 'Trailer_Tail_3', version: 1, axleCount: 3, tyreCount: 13 },
    });
    expect(vehicleClass.layout.definition.frontDrawing).toBe('Kingpin');
    const codes = await positionsOf(vehicleClass.layout.id);
    expect(codes).toHaveLength(13);
    expect(codes[0]).toBe('A1_LO');
    expect(codes[11]).toBe('A3_RO');
    expect(codes[12]).toBe('SP1');
    expect(await audits()).toEqual([{ entity: 'vehicle_class', action: 'create' }]);
  });

  it('AC-PLC-010 a class outside the launch list, a Powered 8x4 with no spare, is data: 12 positions, no code change', async () => {
    const response = await create({
      code: 'Powered_8x4',
      name: 'Powered 8x4',
      unitKind: 'Powered',
      definition: powered8x4,
    });
    expect(response.status).toBe(201);
    const { vehicleClass } = await json<{ vehicleClass: VehicleClass }>(response);
    expect(await positionsOf(vehicleClass.layout.id)).toEqual([
      'A1_L',
      'A1_R',
      'A2_L',
      'A2_R',
      'A3_LO',
      'A3_LI',
      'A3_RI',
      'A3_RO',
      'A4_LO',
      'A4_LI',
      'A4_RI',
      'A4_RO',
    ]);
  });

  it('DEC-120 Save as new layout version keeps the old version and its positions; the class takes the new one', async () => {
    const created = await json<{ vehicleClass: VehicleClass }>(
      await create({
        code: 'Pickup_Patrol',
        name: 'Pickup patrol',
        unitKind: 'Powered',
        definition: {
          frontDrawing: 'None',
          spareCount: 1,
          axles: [
            { role: 'Steer', tyresPerSide: 1 },
            { role: 'Drive', tyresPerSide: 1, spacing: 'Wide' },
          ],
        },
      }),
    );
    const v1 = created.vehicleClass.layout;
    const response = await call(
      'yusuf',
      'POST',
      `/vehicle-classes/${created.vehicleClass.id}/layouts`,
      {
        definition: { ...v1.definition, spareCount: 2 },
      },
    );
    expect(response.status).toBe(201);
    const { vehicleClass } = await json<{ vehicleClass: VehicleClass }>(response);
    expect(vehicleClass.layout).toMatchObject({ code: 'Pickup_Patrol', version: 2, tyreCount: 6 });
    expect(await positionsOf(vehicleClass.layout.id)).toEqual([
      'A1_L',
      'A1_R',
      'A2_L',
      'A2_R',
      'SP1',
      'SP2',
    ]);
    expect(await positionsOf(v1.id)).toEqual(['A1_L', 'A1_R', 'A2_L', 'A2_R', 'SP1']);
    expect((await audits()).map((row) => row.action)).toEqual(['create', 'new_layout_version']);
    const listed = (
      await json<VehicleClassListResponse>(await call('yusuf', 'GET', '/vehicle-classes'))
    ).classes.find((c) => c.code === 'Pickup_Patrol');
    expect(listed?.layout.version).toBe(2);
  });

  it('TX-18 a class code is unique; an unknown class is 404; a bad layout is 400', async () => {
    const body = {
      code: 'Wingbox_Rigid',
      name: 'Wingbox',
      unitKind: 'Powered',
      definition: powered8x4,
    };
    expect((await create(body)).status).toBe(201);
    const again = await create({ ...body, code: 'wingbox_rigid' });
    expect(again.status).toBe(409);
    expect((await json<{ message: string }>(again)).message).toBe(VEHICLE_CLASS_MESSAGES.codeTaken);
    expect(
      (await call('yusuf', 'POST', '/vehicle-classes/999999/layouts', { definition: powered8x4 }))
        .status,
    ).toBe(404);
    const bad = await create({
      ...body,
      code: 'Empty_Layout',
      definition: { ...powered8x4, axles: [] },
    });
    expect(bad.status).toBe(400);
  });
});
