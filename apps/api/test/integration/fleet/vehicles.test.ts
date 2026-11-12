import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  menuFor,
  type PermissionCode,
  type Role,
  type Vehicle,
  type VehicleListResponse,
} from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  PASSWORD_HASHER,
  PG_POOL,
  VEHICLE_ACTIVITY,
} from '../../../src/app.tokens.js';
import { VEHICLE_MESSAGES } from '../../../src/core/fleet/vehicle-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { VehicleActivity, VehicleActivityGateway } from '../../../src/ports/vehicles.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

/**
 * DEC-122: mounted tyres (TASK-501) and open SPKs (TASK-120) do not exist yet; the rule asks this
 * port, which the test sets per vehicle.
 */
class FakeActivity implements VehicleActivityGateway {
  readonly mountedTyres = new Map<number, number>();
  readonly openSpks = new Map<number, string[]>();
  of(vehicleIds: readonly number[]): Promise<Map<number, VehicleActivity>> {
    return Promise.resolve(
      new Map(
        vehicleIds.map((id) => [
          id,
          { mountedTyres: this.mountedTyres.get(id) ?? 0, openSpks: this.openSpks.get(id) ?? [] },
        ]),
      ),
    );
  }
}

const clock = FakeClock.atWib('2026-11-11 08:00');
const activity = new FakeActivity();
let app: INestApplication;
let baseUrl: string;
let auditFrom = 0;
const tokens = new Map<string, string>();
const classes = new Map<string, { id: number; layoutId: number }>();

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
const message = async (response: Response) => (await json<{ message: string }>(response)).message;

const head = {
  frontDrawing: 'Fifth_wheel',
  spareCount: 1,
  axles: [
    { role: 'Steer', tyresPerSide: 1 },
    { role: 'Drive', tyresPerSide: 2, spacing: 'Wide' },
    { role: 'Drive', tyresPerSide: 2, spacing: 'Close' },
  ],
};
const trailer = {
  frontDrawing: 'Kingpin',
  spareCount: 2,
  axles: [
    { role: 'Trailer', tyresPerSide: 2 },
    { role: 'Trailer', tyresPerSide: 2, spacing: 'Close' },
  ],
};

let plateNo = 1000;
const nextPlate = () => `B ${(plateNo += 1)} KX`;

function addBody(className: string, overrides: Record<string, unknown> = {}) {
  return {
    licensePlate: nextPlate(),
    vin: null,
    engineNumber: null,
    brand: 'Hino',
    model: 'FM 260 JD',
    year: 2022,
    fuelType: 'Diesel',
    vehicleClassId: classes.get(className)?.id,
    odometer: className === 'Trailer tail' ? null : 12400,
    ...overrides,
  };
}

async function add(className: string, overrides: Record<string, unknown> = {}): Promise<Vehicle> {
  const response = await call('yusuf', 'POST', '/vehicles', addBody(className, overrides));
  expect(response.status).toBe(201);
  return (await json<{ vehicle: Vehicle }>(response)).vehicle;
}

function editBody(vehicle: Vehicle, overrides: Record<string, unknown> = {}) {
  return {
    licensePlate: vehicle.licensePlate,
    vin: vehicle.vin,
    engineNumber: vehicle.engineNumber,
    brand: vehicle.brand,
    model: vehicle.model,
    year: vehicle.year,
    fuelType: vehicle.fuelType,
    vehicleClassId: vehicle.vehicleClass.id,
    reason: 'Correct the entry',
    version: vehicle.version,
    ...overrides,
  };
}

async function audits(entityId: number): Promise<{ action: string; reason: string | null }[]> {
  const { rows } = await testPool().query<{ action: string; reason: string | null }>(
    `SELECT action, reason FROM audit_logs WHERE entity = 'vehicle' AND entity_id = $1 AND id > $2 ORDER BY id`,
    [entityId, auditFrom],
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
    .overrideProvider(VEHICLE_ACTIVITY)
    .useValue(activity)
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('yusuf', 'System_Admin');
  await account('rina', 'Planner');
  await account('acc', 'Accounting');
  await account('am', 'Access_Manager');
  for (const [name, code, unitKind, definition] of [
    ['Tractor head', 'Tractor_Head', 'Powered', head],
    ['Trailer tail', 'Trailer_Tail', 'Towed', trailer],
  ] as const) {
    const created = await call('yusuf', 'POST', '/vehicle-classes', {
      code,
      name,
      unitKind,
      definition,
    });
    expect(created.status).toBe(201);
    const { vehicleClass } = await json<{
      vehicleClass: { id: number; layout: { id: number } };
    }>(created);
    classes.set(name, { id: vehicleClass.id, layoutId: vehicleClass.layout.id });
  }
});

beforeEach(async () => {
  const { rows } = await testPool().query<{ last: string | null }>(
    'SELECT max(id)::text AS last FROM audit_logs',
  );
  auditFrom = Number(rows[0]?.last ?? 0);
  activity.mountedTyres.clear();
  activity.openSpks.clear();
});

afterAll(async () => {
  await app.close();
});

describe('Vehicles', () => {
  it('REQ-VEH-002 the System Admin adds a vehicle: counts come from the class layout, one audit record', async () => {
    const vehicle = await add('Tractor head', { vin: 'MHFAA8GS2N0123456', engineNumber: '' });
    expect(vehicle).toMatchObject({
      vin: 'MHFAA8GS2N0123456',
      engineNumber: null,
      vehicleClass: { name: 'Tractor head', unitKind: 'Powered' },
      layout: { id: classes.get('Tractor head')?.layoutId, axleCount: 3, tyreCount: 11 },
      currentOdometer: 12400,
      status: 'Active',
      version: 1,
      classLock: null,
      allowedActions: ['edit', 'change_class', 'deactivate', 'create_spk'],
    });
    expect(await audits(vehicle.id)).toEqual([{ action: 'create', reason: null }]);
  });

  it('REQ-VEH-002 TX-18 a plate or VIN is unique; a Planner cannot add', async () => {
    const first = await add('Tractor head', { vin: 'VIN-UNIQUE-1' });
    const plate = await call(
      'yusuf',
      'POST',
      '/vehicles',
      addBody('Tractor head', { licensePlate: first.licensePlate }),
    );
    expect(plate.status).toBe(409);
    expect(await message(plate)).toBe(VEHICLE_MESSAGES.plateTaken);
    const vin = await call(
      'yusuf',
      'POST',
      '/vehicles',
      addBody('Tractor head', { vin: 'VIN-UNIQUE-1' }),
    );
    expect(vin.status).toBe(409);
    expect(await message(vin)).toBe(VEHICLE_MESSAGES.vinTaken);
    expect((await call('rina', 'POST', '/vehicles', addBody('Tractor head'))).status).toBe(403);
  });

  it('REQ-PLC-018 a Towed unit takes no odometer: it stays 0, and an odometer is refused', async () => {
    const trailerUnit = await add('Trailer tail');
    expect(trailerUnit.currentOdometer).toBe(0);
    const refused = await call(
      'yusuf',
      'POST',
      '/vehicles',
      addBody('Trailer tail', { odometer: 500 }),
    );
    expect(refused.status).toBe(400);
    expect(await message(refused)).toBe(VEHICLE_MESSAGES.towedOdometer);
    const unknown = await call(
      'yusuf',
      'POST',
      '/vehicles',
      addBody('Tractor head', { vehicleClassId: 999999 }),
    );
    expect(unknown.status).toBe(400);
    expect(await message(unknown)).toBe(VEHICLE_MESSAGES.unknownClass);
  });

  it('REQ-VEH-001 everyone with vehicle.view lists vehicles; only vehicle.manage gets the form classes and Add', async () => {
    await add('Tractor head');
    const admin = await json<VehicleListResponse>(await call('yusuf', 'GET', '/vehicles'));
    expect(admin.allowedActions).toEqual(['create']);
    expect(admin.classes.map((c) => c.name)).toEqual(['Tractor head', 'Trailer tail']);
    const planner = await json<VehicleListResponse>(await call('rina', 'GET', '/vehicles'));
    expect(planner.vehicles.length).toBeGreaterThan(0);
    expect(planner.allowedActions).toEqual([]);
    expect(planner.classes).toEqual([]);
    // DEC-126: a Planner may open Create SPK from a vehicle, and nothing else.
    expect(planner.vehicles[0]?.allowedActions).toEqual(['create_spk']);
    const one = planner.vehicles[0] as Vehicle;
    expect((await call('rina', 'GET', `/vehicles/${one.id}`)).status).toBe(200);
    expect((await call('rina', 'GET', '/vehicles/999999')).status).toBe(404);
  });

  it('REQ-VEH-003 an edit needs a reason, writes it to the audit log, and a stale version is refused', async () => {
    const vehicle = await add('Tractor head');
    const response = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${vehicle.id}`,
      editBody(vehicle, { engineNumber: '4D56-AB1234' }),
    );
    expect(response.status).toBe(200);
    const edited = (await json<{ vehicle: Vehicle }>(response)).vehicle;
    expect(edited).toMatchObject({ engineNumber: '4D56-AB1234', version: 2 });
    expect(await audits(vehicle.id)).toEqual([
      { action: 'create', reason: null },
      { action: 'update', reason: 'Correct the entry' },
    ]);
    const stale = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${vehicle.id}`,
      editBody(vehicle, { brand: 'Isuzu' }),
    );
    expect(stale.status).toBe(409);
    const noReason = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${vehicle.id}`,
      editBody(edited, { reason: '' }),
    );
    expect(noReason.status).toBe(400);
  });

  it('REQ-VEH-003 DEC-17 a new class takes the class layout, and is refused while a tyre is mounted or an SPK is open', async () => {
    const free = await add('Tractor head');
    const moved = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${free.id}`,
      editBody(free, { vehicleClassId: classes.get('Trailer tail')?.id }),
    );
    expect(moved.status).toBe(200);
    expect((await json<{ vehicle: Vehicle }>(moved)).vehicle).toMatchObject({
      vehicleClass: { name: 'Trailer tail' },
      layout: { id: classes.get('Trailer tail')?.layoutId },
      currentOdometer: 0,
    });

    const busy = await add('Tractor head');
    activity.mountedTyres.set(busy.id, 10);
    activity.openSpks.set(busy.id, ['SPK-2611040139']);
    const shown = (
      await json<{ vehicle: Vehicle }>(await call('yusuf', 'GET', `/vehicles/${busy.id}`))
    ).vehicle;
    expect(shown.classLock).toBe(
      'Class is locked: 10 tyres are mounted and SPK-2611040139 is open.',
    );
    expect(shown.allowedActions).toEqual(['edit', 'create_spk']);
    const refused = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${busy.id}`,
      editBody(busy, { vehicleClassId: classes.get('Trailer tail')?.id }),
    );
    expect(refused.status).toBe(403);
    expect(await message(refused)).toBe(shown.classLock);
    // The same edit without a class change still goes through.
    const kept = await call(
      'yusuf',
      'PATCH',
      `/vehicles/${busy.id}`,
      editBody(busy, { brand: 'Isuzu' }),
    );
    expect(kept.status).toBe(200);
  });

  it('REQ-VEH-004 BR-10 deactivate with a reason: Inactive, history kept; refused while an SPK is open', async () => {
    const busy = await add('Tractor head');
    activity.openSpks.set(busy.id, ['SPK-2611040139']);
    const refused = await call('yusuf', 'POST', `/vehicles/${busy.id}/deactivate`, {
      reason: 'Sold',
    });
    expect(refused.status).toBe(403);
    expect(await message(refused)).toBe(VEHICLE_MESSAGES.openSpk(['SPK-2611040139']));

    const sold = await add('Tractor head');
    const response = await call('yusuf', 'POST', `/vehicles/${sold.id}/deactivate`, {
      reason: 'Sold',
    });
    expect(response.status).toBe(200);
    const inactive = (await json<{ vehicle: Vehicle }>(response)).vehicle;
    expect(inactive).toMatchObject({
      status: 'Inactive',
      deactivateReason: 'Sold',
      allowedActions: [],
    });
    expect(await audits(sold.id)).toEqual([
      { action: 'create', reason: null },
      { action: 'deactivate', reason: 'Sold' },
    ]);
    expect((await call('yusuf', 'GET', `/vehicles/${sold.id}`)).status).toBe(200);
    const again = await call('yusuf', 'PATCH', `/vehicles/${sold.id}`, editBody(inactive));
    expect(again.status).toBe(403);
  });

  it('DEC-120 DEC-121 the layout and document type pages count the vehicles', async () => {
    type Classes = { classes: { name: string; layout: { vehicleCount: number } }[] };
    const countOf = async () =>
      (await json<Classes>(await call('yusuf', 'GET', '/vehicle-classes'))).classes.find(
        (c) => c.name === 'Trailer tail',
      )?.layout.vehicleCount ?? -1;
    const before = await countOf();
    await add('Trailer tail');
    expect(await countOf()).toBe(before + 1);
    const docs = await json<{ classes: { name: string; vehicleCount: number }[] }>(
      await call('yusuf', 'GET', '/document-types'),
    );
    expect(docs.classes.find((c) => c.name === 'Trailer tail')?.vehicleCount).toBe(before + 1);
  });

  it('AC-IAM-009 removing vehicle.view from Accounting hides Vehicles and GET /vehicles answers 403', async () => {
    expect((await call('acc', 'GET', '/vehicles')).status).toBe(200);
    const removed = await call('am', 'PATCH', '/role-permissions', {
      changes: [{ role: 'Accounting', permissionCode: 'vehicle.view', allowed: false }],
    });
    expect(removed.status).toBe(200);
    const me = await json<{ capabilities: PermissionCode[] }>(await call('acc', 'GET', '/me'));
    expect(me.capabilities).not.toContain('vehicle.view');
    expect(menuFor(new Set(me.capabilities), 'Live').map((i) => i.label)).not.toContain('Vehicles');
    expect((await call('acc', 'GET', '/vehicles')).status).toBe(403);
    await call('am', 'PATCH', '/role-permissions', {
      changes: [{ role: 'Accounting', permissionCode: 'vehicle.view', allowed: true }],
    });
  });
});
