import { describe, expect, it } from 'vitest';
import {
  CreationSchemaSchema,
  ModuleRowSchema,
  ModuleStatusChangeRequestSchema,
  ScopeRulesSchema,
  type ModuleRow,
} from './index.js';

const dummy: ModuleRow = {
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
};

describe('TASK-203 registry row shapes (REQ-REG-006, DEC-149)', () => {
  it('REQ-REG-006 ModuleRowSchema accepts the dummy row', () => {
    expect(ModuleRowSchema.parse(dummy)).toEqual(dummy);
  });

  it.each([
    ['a lower-case code', { code: 'stock' }],
    ['a one-letter code', { code: 'A' }],
    ['no executor role', { executorRoles: [] }],
    ['an unknown cost kind', { costKind: 'Fuel' }],
  ])('REQ-REG-006 ModuleRowSchema refuses %s', (_label, change) => {
    expect(ModuleRowSchema.safeParse({ ...dummy, ...change }).success).toBe(false);
  });

  it('REQ-REG-006 DEC-149 scope rules stay an empty strict object until TASK-306', () => {
    expect(ScopeRulesSchema.safeParse({}).success).toBe(true);
    expect(ScopeRulesSchema.safeParse({ vehicle: 'write' }).success).toBe(false);
  });

  it('REQ-REG-006 a creation section names the lists of the 4.3 contract table', () => {
    const stock = {
      required: true,
      lists: ['parts_with_quantity', 'tyre_sizes_with_quantity'],
      fields: [],
    };
    expect(CreationSchemaSchema.parse(stock)).toEqual(stock);
    expect(CreationSchemaSchema.safeParse({ ...stock, lists: ['tyres'] }).success).toBe(false);
  });

  it('REQ-REG-005 a deactivate or activate needs a reason of 1 to 500 characters', () => {
    const blank = ModuleStatusChangeRequestSchema.safeParse({ reason: '  ' });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0]?.message).toBe('Give a reason.');
    expect(ModuleStatusChangeRequestSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(
      false,
    );
    expect(ModuleStatusChangeRequestSchema.parse({ reason: ' Replaced ' })).toEqual({
      reason: 'Replaced',
    });
  });
});
