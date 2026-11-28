import type { ModuleContract } from '../../engine/module-contract.js';

/**
 * §8.3, DEC-144, DEC-148: the engine's test module. Its code ships everywhere, but only the test
 * harness and the e2e seed insert its row, so staging and production never offer it.
 */
export const dummyModule: ModuleContract = {
  code: 'Dummy',
  executeCapability: 'mechanic.execute',
  row: {
    code: 'Dummy',
    name: 'Dummy step',
    uiComponent: 'DummyStep',
    configSchema: null,
    creationSchema: null,
    executorRoles: ['Mechanic'],
    scopeRules: {},
    completionSection: {},
    costKind: 'None',
    tracksWorkTime: true,
    isActive: true,
    sortOrder: 0,
  },
};
