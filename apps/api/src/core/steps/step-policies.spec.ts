import type { PermissionCode, SessionUser } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import { refusalOf, type Actor } from '../core/iam/actions.js';
import { stepPolicies, type StepItem } from './step-policies.js';

const actor = (codes: PermissionCode[]): Actor => ({
  user: { id: 7, role: 'Mechanic' } as SessionUser,
  capabilities: new Set(codes),
  systemMode: 'Live',
});

const step = (executeCapability: PermissionCode | null): StepItem => ({
  spkStatus: 'Active',
  module: 'Any_Module',
  status: 'Open',
  executorRoles: ['Mechanic'],
  executeCapability,
});

describe('TASK-203 step policies from the module catalog (REQ-REG-006, REQ-ENG-003, DEC-148)', () => {
  it('REQ-REG-006 a step whose module has no code is refused "The module of this step is not available yet."', () => {
    expect(
      refusalOf(
        stepPolicies(['mechanic.execute']),
        actor(['mechanic.execute']),
        step(null),
        'submit',
      ),
    ).toBe('The module of this step is not available yet.');
  });

  it('REQ-ENG-003 the policy takes its L1 codes from the catalog', () => {
    const policies = stepPolicies(['mechanic.execute']);
    expect(policies.submit.anyOf).toEqual(['mechanic.execute']);
    expect(refusalOf(policies, actor(['stock.issue']), step('mechanic.execute'), 'submit')).toBe(
      'You do not have permission to do this.',
    );
    expect(
      refusalOf(policies, actor(['mechanic.execute']), step('mechanic.execute'), 'submit'),
    ).toBeNull();
  });
});
