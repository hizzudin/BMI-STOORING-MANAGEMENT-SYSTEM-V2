import { defineModule, type RegisteredModule } from './engine/module-contract.js';
import { dummyModule } from './modules/dummy/dummy-module.js';

/**
 * TASK-203, DEC-148, DEC-149: the composition root's list of modules in code, each paired with the
 * factory of its own gateways. Only this file and the tests import a module folder (CI rule).
 * A module's task adds its line here together with its migration row.
 */
export const MODULES: readonly RegisteredModule[] = [
  defineModule({ contract: dummyModule, gateways: () => undefined }),
];
