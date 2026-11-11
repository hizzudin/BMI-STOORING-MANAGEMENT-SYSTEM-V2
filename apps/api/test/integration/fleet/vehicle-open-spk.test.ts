import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Vehicle } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { VEHICLE_MESSAGES } from '../../../src/core/fleet/vehicle-service.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import { spkGateways } from '../../../src/infra/db/spk-gateways.js';
import { DrizzleUnitOfWork } from '../../../src/infra/db/unit-of-work.js';
import type { SpkGateways } from '../../../src/ports/spks.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

// DEC-122, DEC-124: the class change rule (REQ-VEH-003, DEC-17) and the deactivation rule
// (REQ-VEH-004) with real open SPKs; nothing overrides the vehicle activity adapter here.
const SEED_FORMATS = /INSERT INTO app_settings[\s\S]*?;/.exec(
  readFileSync(join(import.meta.dirname, '../../../migrations/0009_spks.sql'), 'utf8'),
)?.[0];

const clock = FakeClock.atWib('2026-11-11 08:00');
let app: INestApplication;
let baseUrl: string;
let token = '';
let adminId = 0;
const classIds: number[] = [];

function call(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const vehicleOf = async (response: Response) =>
  ((await response.json()) as { vehicle: Vehicle }).vehicle;

async function openSpk(vehicleId: number): Promise<{ id: number; spkNumber: string }> {
  return new DrizzleUnitOfWork<SpkGateways>(testPool(), spkGateways).run(
    async ({ numbers, spks }) => {
      const spkNumber = await numbers.next('SPK', clock.now());
      const id = await spks.insert({
        vehicleId,
        title: 'Brake check',
        category: 'Corrective',
        requestSource: 'Manual_Admin',
        description: 'Brakes pull to the left',
        createdBy: adminId,
        spkNumber,
      });
      return { id, spkNumber };
    },
  );
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
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  const admin = await insertAccount({ role: 'System_Admin' });
  adminId = admin.id;
  const signedIn = await postJson(baseUrl, '/auth/sign-in', {
    email: admin.email,
    password: admin.password,
    client: 'mobile',
  });
  token = ((await signedIn.json()) as { accessToken: string }).accessToken;
  for (const code of ['Open_Head', 'Open_Rigid']) {
    const created = await call('POST', '/vehicle-classes', {
      code,
      name: code.replace('_', ' '),
      unitKind: 'Powered',
      definition: {
        frontDrawing: 'None',
        spareCount: 0,
        axles: [{ role: 'Steer', tyresPerSide: 1 }],
      },
    });
    expect(created.status).toBe(201);
    classIds.push(((await created.json()) as { vehicleClass: { id: number } }).vehicleClass.id);
  }
});

afterAll(async () => {
  await app.close();
});

describe('Vehicles with open SPKs (REQ-VEH-003, REQ-VEH-004, DEC-17, DEC-122)', () => {
  it('DEC-17 an open SPK locks the class and refuses the deactivation; once Cancelled, both go through', async () => {
    const added = await call('POST', '/vehicles', {
      licensePlate: 'B 9012 KX',
      vin: null,
      engineNumber: null,
      brand: null,
      model: null,
      year: null,
      fuelType: null,
      vehicleClassId: classIds[0],
      odometer: 48210,
    });
    expect(added.status).toBe(201);
    const vehicle = await vehicleOf(added);
    expect(vehicle.classLock).toBeNull();

    const spk = await openSpk(vehicle.id);
    const locked = await vehicleOf(await call('GET', `/vehicles/${vehicle.id}`));
    expect(locked.classLock).toBe(`Class is locked: ${spk.spkNumber} is open.`);
    expect(locked.allowedActions).toEqual(['edit']);

    const edit = {
      licensePlate: locked.licensePlate,
      vin: null,
      engineNumber: null,
      brand: null,
      model: null,
      year: null,
      fuelType: null,
      vehicleClassId: classIds[1],
      reason: 'Wrong class at entry',
      version: locked.version,
    };
    const refused = await call('PATCH', `/vehicles/${vehicle.id}`, edit);
    expect(refused.status).toBe(403);
    expect(((await refused.json()) as { message: string }).message).toBe(locked.classLock);
    const deactivate = await call('POST', `/vehicles/${vehicle.id}/deactivate`, {
      reason: 'Sold',
    });
    expect(deactivate.status).toBe(403);
    expect(((await deactivate.json()) as { message: string }).message).toBe(
      VEHICLE_MESSAGES.openSpk([spk.spkNumber]),
    );

    await testPool().query(
      `UPDATE spks SET status = 'Cancelled', cancel_reason = 'Raised twice' WHERE id = $1`,
      [spk.id],
    );
    const free = await vehicleOf(await call('GET', `/vehicles/${vehicle.id}`));
    expect(free.classLock).toBeNull();
    expect((await call('PATCH', `/vehicles/${vehicle.id}`, edit)).status).toBe(200);
    expect(
      (await call('POST', `/vehicles/${vehicle.id}/deactivate`, { reason: 'Sold' })).status,
    ).toBe(200);
  });
});
