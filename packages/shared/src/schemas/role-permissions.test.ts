import { describe, expect, it } from 'vitest';
import { RolePermissionsChangeRequestSchema } from './role-permissions.js';

const change = { role: 'Accounting', permissionCode: 'vehicle.view', allowed: false } as const;

describe('DEC-117 the staged matrix changes', () => {
  it('REQ-IAM-005 accepts one change per cell', () => {
    expect(RolePermissionsChangeRequestSchema.parse({ changes: [change] })).toEqual({
      changes: [change],
    });
  });

  it('refuses an empty save, the same cell twice, an unknown code or role', () => {
    const issue = (body: unknown) =>
      RolePermissionsChangeRequestSchema.safeParse(body).error?.issues[0]?.message;
    expect(issue({ changes: [] })).toBe('Change at least one cell.');
    expect(issue({ changes: [change, { ...change, allowed: true }] })).toBe(
      'Each cell may change once.',
    );
    expect(issue({ changes: [{ ...change, permissionCode: 'spk.delete' }] })).toBeDefined();
    expect(issue({ changes: [{ ...change, role: 'Admin' }] })).toBeDefined();
  });
});
