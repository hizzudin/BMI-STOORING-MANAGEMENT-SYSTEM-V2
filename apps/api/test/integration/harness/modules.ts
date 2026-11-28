import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ModuleRow, Role } from '@bmi/shared';
import { AppModule } from '../../../src/app.module.js';
import {
  CLOCK,
  EMAIL,
  MODULE_LIST,
  PASSWORD_HASHER,
  PG_POOL,
  PLANNER_APPROVAL_END,
} from '../../../src/app.tokens.js';
import {
  defineModule,
  type ModuleContract,
  type RegisteredModule,
} from '../../../src/engine/module-contract.js';
import { ScryptPasswordHasher } from '../../../src/infra/crypto/scrypt-password-hasher.js';
import type { DbTransaction } from '../../../src/infra/db/unit-of-work.js';
import type { PlannerApprovalEndScheduler } from '../../../src/ports/planner-approval.js';
import { FakeEmail, insertAccount, postJson } from '../iam/auth-harness.js';
import { testPool } from './database.js';
import type { FakeClock } from './fake-clock.js';
import { seedRolePermissions } from './role-permissions.js';

/**
 * TASK-203: the module tests' harness. A module row is inserted from its contract's `row` (DEC-148:
 * only the tests and the e2e seed insert the dummy's), and the app runs on a chosen module list.
 */

class NoScheduler implements PlannerApprovalEndScheduler {
  scheduleEnd(): Promise<void> {
    return Promise.resolve();
  }
}

export async function insertModuleRow(row: ModuleRow): Promise<void> {
  await testPool().query(
    `INSERT INTO assignment_modules (code, name, ui_component, config_schema, creation_schema,
       executor_roles, scope_rules, completion_section, cost_kind, tracks_work_time, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (code) DO NOTHING`,
    [
      row.code,
      row.name,
      row.uiComponent,
      row.configSchema === null ? null : JSON.stringify(row.configSchema),
      row.creationSchema === null ? null : JSON.stringify(row.creationSchema),
      `{${row.executorRoles.join(',')}}`,
      JSON.stringify(row.scopeRules),
      JSON.stringify(row.completionSection),
      row.costKind,
      row.tracksWorkTime,
      row.isActive,
      row.sortOrder,
    ],
  );
}

/** A row in the table with no module in code (the trial and e2e data, DEC-148). */
export function codelessRow(code: string, name: string, roles: Role[] = ['Mechanic']): ModuleRow {
  return {
    code,
    name,
    uiComponent: `${code}Step`,
    configSchema: null,
    creationSchema: null,
    executorRoles: roles,
    scopeRules: {},
    completionSection: {},
    costKind: 'None',
    tracksWorkTime: true,
    isActive: true,
    sortOrder: 0,
  };
}

/**
 * A module built in a test, not in `MODULES`: executed by the Mechanic with `mechanic.execute`. Its
 * gateways are the engine's transaction itself, so a hook can prove it runs inside it.
 */
export function testModule(
  code: string,
  hooks: Pick<ModuleContract<DbTransaction>, 'validateSubmit' | 'onSubmit'> = {},
  change: Partial<ModuleRow> = {},
): RegisteredModule {
  return defineModule<DbTransaction>({
    contract: {
      code,
      executeCapability: 'mechanic.execute',
      row: { ...codelessRow(code, `${code} step`), ...change },
      ...hooks,
    },
    gateways: (tx) => tx as unknown as DbTransaction,
  });
}

export interface EngineApp {
  app: INestApplication;
  baseUrl: string;
  /** Signs a new account of that role in and keeps its token under `key`. */
  account(key: string, role: Role): Promise<number>;
  auth(key: string): { authorization: string };
}

/** The API on the given module list, in Live mode (DEC-56), with its accounts signed in by phone. */
export async function startEngineApp(
  modules: readonly RegisteredModule[],
  clock: FakeClock,
): Promise<EngineApp> {
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
    .overrideProvider(MODULE_LIST)
    .useValue(modules)
    .compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0);
  const baseUrl = await app.getUrl();
  const tokens = new Map<string, string>();
  return {
    app,
    baseUrl,
    async account(key, role) {
      const created = await insertAccount({ role });
      const response = await postJson(baseUrl, '/auth/sign-in', {
        email: created.email,
        password: created.password,
        client: 'mobile',
      });
      tokens.set(key, ((await response.json()) as { accessToken: string }).accessToken);
      return created.id;
    },
    auth: (key) => ({ authorization: `Bearer ${tokens.get(key)}` }),
  };
}

let vehicleSequence = 0;

/** One vehicle with its class and layout, for the SPKs of a test file. */
export async function insertVehicle(): Promise<number> {
  vehicleSequence += 1;
  const tag = `REG${vehicleSequence}`;
  const { rows: layout } = await testPool().query<{ id: string }>(
    `INSERT INTO chassis_layouts (code, name, definition, axle_count, tyre_count)
     VALUES ($1, $1, '{"frontDrawing":"None","spareCount":0,"axles":[{"role":"Steer","tyresPerSide":1}]}', 1, 2)
     RETURNING id`,
    [`L_${tag}`],
  );
  const { rows: klass } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicle_classes (code, name, default_chassis_layout_id) VALUES ($1, 'Tractor head', $2) RETURNING id`,
    [`C_${tag}`, layout[0]?.id],
  );
  const { rows: vehicle } = await testPool().query<{ id: string }>(
    `INSERT INTO vehicles (license_plate, vehicle_class_id, chassis_layout_id, current_odometer)
     VALUES ($1, $2, $3, 48210) RETURNING id`,
    [`B ${1000 + vehicleSequence} RG`, klass[0]?.id, layout[0]?.id],
  );
  return Number(vehicle[0]?.id);
}

let spkSequence = 0;

/**
 * An SPK with one step per module code, written while Draft (the freeze trigger, DEC-145), then
 * moved to `status`; the first step is Open, the others Locked.
 */
export async function insertSpkWithSteps(
  vehicleId: number,
  createdBy: number,
  modules: readonly string[],
  status = 'Active',
): Promise<{ spkId: number; stepIds: number[] }> {
  spkSequence += 1;
  const { rows } = await testPool().query<{ id: string }>(
    `INSERT INTO spks (spk_number, vehicle_id, title, category, request_source, description, status,
       created_by)
     VALUES ($1, $2, 'Registry check', 'Corrective', 'Manual_Planner', 'Uji modul.', 'Draft', $3)
     RETURNING id`,
    [`SPK-REG-${process.pid}-${spkSequence}`, vehicleId, createdBy],
  );
  const spkId = Number(rows[0]?.id);
  const stepIds: number[] = [];
  for (const [index, module] of modules.entries()) {
    const open = index === 0;
    const { rows: step } = await testPool().query<{ id: string }>(
      `INSERT INTO spk_assignments (spk_id, sequence_no, module, executor_roles, verifier_role, status,
         opened_at)
       VALUES ($1, $2, $3, '{Mechanic}', 'Planner', $4, $5) RETURNING id`,
      [spkId, index + 1, module, open ? 'Open' : 'Locked', open ? new Date() : null],
    );
    stepIds.push(Number(step[0]?.id));
  }
  await testPool().query(`UPDATE spks SET status = $2 WHERE id = $1`, [spkId, status]);
  return { spkId, stepIds };
}

export const submitStep = (
  engine: EngineApp,
  who: string,
  spkId: number,
  stepId: number,
  key: string,
  fileIds: number[] = [],
) =>
  fetch(`${engine.baseUrl}/spks/${spkId}/steps/${stepId}/submit`, {
    method: 'POST',
    headers: { ...engine.auth(who), 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ fileIds }),
  });

export async function stepStatus(stepId: number): Promise<string> {
  const { rows } = await testPool().query<{ status: string }>(
    `SELECT status FROM spk_assignments WHERE id = $1`,
    [stepId],
  );
  return rows[0]?.status ?? '';
}
