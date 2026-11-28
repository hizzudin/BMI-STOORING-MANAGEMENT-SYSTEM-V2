import { defaultRolePermissions, ModuleRowSchema, ROLES, type Role } from '@bmi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RegisteredModule } from '../../../src/engine/module-contract.js';
import { testPool } from '../harness/database.js';
import { FakeClock } from '../harness/fake-clock.js';
import {
  insertModuleRow,
  insertSpkWithSteps,
  insertVehicle,
  startEngineApp,
  stepStatus,
  submitStep,
  type EngineApp,
} from '../harness/modules.js';

/**
 * TASK-203 (specs/design.md 5.26, REQ-REG-006, DEC-149): the one suite every module, current or
 * future, must pass. `insertRow` says which modules' rows the test inserts (the dummy's and
 * test-only modules); every other module's row must come from its migration.
 */
export interface ContractSuiteOptions {
  label: string;
  modules: readonly RegisteredModule[];
  insertRow: (module: RegisteredModule) => boolean;
}

interface StoredRow {
  ui_component: string;
  config_schema: unknown;
  creation_schema: unknown;
  executor_roles: string;
  scope_rules: unknown;
  completion_section: unknown;
  cost_kind: string;
  tracks_work_time: boolean;
}

const holds = (role: Role, code: string) =>
  defaultRolePermissions().some(
    (cell) => cell.role === role && cell.permissionCode === code && cell.allowed,
  );

export function runModuleContractSuite({ label, modules, insertRow }: ContractSuiteOptions): void {
  describe(label, () => {
    const clock = FakeClock.atWib('2026-11-28 11:00');
    let engine: EngineApp;
    let vehicleId = 0;
    let planner = 0;
    let keys = 0;

    beforeAll(async () => {
      engine = await startEngineApp(modules, clock);
      planner = await engine.account('planner', 'Planner');
      for (const role of new Set(modules.flatMap((m) => m.contract.row.executorRoles))) {
        await engine.account(role, role);
      }
      vehicleId = await insertVehicle();
      for (const module of modules) {
        if (insertRow(module)) await insertModuleRow(module.contract.row);
      }
    });

    afterAll(async () => {
      await engine.app.close();
    });

    it('REQ-REG-006 every module has its own code', () => {
      const codes = modules.map((m) => m.contract.code);
      expect(new Set(codes).size).toBe(codes.length);
    });

    describe.each(modules.map((m) => [m.contract.code, m] as const))('%s', (code, module) => {
      const { row, executeCapability } = module.contract;

      it(`REQ-REG-006 ${code} has a valid registry row with its own code`, () => {
        expect(ModuleRowSchema.parse(row)).toEqual(row);
        expect(row.code).toBe(code);
      });

      it(`REQ-REG-006 ${code} every executor role holds its execute capability ${executeCapability}`, () => {
        for (const role of row.executorRoles)
          expect(holds(role, executeCapability), role).toBe(true);
      });

      it(`REQ-REG-006 ${code} the stored row equals the contract except name, sort_order and is_active`, async () => {
        const { rows } = await testPool().query<StoredRow>(
          `SELECT ui_component, config_schema, creation_schema, executor_roles::text, scope_rules,
             completion_section, cost_kind, tracks_work_time
           FROM assignment_modules WHERE code = $1`,
          [code],
        );
        expect(rows, `no registry row for ${code}: add it in the module's migration`).toHaveLength(
          1,
        );
        expect(rows[0]).toEqual({
          ui_component: row.uiComponent,
          config_schema: row.configSchema,
          creation_schema: row.creationSchema,
          executor_roles: `{${row.executorRoles.join(',')}}`,
          scope_rules: row.scopeRules,
          completion_section: row.completionSection,
          cost_kind: row.costKind,
          tracks_work_time: row.tracksWorkTime,
        });
      });

      it(`REQ-REG-006 ${code} a step is submitted through the engine by an executor and refused for another role`, async () => {
        const executor = row.executorRoles[0] ?? 'Mechanic';
        const other = ROLES.find(
          (role) => !row.executorRoles.includes(role) && role !== 'System_Admin',
        );
        if (other) await engine.account(`other-${code}`, other);
        const refused = await insertSpkWithSteps(
          vehicleId,
          planner,
          [code],
          'Active',
          row.executorRoles,
        );
        if (other) {
          keys += 1;
          const response = await submitStep(
            engine,
            `other-${code}`,
            refused.spkId,
            refused.stepIds[0] ?? 0,
            `contract-${code}-${keys}`,
          );
          expect(response.status).toBe(403);
        }
        const { spkId, stepIds } = await insertSpkWithSteps(
          vehicleId,
          planner,
          [code],
          'Active',
          row.executorRoles,
        );
        keys += 1;
        const response = await submitStep(
          engine,
          executor,
          spkId,
          stepIds[0] ?? 0,
          `contract-${code}-${keys}`,
        );
        expect(response.status).toBe(200);
        expect(await stepStatus(stepIds[0] ?? 0)).toBe('Submitted');
      });
    });
  });
}
