import { MODULES } from '../../../src/app.modules.js';
import { dummyModule } from '../../../src/modules/dummy/dummy-module.js';
import { testModule } from '../harness/modules.js';
import { describe, expect, it } from 'vitest';
import { fixtureOf, runModuleContractSuite } from './module-contract.suite.js';

// TASK-203 (REQ-REG-006, DEC-144, DEC-148): every module of the composition root passes the
// contract suite; only the dummy's row is inserted here, a real module's comes from its migration.
runModuleContractSuite({
  label: 'TASK-203 module contract suite over MODULES (REQ-REG-006)',
  modules: MODULES,
  insertRow: (module) => module.contract.code === dummyModule.code,
});

// REQ-REG-006: a module the engine has never seen, registered only through its contract and row,
// passes the same suite and the same submit with no engine change.
runModuleContractSuite({
  label: 'TASK-203 module contract suite over a test-only module (REQ-REG-006)',
  modules: [
    testModule('Second_Module', {}, { executorRoles: ['Mechanic'] }),
    // Merge review 7: the Warehouse Manager holds purchase.line but is not this step's executor,
    // so the suite's refusal reaches the executor check (L2) and its sentence.
    testModule(
      'Purchase_Like_Module',
      {},
      { executorRoles: ['Field_Coordinator'] },
      'purchase.line',
    ),
  ],
  insertRow: () => true,
});

/**
 * ADR-0002 merge review 3: a real module refuses a bare submit (Stock needs its lines), so the
 * suite prepares each module's submit from its fixture. This module accepts a submit only when its
 * frozen step options say `ready`; its fixture gives them.
 */
const checked = testModule(
  'Checked_Module',
  {
    validateSubmit: (ctx) =>
      Promise.resolve(
        (ctx.stepConfig as { ready?: boolean }).ready === true
          ? null
          : { status: 400, sentence: 'The step is not ready.' },
      ),
  },
  { executorRoles: ['Mechanic'] },
);

runModuleContractSuite({
  label: 'TASK-203 module contract suite with a submit fixture (REQ-REG-006, merge review 3)',
  modules: [checked],
  insertRow: () => true,
  fixtures: { Checked_Module: { stepConfig: { ready: true } } },
});

describe('TASK-203 contract suite fixtures (REQ-REG-006, merge review 3)', () => {
  it('REQ-REG-006 a module with a validateSubmit and no fixture fails loudly', () => {
    expect(() => fixtureOf(checked)).toThrow(
      'Module Checked_Module has a validateSubmit: give the contract suite a submit fixture for it.',
    );
    expect(fixtureOf(checked, { Checked_Module: { stepConfig: { ready: true } } })).toEqual({
      stepConfig: { ready: true },
    });
  });
});
