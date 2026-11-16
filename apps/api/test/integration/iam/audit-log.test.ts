import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AccessHistoryResponse, AuditLogDetail, AuditLogResponse, Role } from '@bmi/shared';
import ExcelJS from 'exceljs';
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

// Today is 2026-11-16 WIB, so the default window is 2026-11-10 to 2026-11-16 (DEC-131).
const clock = FakeClock.atWib('2026-11-16 08:00');
let app: INestApplication;
let baseUrl: string;
const tokens = new Map<string, string>();
const ids = new Map<string, number>();
const rows = new Map<string, number>();

async function account(key: string, role: Role, name: string): Promise<void> {
  const created = await insertAccount({ role });
  ids.set(key, created.id);
  await testPool().query('UPDATE users SET name = $1 WHERE id = $2', [name, created.id]);
  const response = await postJson(baseUrl, '/auth/sign-in', {
    email: created.email,
    password: created.password,
    client: 'mobile',
  });
  tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
}

function get(who: string, path: string, query: Record<string, string> = {}): Promise<Response> {
  const url = new URL(`${baseUrl}${path}`);
  url.search = new URLSearchParams(query).toString();
  return fetch(url, { headers: { authorization: `Bearer ${tokens.get(who)}` } });
}

const json = async <T>(response: Response) => (await response.json()) as T;
const page = async (who: string, query: Record<string, string> = {}) => {
  const response = await get(who, '/audit-logs', query);
  expect(response.status).toBe(200);
  return json<AuditLogResponse>(response);
};
const keysOf = (result: { items: { id: number }[] }) =>
  result.items.map((item) => [...rows].find(([, id]) => id === item.id)?.[0] ?? `#${item.id}`);

/** One audit record written straight to the table, at a WIB time (timestamps hold UTC). */
async function audit(
  key: string,
  values: {
    at: string;
    entity: string;
    entityId: number;
    action: string;
    by: string | null;
    role?: Role | null;
    before?: unknown;
    after?: unknown;
    reason?: string;
    self?: boolean;
  },
): Promise<void> {
  const { rows: inserted } = await testPool().query<{ id: string }>(
    `INSERT INTO audit_logs (entity, entity_id, action, before, after, reason, user_id, user_role,
       self_decision, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::timestamptz AT TIME ZONE 'UTC') RETURNING id`,
    [
      values.entity,
      values.entityId,
      values.action,
      values.before === undefined ? null : JSON.stringify(values.before),
      values.after === undefined ? null : JSON.stringify(values.after),
      values.reason ?? null,
      values.by ? ids.get(values.by) : null,
      values.role ?? null,
      values.self ?? false,
      `${values.at.replace(' ', 'T')}:00+07:00`,
    ],
  );
  rows.set(key, Number(inserted[0]?.id));
}

async function insertSpk(spkNumber: string): Promise<number> {
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ('L_AUDIT', 'L_AUDIT', '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ('C_AUDIT', 'Tractor head', $1) RETURNING id`,
    [layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ('B 9012 KX', $1, $2, 48210) RETURNING id`,
    [klass[0]?.id, layout[0]?.id],
  );
  const { rows: spk } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       priority, created_by)
     VALUES ($1, $2, 'Brake overhaul', 'PM', 'Manual_Planner', 'Test', 'Active', 'Normal', $3)
     RETURNING id`,
    [spkNumber, vehicle[0]?.id, ids.get('admin')],
  );
  return Number(spk[0]?.id);
}

const exportLogs = async () =>
  (
    await testPool().query<{
      user_id: string;
      export_type: string;
      file_format: string;
      parameters: unknown;
    }>('SELECT user_id, export_type, file_format, parameters FROM export_logs ORDER BY id')
  ).rows;

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
  await account('admin', 'System_Admin', 'Yusuf');
  await account('am', 'Access_Manager', 'Dewi');
  await account('gm', 'GM', 'Hendra');
  await account('rina', 'Planner', 'Rina');
  await account('evil', 'Planner', '=2+3');
  const spkId = await insertSpk('SPK-2611150001');

  // Inside the default window, newest first: switch, approve, role, end, vehicle, matrix.
  await audit('switch', {
    at: '2026-11-16 07:00',
    entity: 'planner_approval',
    entityId: 1,
    action: 'switch_on',
    by: 'am',
    role: 'Access_Manager',
    before: { kinds: [], until: null },
    after: { kinds: ['spk_creation'], until: '2026-11-16T11:00:00.000Z' },
    reason: 'Supervisor on leave',
  });
  await audit('approve', {
    at: '2026-11-15 10:00',
    entity: 'spk',
    entityId: spkId,
    action: 'approve',
    by: 'admin',
    role: 'System_Admin',
    before: { status: 'Pending_Approval' },
    after: { status: 'Active' },
    self: true,
  });
  await audit('role', {
    at: '2026-11-14 09:00',
    entity: 'user',
    entityId: ids.get('rina') ?? 0,
    action: 'role_change',
    by: 'am',
    role: 'Access_Manager',
    before: { name: 'Rina', email: 'rina@bmi.test', role: 'Planner', isActive: true },
    after: { name: 'Rina', email: 'rina@bmi.test', role: 'Supervisor', isActive: true },
  });
  await audit('end', {
    at: '2026-11-13 18:00',
    entity: 'planner_approval',
    entityId: 1,
    action: 'end',
    by: null,
    before: { kinds: ['spk_creation'], until: '2026-11-13T11:00:00.000Z' },
    after: { kinds: [], until: null },
    reason: 'Planner approval ended at its end time.',
  });
  await audit('vehicle', {
    at: '2026-11-12 12:00',
    entity: 'vehicle',
    entityId: 1,
    action: 'update',
    by: 'admin',
    role: 'System_Admin',
    before: { licensePlate: 'B 9012 KX', currentOdometer: 48000, status: 'Active' },
    after: { licensePlate: 'B 9012 KX', currentOdometer: 48210, status: 'Active' },
  });
  // 00:30 WIB on 2026-11-10 is still 2026-11-09 in UTC: inside the window (NFR-14).
  await audit('matrix', {
    at: '2026-11-10 00:30',
    entity: 'role_permissions',
    entityId: 0,
    action: 'change',
    by: 'am',
    role: 'Access_Manager',
    before: { Planner: { 'spk.create': true } },
    after: { Planner: { 'spk.create': false } },
  });
  // 23:30 WIB on 2026-11-09: outside the window.
  await audit('move', {
    at: '2026-11-09 23:30',
    entity: 'user',
    entityId: ids.get('admin') ?? 0,
    action: 'move_system_admin',
    by: 'am',
    role: 'Access_Manager',
    before: { systemAdminId: ids.get('rina'), role: 'Planner' },
    after: { systemAdminId: ids.get('admin') },
    reason: 'Rina moved to the workshop',
  });
  for (let n = 1; n <= 12; n += 1) {
    await audit(`class${n}`, {
      at: `2026-11-05 ${String(8 + n).padStart(2, '0')}:00`,
      entity: 'vehicle_class',
      entityId: n,
      action: 'create',
      by: 'admin',
      role: 'System_Admin',
      after: { code: `CLASS_${n}`, name: `Class ${n}` },
    });
  }
  await audit('evil', {
    at: '2026-11-03 09:00',
    entity: 'user',
    entityId: ids.get('evil') ?? 0,
    action: 'edit',
    by: 'am',
    role: 'Access_Manager',
    before: { name: 'Budi', email: 'b@bmi.test', role: 'Planner', isActive: true },
    after: { name: '=2+3', email: 'b@bmi.test', role: 'Planner', isActive: true },
  });
  await audit('doctype', {
    at: '2026-11-01 10:00',
    entity: 'document_type',
    entityId: 1,
    action: 'create',
    by: 'admin',
    role: 'System_Admin',
    after: { code: 'STNK', name: 'STNK' },
  });
});

afterAll(async () => {
  await app.close();
});

describe('Audit log (REQ-IAM-007, NFR-02, DEC-131)', () => {
  it('REQ-IAM-007 shows the last 7 WIB days by default, newest first', async () => {
    const result = await page('admin');
    expect(keysOf(result)).toEqual(['switch', 'approve', 'role', 'end', 'vehicle', 'matrix']);
    expect(result.range).toEqual({ from: '2026-11-10', to: '2026-11-16' });
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 6, totalPages: 1 });
  });

  it('REQ-IAM-007 each row has user, role, area, record, before, after and the Self flag', async () => {
    const result = await page('admin');
    const approve = result.items.find((item) => item.id === rows.get('approve'));
    expect(approve).toMatchObject({
      user: { id: ids.get('admin'), name: 'Yusuf', role: 'System_Admin' },
      area: 'SPK',
      entity: 'spk',
      record: 'SPK-2611150001',
      action: 'approve',
      before: 'Pending_Approval',
      after: 'Active',
      self: 'Self-approved',
      reason: null,
    });
    expect(approve?.at).toBe('2026-11-15T03:00:00.000Z');
    const role = result.items.find((item) => item.id === rows.get('role'));
    expect(role).toMatchObject({
      area: 'Access',
      record: 'Rina',
      before: 'role: Planner',
      after: 'role: Supervisor',
      self: null,
    });
  });

  it('REQ-IAM-007 a change made by the system itself has no user', async () => {
    const end = (await page('admin')).items.find((item) => item.id === rows.get('end'));
    expect(end).toMatchObject({ user: null, area: 'Access', record: 'Planner approval' });
  });

  it('DEC-131 summarises the changed fields when the record has no status change', async () => {
    const result = await page('admin');
    expect(result.items.find((item) => item.id === rows.get('vehicle'))).toMatchObject({
      area: 'Vehicles',
      before: 'currentOdometer: 48000',
      after: 'currentOdometer: 48210',
    });
    expect(result.items.find((item) => item.id === rows.get('switch'))).toMatchObject({
      before: 'kinds: —, until: —',
      after: 'kinds: spk_creation, until: 2026-11-16T11:00:00.000Z',
    });
  });

  it('DEC-131 filters by user, by area and by WIB dates', async () => {
    expect(keysOf(await page('admin', { userId: String(ids.get('am')) }))).toEqual([
      'switch',
      'role',
      'matrix',
    ]);
    expect(keysOf(await page('admin', { area: 'Access' }))).toEqual([
      'switch',
      'role',
      'end',
      'matrix',
    ]);
    expect(keysOf(await page('admin', { from: '2026-11-09', to: '2026-11-09' }))).toEqual(['move']);
    const created = await page('admin', { area: 'Vehicles', from: '2026-11-01', to: '2026-11-05' });
    expect(created.pagination.total).toBe(12);
    expect(keysOf(await page('admin', { area: 'Settings', from: '2026-11-01' }))).toEqual([
      'doctype',
    ]);
    expect(created.range).toEqual({ from: '2026-11-01', to: '2026-11-05' });
  });

  it('DEC-131 pages on the server: Previous, Next and the total', async () => {
    const day = { from: '2026-11-05', to: '2026-11-05', pageSize: '10' };
    const first = await page('admin', day);
    expect(first.items).toHaveLength(10);
    expect(first.pagination).toEqual({ page: 1, pageSize: 10, total: 12, totalPages: 2 });
    expect(keysOf(first)[0]).toBe('class12');
    const second = await page('admin', { ...day, page: '2' });
    expect(keysOf(second)).toEqual(['class2', 'class1']);
  });

  it('DEC-131 offers everyone with an audit record in the User filter', async () => {
    const { users } = await page('admin');
    expect(users.map((user) => user.name).sort()).toEqual(['Dewi', 'Yusuf'].sort());
  });

  it('DEC-131 refuses a From date after the To date', async () => {
    const response = await get('admin', '/audit-logs', { from: '2026-11-10', to: '2026-11-01' });
    expect(response.status).toBe(400);
  });

  it('DEC-131 one row opens with the full before, after and reason', async () => {
    const response = await get('admin', `/audit-logs/${rows.get('move')}`);
    expect(response.status).toBe(200);
    const detail = await json<AuditLogDetail>(response);
    expect(detail.item).toMatchObject({
      action: 'move_system_admin',
      record: 'Yusuf',
      reason: 'Rina moved to the workshop',
    });
    expect(detail.before).toEqual({ systemAdminId: ids.get('rina'), role: 'Planner' });
    expect(detail.after).toEqual({ systemAdminId: ids.get('admin') });
    expect((await get('admin', '/audit-logs/999999')).status).toBe(404);
  });

  it('REQ-IAM-007 only audit.view opens it: the GM and the Access Manager may, a Planner may not', async () => {
    expect((await get('gm', '/audit-logs')).status).toBe(200);
    expect((await get('am', '/audit-logs')).status).toBe(200);
    expect((await get('rina', '/audit-logs')).status).toBe(403);
    expect((await get('rina', `/audit-logs/${rows.get('approve')}`)).status).toBe(403);
    expect((await get('rina', '/audit-logs/export', { format: 'csv' })).status).toBe(403);
  });
});

describe('Audit log export (DEC-74, DEC-131)', () => {
  it('DEC-74 exports the filtered rows as CSV and logs the export', async () => {
    const before = (await exportLogs()).length;
    const response = await get('gm', '/audit-logs/export', { format: 'csv', area: 'Access' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="audit-log-2026-11-16.csv"',
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(bytes.slice(3)).trimEnd().split('\r\n');
    expect(lines[0]).toBe('Time,User,Role,Area,Record,Before,After,Self');
    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe(
      '2026-11-16 07:00:00,Dewi,Access Manager,Access,Planner approval,"kinds: —, until: —","kinds: spk_creation, until: 2026-11-16T11:00:00.000Z",',
    );
    expect(lines[3]).toBe(
      '2026-11-13 18:00:00,System,,Access,Planner approval,"kinds: spk_creation, until: 2026-11-13T11:00:00.000Z","kinds: —, until: —",',
    );
    const logged = await exportLogs();
    expect(logged).toHaveLength(before + 1);
    expect(logged.at(-1)).toEqual({
      user_id: String(ids.get('gm')),
      export_type: 'audit_log',
      file_format: 'csv',
      parameters: { area: 'Access', from: '2026-11-10', to: '2026-11-16' },
    });
  });

  it('DEC-74 a cell that starts like a formula is written as text (CSV injection)', async () => {
    const response = await get('admin', '/audit-logs/export', {
      format: 'csv',
      from: '2026-11-03',
      to: '2026-11-03',
    });
    const text = new TextDecoder().decode(new Uint8Array(await response.arrayBuffer()).slice(3));
    const [, row] = text.trimEnd().split('\r\n');
    expect(row).toBe("2026-11-03 09:00:00,Dewi,Access Manager,Access,'=2+3,name: Budi,name: =2+3,");
  });

  it('DEC-74 exports the same rows as xlsx that opens in a spreadsheet', async () => {
    const response = await get('admin', '/audit-logs/export', { format: 'xlsx', area: 'SPK' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="audit-log-2026-11-16.xlsx"',
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(await response.arrayBuffer());
    const sheet = book.getWorksheet('Audit log');
    expect(sheet?.getRow(1).values).toEqual([
      undefined,
      'Time',
      'User',
      'Role',
      'Area',
      'Record',
      'Before',
      'After',
      'Self',
    ]);
    expect(sheet?.getRow(2).values).toEqual([
      undefined,
      '2026-11-15 10:00:00',
      'Yusuf',
      'System Admin',
      'SPK',
      'SPK-2611150001',
      'Pending_Approval',
      'Active',
      'Self-approved',
    ]);
    expect(sheet?.rowCount).toBe(2);
    expect((await exportLogs()).at(-1)).toMatchObject({
      file_format: 'xlsx',
      export_type: 'audit_log',
    });
  });

  it('DEC-131 refuses an export of more than 10,000 rows and logs nothing', async () => {
    await testPool().query(
      `INSERT INTO audit_logs (entity, entity_id, action, after, user_id, user_role, at)
       SELECT 'vehicle', n, 'create', '{}'::jsonb, $1, 'System_Admin',
         '2026-10-01T03:00:00Z'::timestamptz AT TIME ZONE 'UTC'
       FROM generate_series(1, 10001) AS n`,
      [ids.get('admin')],
    );
    const before = (await exportLogs()).length;
    const response = await get('admin', '/audit-logs/export', {
      format: 'csv',
      from: '2026-10-01',
      to: '2026-10-01',
    });
    expect(response.status).toBe(400);
    expect((await json<{ message: string }>(response)).message).toBe(
      'Narrow the filters to export at most 10,000 rows.',
    );
    expect(await exportLogs()).toHaveLength(before);
  });
});

describe('Access history (REQ-IAM-003, FLW-AM-05)', () => {
  it('FLW-AM-05 lists only the access changes, newest first, in words', async () => {
    const response = await get('am', '/access-history');
    expect(response.status).toBe(200);
    const result = await json<AccessHistoryResponse>(response);
    expect(keysOf(result)).toEqual(['switch', 'role', 'end', 'matrix', 'move', 'evil']);
    expect(result.items.map((item) => [item.who, item.what])).toEqual([
      ['Dewi', 'Planner approval on until 18:00 (SPK creation)'],
      ['Dewi', 'Changed the role of Rina from Planner to Supervisor'],
      [null, 'Planner approval ended at its end time'],
      ['Dewi', 'Changed permissions: Planner spk.create off'],
      ['Dewi', 'Moved System Admin from Rina to Yusuf'],
      ['Dewi', 'Edited the account =2+3'],
    ]);
    expect(result.pagination).toEqual({ page: 1, pageSize: 20, total: 6, totalPages: 1 });
  });

  it('FLW-AM-05 is the Access Manager’s: the System Admin and the GM are refused', async () => {
    expect((await get('admin', '/access-history')).status).toBe(403);
    expect((await get('gm', '/access-history')).status).toBe(403);
  });
});
