import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { DocumentType, DocumentTypeListResponse, Role } from '@bmi/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { CLOCK, EMAIL, PASSWORD_HASHER, PG_POOL } from '../../../src/app.tokens.js';
import { DOCUMENT_TYPE_MESSAGES } from '../../../src/core/fleet/document-type-service.js';
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
const classIds: number[] = [];

/** The worker setup empties every table, so the launch types of migration 0007 are written again. */
const LAUNCH_TYPES = /INSERT INTO document_types[\s\S]*?;/.exec(
  readFileSync(join(import.meta.dirname, '../../../migrations/0007_document_types.sql'), 'utf8'),
)?.[0];

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

async function list(): Promise<DocumentTypeListResponse> {
  const response = await call('yusuf', 'GET', '/document-types');
  expect(response.status).toBe(200);
  return json<DocumentTypeListResponse>(response);
}

const byCode = async (code: string) =>
  (await list()).documentTypes.find((t) => t.code === code) as DocumentType;

async function audits(): Promise<string[]> {
  const { rows } = await testPool().query<{ action: string }>(
    `SELECT action FROM audit_logs WHERE entity = 'document_type' AND id > $1 ORDER BY id`,
    [auditFrom],
  );
  return rows.map((row) => row.action);
}

beforeAll(async () => {
  if (!LAUNCH_TYPES) throw new Error('migration 0007 has no INSERT of the launch types');
  await seedRolePermissions();
  await testPool().query(LAUNCH_TYPES);
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
  for (const [code, name] of [
    ['Tractor_Head', 'Tractor head'],
    ['Wingbox_Rigid', 'Wingbox rigid'],
  ]) {
    const created = await call('yusuf', 'POST', '/vehicle-classes', {
      code,
      name,
      unitKind: 'Powered',
      definition: {
        frontDrawing: 'None',
        spareCount: 0,
        axles: [{ role: 'Steer', tyresPerSide: 1 }],
      },
    });
    classIds.push((await json<{ vehicleClass: { id: number } }>(created)).vehicleClass.id);
  }
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

describe('Document types', () => {
  it('REQ-DOC-001 DEC-121 the four launch types are there: 30 warning days, receipt required, no class yet', async () => {
    const page = await list();
    expect(page.allowedActions).toEqual(['create', 'edit', 'deactivate']);
    expect(page.classes.map((c) => c.name)).toEqual(['Tractor head', 'Wingbox rigid']);
    const launch = page.documentTypes
      .filter((t) => ['STNK_Annual', 'STNK_5Year', 'KIR', 'Insurance'].includes(t.code))
      .map((t) => [t.code, t.usualValidityMonths, t.warningDays, t.receiptRequired, t.classIds]);
    expect(launch).toEqual(
      expect.arrayContaining([
        ['STNK_Annual', 12, 30, true, []],
        ['STNK_5Year', 60, 30, true, []],
        ['KIR', 6, 30, true, []],
        ['Insurance', 12, 30, true, []],
      ]),
    );
    expect(launch).toHaveLength(4);
  });

  it('REQ-DOC-002 only the System Admin maintains document types', async () => {
    expect((await call('rina', 'GET', '/document-types')).status).toBe(403);
    const kir = await byCode('KIR');
    const refused = await call('rina', 'PATCH', `/document-types/${kir.id}`, {
      name: 'KIR',
      usualValidityMonths: 6,
      warningDays: 10,
      receiptRequired: true,
      classIds: [],
    });
    expect(refused.status).toBe(403);
  });

  it('REQ-DOC-002 DEC-20 an edit sets warning days, validity, receipt and the required classes, with one audit record', async () => {
    const kir = await byCode('KIR');
    const response = await call('yusuf', 'PATCH', `/document-types/${kir.id}`, {
      name: 'KIR (six-monthly)',
      usualValidityMonths: 6,
      warningDays: 45,
      receiptRequired: false,
      classIds: classIds,
    });
    expect(response.status).toBe(200);
    expect((await json<{ documentType: DocumentType }>(response)).documentType).toMatchObject({
      code: 'KIR',
      name: 'KIR (six-monthly)',
      warningDays: 45,
      receiptRequired: false,
      classIds: [...classIds].sort((a, b) => a - b),
    });
    expect((await byCode('KIR')).warningDays).toBe(45);
    expect(await audits()).toEqual(['update']);
  });

  it('C-31 New document type: a typed code, unique without regard to case; classes must exist', async () => {
    const body = {
      code: 'Izin_Trayek',
      name: 'Izin trayek',
      usualValidityMonths: 60,
      warningDays: 30,
      receiptRequired: true,
      classIds: [classIds[0]],
    };
    const created = await call('yusuf', 'POST', '/document-types', body);
    expect(created.status).toBe(201);
    expect((await json<{ documentType: DocumentType }>(created)).documentType).toMatchObject({
      code: 'Izin_Trayek',
      classIds: [classIds[0]],
    });
    const again = await call('yusuf', 'POST', '/document-types', { ...body, code: 'izin_trayek' });
    expect(again.status).toBe(409);
    expect((await json<{ message: string }>(again)).message).toBe(DOCUMENT_TYPE_MESSAGES.codeTaken);
    const unknown = await call('yusuf', 'POST', '/document-types', {
      ...body,
      code: 'Other',
      classIds: [999999],
    });
    expect(unknown.status).toBe(400);
    expect((await json<{ message: string }>(unknown)).message).toBe(
      DOCUMENT_TYPE_MESSAGES.unknownClass,
    );
    expect(await audits()).toEqual(['create']);
  });

  it('C-32 Deactivate: the type leaves the list and is no longer offered; a second time is 404', async () => {
    const insurance = await byCode('Insurance');
    const response = await call('yusuf', 'POST', `/document-types/${insurance.id}/deactivate`);
    expect(response.status).toBe(200);
    expect((await list()).documentTypes.map((t) => t.code)).not.toContain('Insurance');
    expect((await call('yusuf', 'POST', `/document-types/${insurance.id}/deactivate`)).status).toBe(
      404,
    );
    expect(await audits()).toEqual(['deactivate']);
  });
});
