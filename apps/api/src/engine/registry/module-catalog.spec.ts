import type { ModuleRow } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import type { Actor } from '../../core/iam/actions.js';
import type { SubmitContext, TxHandle } from '../../ports/registry.js';
import { defineModule, type ModuleContract } from '../module-contract.js';
import { ModuleCatalogService } from './module-catalog.js';

const BASE: ModuleRow = {
  code: 'Base',
  name: 'Test step',
  uiComponent: 'TestStep',
  configSchema: null,
  creationSchema: null,
  executorRoles: ['Mechanic'],
  scopeRules: {},
  completionSection: {},
  costKind: 'None',
  tracksWorkTime: true,
  isActive: true,
  sortOrder: 0,
};

const row = (code: string, change: Partial<ModuleRow> = {}): ModuleRow => ({
  ...BASE,
  code,
  ...change,
});

const contract = (code: string, change: Partial<ModuleContract> = {}): ModuleContract => ({
  code,
  executeCapability: 'mechanic.execute',
  row: row(code),
  ...change,
});

const tx = {} as TxHandle;
const ctx: SubmitContext = {
  spkId: 1,
  stepId: 2,
  sequenceNo: 1,
  stepConfig: {},
  actor: {} as Actor,
  fileIds: [],
  now: new Date('2026-11-28T01:00:00Z'),
};

describe('TASK-203 module contract (REQ-REG-006, DEC-148, DEC-149)', () => {
  it('REQ-REG-006 module contract: defineModule binds the hooks to the gateways built on the transaction', async () => {
    const calls: string[] = [];
    const registered = defineModule<{ log: string[] }>({
      contract: {
        ...contract('Hooked'),
        validateSubmit: (_c, gateways) => {
          gateways.log.push('validate');
          return Promise.resolve({ status: 409, sentence: 'Taken.' });
        },
        onSubmit: (_c, gateways) => {
          gateways.log.push('submit');
          return Promise.resolve();
        },
      },
      gateways: (handle) => {
        expect(handle).toBe(tx);
        return { log: calls };
      },
    });
    const hooks = registered.bind(tx);
    expect(await hooks.validate(ctx)).toEqual({ status: 409, sentence: 'Taken.' });
    await hooks.submit(ctx);
    expect(calls).toEqual(['validate', 'submit']);
  });

  it('REQ-REG-006 module contract: a contract without hooks validates to null and submits nothing', async () => {
    const hooks = defineModule({ contract: contract('Plain'), gateways: () => undefined }).bind(tx);
    expect(await hooks.validate(ctx)).toBeNull();
    await expect(hooks.submit(ctx)).resolves.toBeUndefined();
  });

  it('REQ-REG-006 module contract: the catalog answers the execute capability of a code, null without code', () => {
    const catalog = new ModuleCatalogService([
      defineModule({ contract: contract('Dummy'), gateways: () => undefined }),
    ]);
    expect(catalog.executeCapabilityOf('Dummy')).toBe('mechanic.execute');
    expect(catalog.executeCapabilityOf('Mechanic_Action')).toBeNull();
    expect(catalog.isImplemented('Dummy')).toBe(true);
    expect(catalog.isImplemented('Mechanic_Action')).toBe(false);
    expect(catalog.hooksOf('Mechanic_Action')).toBeNull();
    expect(catalog.hooksOf('Dummy')).not.toBeNull();
  });

  it('REQ-REG-006 module contract: executeCapabilities is the sorted union without repeats', () => {
    const catalog = new ModuleCatalogService([
      defineModule({ contract: contract('One_Module'), gateways: () => undefined }),
      defineModule({ contract: contract('Two_Module'), gateways: () => undefined }),
      defineModule({
        contract: contract('Three_Module', { executeCapability: 'docstep.execute' }),
        gateways: () => undefined,
      }),
    ]);
    expect(catalog.executeCapabilities()).toEqual(['docstep.execute', 'mechanic.execute']);
  });

  it('REQ-REG-006 module contract: two modules with one code or an invalid row refuse to start', () => {
    const plain = (c: ModuleContract) => defineModule({ contract: c, gateways: () => undefined });
    expect(
      () => new ModuleCatalogService([plain(contract('Dummy')), plain(contract('Dummy'))]),
    ).toThrow('Two modules share the code Dummy.');
    expect(
      () =>
        new ModuleCatalogService([
          plain(contract('Bad', { row: row('Bad', { executorRoles: [] }) })),
        ]),
    ).toThrow('The registry row of module Bad is invalid');
    expect(
      () => new ModuleCatalogService([plain(contract('Other', { row: row('Different') }))]),
    ).toThrow('The registry row of module Other is invalid');
  });
});
