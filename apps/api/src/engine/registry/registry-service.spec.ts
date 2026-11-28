import type { PermissionCode, SessionUser } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import { ActionRefusedError, type Actor } from '../../core/iam/actions.js';
import type { AuditEntry } from '../../ports/accounts.js';
import type { ClockPort } from '../../ports/clock.js';
import type { StoredResponse } from '../../ports/idempotency.js';
import type { RegistryGateways, StoredModuleRow } from '../../ports/registry.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { defineModule } from '../module-contract.js';
import { ModuleCatalogService } from './module-catalog.js';
import {
  ModuleNotFoundError,
  ModuleStateConflictError,
  ModuleUnavailableError,
  RegistryService,
} from './registry-service.js';

const row = (code: string, change: Partial<StoredModuleRow> = {}): StoredModuleRow => ({
  id: code.length,
  code,
  name: `${code} step`,
  uiComponent: `${code}Step`,
  configSchema: null,
  creationSchema: null,
  executorRoles: ['Mechanic'],
  scopeRules: {},
  completionSection: {},
  costKind: 'None',
  tracksWorkTime: true,
  isActive: true,
  sortOrder: 0,
  ...change,
});

class FakeRegistry {
  rows: StoredModuleRow[] = [];
  audits: AuditEntry[] = [];
  stored = new Map<string, StoredResponse>();
  gateways: RegistryGateways = {
    modules: {
      list: () => Promise.resolve(this.rows.map((r) => ({ ...r }))),
      lock: (code) => Promise.resolve(this.rows.find((r) => r.code === code) ?? null),
      setActive: (code, isActive) => {
        const found = this.rows.find((r) => r.code === code);
        if (found) found.isActive = isActive;
        return Promise.resolve();
      },
    },
    audit: {
      write: (entry) => {
        this.audits.push(entry);
        return Promise.resolve();
      },
    },
    idempotency: {
      claim: (request) => {
        const response = this.stored.get(request.key);
        return Promise.resolve(response ? { kind: 'replay', response } : { kind: 'new' });
      },
      store: (request, response) => {
        this.stored.set(request.key, response);
        return Promise.resolve();
      },
    },
  };
  unitOfWork: UnitOfWork<RegistryGateways> = { run: (work) => work(this.gateways) };
}

const clock = { now: () => new Date('2026-11-28T02:00:00Z') } as ClockPort;
const catalog = new ModuleCatalogService([
  defineModule({
    contract: { code: 'Dummy', executeCapability: 'mechanic.execute', row: row('Dummy') },
    gateways: () => undefined,
  }),
]);
const actor = (codes: PermissionCode[] = ['registry.manage']): Actor => ({
  user: { id: 3, role: 'Planner' } as SessionUser,
  capabilities: new Set(codes),
  systemMode: 'Live',
});
const key = (k: string) => ({ key: k, requestHash: 'h' });

function service(rows: StoredModuleRow[]) {
  const fake = new FakeRegistry();
  fake.rows = rows;
  return { fake, registry: new RegistryService(fake.unitOfWork, catalog, clock) };
}

describe('TASK-203 registry service (REQ-REG-002, REQ-REG-005, DEC-148)', () => {
  it('REQ-REG-002 list marks offered only for an active row with code, sorted by sort_order then name', async () => {
    const { registry } = service([
      row('Mechanic_Action', { sortOrder: 1 }),
      row('Dummy', { sortOrder: 2 }),
      row('Zeta_Module', { sortOrder: 1, name: 'A first' }),
    ]);
    const items = await registry.list();
    expect(items.map((i) => [i.code, i.implemented, i.offered])).toEqual([
      ['Zeta_Module', false, false],
      ['Mechanic_Action', false, false],
      ['Dummy', true, true],
    ]);
    expect(items[0]).not.toHaveProperty('scopeRules');
    expect(items[0]).not.toHaveProperty('id');
  });

  it('REQ-REG-005 assertOfferable refuses an inactive or unimplemented module "This module is not available for new steps."', async () => {
    const { registry } = service([row('Dummy', { isActive: false }), row('Mechanic_Action')]);
    await expect(registry.assertOfferable('Dummy')).rejects.toThrow(ModuleUnavailableError);
    await expect(registry.assertOfferable('Mechanic_Action')).rejects.toThrow(
      'This module is not available for new steps.',
    );
    await expect(registry.assertOfferable('Unknown_Module')).rejects.toThrow(ModuleNotFoundError);
  });

  it('REQ-REG-005 deactivate writes is_active false and one audit record with the reason', async () => {
    const { fake, registry } = service([row('Dummy')]);
    const outcome = await registry.deactivate(actor(), 'Dummy', { reason: 'Replaced' }, key('k1'));
    expect(outcome.status).toBe(200);
    expect(fake.rows[0]?.isActive).toBe(false);
    expect(fake.audits).toEqual([
      expect.objectContaining({
        entity: 'assignment_module',
        entityId: 5,
        action: 'deactivate',
        before: { isActive: true },
        after: { isActive: false },
        reason: 'Replaced',
        userId: 3,
        userRole: 'Planner',
      }),
    ]);
  });

  it('REQ-REG-005 deactivating an inactive module is 409 "This module is already inactive."; activating an active one is 409 too', async () => {
    const { registry } = service([row('Dummy', { isActive: false }), row('Other_Module')]);
    await expect(registry.deactivate(actor(), 'Dummy', { reason: 'x' }, key('k2'))).rejects.toThrow(
      ModuleStateConflictError,
    );
    await expect(registry.deactivate(actor(), 'Dummy', { reason: 'x' }, key('k2b'))).rejects.toThrow(
      'This module is already inactive.',
    );
    await expect(
      registry.activate(actor(), 'Other_Module', { reason: 'x' }, key('k3')),
    ).rejects.toThrow('This module is already active.');
    await expect(
      registry.activate(actor(), 'Dummy', { reason: 'Back' }, key('k4')),
    ).resolves.toEqual(expect.objectContaining({ status: 200 }));
  });

  it('REQ-REG-005 an unknown code is 404 and an actor without registry.manage is refused', async () => {
    const { registry } = service([row('Dummy')]);
    await expect(
      registry.deactivate(actor(), 'Unknown_Module', { reason: 'x' }, key('k5')),
    ).rejects.toThrow('This module was not found.');
    await expect(
      registry.deactivate(actor(['spk.view']), 'Dummy', { reason: 'x' }, key('k6')),
    ).rejects.toThrow(ActionRefusedError);
  });
});
