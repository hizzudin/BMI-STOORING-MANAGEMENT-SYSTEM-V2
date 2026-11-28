import { MODULES } from '../../../src/app.modules.js';
import { dummyModule } from '../../../src/modules/dummy/dummy-module.js';
import { testModule } from '../harness/modules.js';
import { runModuleContractSuite } from './module-contract.suite.js';

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
  modules: [testModule('Second_Module', {}, { executorRoles: ['Mechanic'] })],
  insertRow: () => true,
});
