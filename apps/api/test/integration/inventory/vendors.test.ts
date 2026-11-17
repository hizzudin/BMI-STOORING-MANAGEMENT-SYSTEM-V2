import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role, VendorListResponse, VendorOptionsResponse, VendorResponse } from '@bmi/shared';
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
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import { seedRolePermissions } from '../harness/role-permissions.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

const clock = FakeClock.atWib('2026-11-17 08:00');
let app: INestApplication;
let baseUrl: string;
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
    headers: {
      authorization: `Bearer ${tokens.get(who)}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const json = async <T>(response: Response) => (await response.json()) as T;
const message = async (response: Response) => (await json<{ message: string }>(response)).message;
const audits = async (id: number) =>
  (
    await testPool().query<{ action: string; before: unknown; after: unknown }>(
      `SELECT action, before, after FROM audit_logs WHERE entity = 'vendor' AND entity_id = $1 ORDER BY id`,
      [id],
    )
  ).rows;

const supplier = {
  code: 'SUMBER_FILTER',
  name: 'PT Sumber Filter',
  kind: 'Supplier',
  phone: '021-555-0101',
  address: 'Jl. Industri 12, Cikarang',
};

async function create(body: Record<string, unknown>): Promise<number> {
  const response = await call('admin', 'POST', '/vendors', body);
  expect(response.status).toBe(201);
  return (await json<VendorResponse>(response)).vendor.id;
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
    .overrideProvider(PLANNER_APPROVAL_END)
    .useValue(new NoScheduler())
    .compile();
  app = moduleRef.createNestApplication();
  await app.listen(0);
  baseUrl = await app.getUrl();
  await account('admin', 'System_Admin');
  await account('planner', 'Planner');
  await account('warehouse', 'Warehouse_Manager');
});

afterAll(async () => {
  await app.close();
});

describe('Vendor master (REQ-INV-014, DEC-134)', () => {
  it('REQ-INV-014 the System Admin creates a vendor with its fields; one audit record', async () => {
    const id = await create(supplier);
    const list = await json<VendorListResponse>(await call('admin', 'GET', '/vendors'));
    expect(list.vendors).toEqual([{ id, ...supplier, isActive: true }]);
    expect(list.allowedActions).toEqual(['create', 'edit', 'deactivate', 'activate']);
    expect(await audits(id)).toEqual([
      { action: 'create', before: null, after: expect.objectContaining({ code: 'SUMBER_FILTER' }) },
    ]);
  });

  it('DEC-134 a code is unique whatever its case', async () => {
    const response = await call('admin', 'POST', '/vendors', {
      ...supplier,
      code: 'sumber_filter',
    });
    expect(response.status).toBe(409);
    expect(await message(response)).toBe('This code is taken.');
  });

  it('DEC-134 an edit changes the fields but never the code; one audit record', async () => {
    const id = await create({
      ...supplier,
      code: 'JAYA_WS',
      name: 'Bengkel Jaya',
      kind: 'Workshop',
    });
    const response = await call('admin', 'PATCH', `/vendors/${id}`, {
      code: 'CHANGED',
      name: 'Bengkel Jaya Abadi',
      kind: 'Workshop',
      phone: '021-555-0199',
      address: null,
    });
    expect(response.status).toBe(200);
    expect((await json<VendorResponse>(response)).vendor).toEqual({
      id,
      code: 'JAYA_WS',
      name: 'Bengkel Jaya Abadi',
      kind: 'Workshop',
      phone: '021-555-0199',
      address: null,
      isActive: true,
    });
    expect((await audits(id)).map((row) => row.action)).toEqual(['create', 'update']);
  });

  it('DEC-134 a deactivated vendor stays listed as inactive and can be activated again', async () => {
    const id = await create({
      ...supplier,
      code: 'VULKAN',
      name: 'Vulkanisir Jaya',
      kind: 'Retread',
    });
    expect((await call('admin', 'POST', `/vendors/${id}/deactivate`)).status).toBe(200);
    const listed = (await json<VendorListResponse>(await call('admin', 'GET', '/vendors'))).vendors;
    expect(listed.find((vendor) => vendor.id === id)?.isActive).toBe(false);
    expect((await call('admin', 'POST', `/vendors/${id}/activate`)).status).toBe(200);
    const again = (await json<VendorListResponse>(await call('admin', 'GET', '/vendors'))).vendors;
    expect(again.find((vendor) => vendor.id === id)?.isActive).toBe(true);
    expect((await audits(id)).map((row) => row.action)).toEqual([
      'create',
      'deactivate',
      'activate',
    ]);
    expect((await call('admin', 'PATCH', '/vendors/999999', supplier)).status).toBe(404);
  });

  it('REQ-INV-014 only the System Admin keeps vendors: a Planner is refused', async () => {
    expect((await call('planner', 'GET', '/vendors')).status).toBe(403);
    expect((await call('planner', 'POST', '/vendors', { ...supplier, code: 'P1' })).status).toBe(
      403,
    );
  });

  it('REQ-INV-014 the pick list holds only active vendors, by name, of one kind when asked', async () => {
    const shop = await create({ ...supplier, code: 'TOKO_A', name: 'Abadi Shop', kind: 'Shop' });
    const gone = await create({
      ...supplier,
      code: 'OLD_SUP',
      name: 'Old Supplier',
      kind: 'Supplier',
    });
    await call('admin', 'POST', `/vendors/${gone}/deactivate`);

    const all = await call('warehouse', 'GET', '/vendors/options');
    expect(all.status).toBe(200);
    const names = (await json<VendorOptionsResponse>(all)).vendors.map((vendor) => vendor.name);
    expect(names).toEqual([
      'Abadi Shop',
      'Bengkel Jaya Abadi',
      'PT Sumber Filter',
      'Vulkanisir Jaya',
    ]);

    const shops = await json<VendorOptionsResponse>(
      await call('warehouse', 'GET', '/vendors/options?kind=Shop'),
    );
    expect(shops.vendors).toEqual([{ id: shop, code: 'TOKO_A', name: 'Abadi Shop', kind: 'Shop' }]);
    expect((await call('planner', 'GET', '/vendors/options')).status).toBe(403);
  });
});
