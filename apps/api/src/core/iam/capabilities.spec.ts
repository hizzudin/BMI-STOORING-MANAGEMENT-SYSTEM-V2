import { defaultRolePermissions, type PermissionCode, type Role } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import { effectiveCapabilities, type CapabilityInputs } from './capabilities.js';

const NOW = new Date('2026-11-10T08:00:00+07:00');
const SIX_PM = new Date('2026-11-10T18:00:00+07:00');
const seeded = (role: Role): PermissionCode[] =>
  defaultRolePermissions()
    .filter((row) => row.role === role && row.allowed)
    .map((row) => row.permissionCode);

const inputs = (role: Role, overrides: Partial<CapabilityInputs> = {}): CapabilityInputs => ({
  role,
  allowedCodes: seeded(role),
  plannerApproval: { kinds: [], until: null },
  systemMode: 'Live',
  now: NOW,
  ...overrides,
});

describe('REQ-IAM-012 effective capability set', () => {
  it('REQ-IAM-012 is the allowed role_permissions codes of the role', () => {
    expect([...effectiveCapabilities(inputs('Accounting'))].sort()).toEqual(
      [...seeded('Accounting')].sort(),
    );
  });

  it('AC-IAM-008 the Planner gets spk.approve and not count.approve while the switch is on for SPK creation only', () => {
    const on = effectiveCapabilities(
      inputs('Planner', { plannerApproval: { kinds: ['spk_creation'], until: null } }),
    );
    expect(on.has('spk.approve')).toBe(true);
    expect(on.has('count.approve')).toBe(false);
    expect(effectiveCapabilities(inputs('Planner')).has('spk.approve')).toBe(false);
  });

  it('AC-IAM-005 RL-7 the switch ends at its end time', () => {
    const switched = { plannerApproval: { kinds: ['spk_completion' as const], until: SIX_PM } };
    expect(effectiveCapabilities(inputs('Planner', switched)).has('spk.approve')).toBe(true);
    expect(
      effectiveCapabilities(inputs('Planner', { ...switched, now: SIX_PM })).has('spk.approve'),
    ).toBe(false);
  });

  it('RL-7 a count kind adds count.approve, and the switch never reaches other roles', () => {
    const plannerApproval = { kinds: ['stock_opname' as const], until: null };
    expect(effectiveCapabilities(inputs('Planner', { plannerApproval })).has('count.approve')).toBe(
      true,
    );
    expect(
      effectiveCapabilities(inputs('Mechanic', { plannerApproval })).has('count.approve'),
    ).toBe(false);
  });

  it('REQ-IAM-010 Setup mode removes the blocked operational codes', () => {
    const setup = effectiveCapabilities(inputs('System_Admin', { systemMode: 'Setup' }));
    expect(setup.has('spk.create')).toBe(false);
    expect(setup.has('stock.issue')).toBe(false);
    expect(setup.has('vehicle.manage')).toBe(true);
    expect(setup.has('setup.golive')).toBe(true);
  });

  it('RL-4 the System Admin never holds accounts.manage, even if a row says so', () => {
    const codes = effectiveCapabilities(
      inputs('System_Admin', {
        allowedCodes: [...seeded('System_Admin'), 'accounts.manage', 'iam.planner_approval_switch'],
      }),
    );
    expect(codes.has('accounts.manage')).toBe(false);
    expect(codes.has('iam.planner_approval_switch')).toBe(false);
  });

  it('REQ-IAM-012 an account without a role holds nothing', () => {
    expect(effectiveCapabilities(inputs('Planner', { role: null })).size).toBe(0);
  });
});
