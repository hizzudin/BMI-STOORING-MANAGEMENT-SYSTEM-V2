import { ModuleRowSchema } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import { MODULES } from '../../app.modules.js';
import { dummyModule } from './dummy-module.js';

describe('TASK-203 module contract: the dummy module (REQ-REG-006, DEC-144, DEC-148)', () => {
  it('REQ-REG-006 module contract: the composition root lists the dummy module with a valid row', () => {
    expect(MODULES.map((m) => m.contract.code)).toContain('Dummy');
    expect(dummyModule.row.code).toBe(dummyModule.code);
    expect(ModuleRowSchema.parse(dummyModule.row)).toEqual(dummyModule.row);
  });
});
