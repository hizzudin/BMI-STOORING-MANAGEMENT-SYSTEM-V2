import { defaultRolePermissions, type PermissionCode, type Role } from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  inState,
  isSelfDecision,
  NOT_ALLOWED,
  notOwnWork,
  onlyOwner,
  refusalOf,
  withinScope,
  type Actor,
  type Policies,
} from './actions.js';
import { effectiveCapabilities } from './capabilities.js';

const NOW = new Date('2026-11-10T08:00:00+07:00');

function actor(id: number, role: Role, plannerApproval = false): Actor {
  const allowedCodes: PermissionCode[] = defaultRolePermissions()
    .filter((row) => row.role === role && row.allowed)
    .map((row) => row.permissionCode);
  return {
    user: { id, name: role, email: `${role}@bmi.test`, role, mustChangePassword: false },
    capabilities: effectiveCapabilities({
      role,
      allowedCodes,
      plannerApproval: { kinds: plannerApproval ? ['spk_creation'] : [], until: null },
      systemMode: 'Live',
      now: NOW,
    }),
  };
}

// A record shaped like the invoice of AC-IAM-010.
interface Invoice {
  status: 'Draft' | 'Issued' | 'Paid';
}
type InvoiceAction = 'issue' | 'mark_paid' | 'void';
const invoicePolicies: Policies<Invoice, InvoiceAction> = {
  issue: {
    anyOf: ['invoice.manage'],
    rules: [inState((i) => i.status, ['Draft'], 'Only a draft can be issued.')],
  },
  mark_paid: {
    anyOf: ['invoice.manage'],
    rules: [inState((i) => i.status, ['Issued'], 'Only an issued invoice can be paid.')],
  },
  void: {
    anyOf: ['invoice.manage'],
    rules: [inState((i) => i.status, ['Issued'], 'Only an issued invoice can be voided.')],
  },
};

// A record shaped like an SPK waiting for approval.
interface Order {
  status: 'Draft' | 'Pending_Approval' | 'Approved';
  createdBy: number;
  vehicleId: number;
}
type OrderAction = 'submit' | 'approve' | 'issue_part';
const OWN_ORDER = 'You cannot approve an SPK you created.';
const orderPolicies: Policies<Order, OrderAction> = {
  submit: {
    anyOf: ['spk.create'],
    rules: [
      inState((o) => o.status, ['Draft'], 'Only a draft can be submitted.'),
      onlyOwner((o) => o.createdBy, 'Only its creator can submit this draft.'),
    ],
  },
  approve: {
    anyOf: ['spk.approve'],
    rules: [
      inState((o) => o.status, ['Pending_Approval'], 'This SPK is not waiting for approval.'),
      notOwnWork((o) => o.createdBy, OWN_ORDER),
    ],
  },
  issue_part: {
    anyOf: ['stock.issue'],
    rules: [
      withinScope(
        (o, input) => (input as { vehicleId: number }).vehicleId === o.vehicleId,
        'This part is for another vehicle than the SPK names.',
      ),
    ],
  },
};

const pending: Order = { status: 'Pending_Approval', createdBy: 1, vehicleId: 7 };

describe('REQ-IAM-014 allowedActions', () => {
  it('AC-IAM-010 the Supervisor may mark an Issued invoice paid or void it; the GM sees no action', () => {
    const issued: Invoice = { status: 'Issued' };
    expect(allowedActions(invoicePolicies, actor(2, 'Supervisor'), issued)).toEqual([
      'mark_paid',
      'void',
    ]);
    expect(allowedActions(invoicePolicies, actor(3, 'GM'), issued)).toEqual([]);
  });

  it('AC-IAM-010 the GM sending mark_paid directly is refused by the same function', () => {
    expect(() =>
      assertAllowed(invoicePolicies, actor(3, 'GM'), { status: 'Issued' }, 'mark_paid'),
    ).toThrow(new ActionRefusedError('mark_paid', NOT_ALLOWED));
  });

  it('REQ-IAM-014 the list follows the state of the record', () => {
    expect(allowedActions(invoicePolicies, actor(2, 'Supervisor'), { status: 'Draft' })).toEqual([
      'issue',
    ]);
    expect(allowedActions(invoicePolicies, actor(2, 'Supervisor'), { status: 'Paid' })).toEqual([]);
  });

  it('AC-IAM-010 BR-03 a Planner with the switch on never approves an SPK it created', () => {
    expect(allowedActions(orderPolicies, actor(1, 'Planner', true), pending)).not.toContain(
      'approve',
    );
    expect(refusalOf(orderPolicies, actor(1, 'Planner', true), pending, 'approve')).toBe(OWN_ORDER);
    expect(allowedActions(orderPolicies, actor(9, 'Planner', true), pending)).toContain('approve');
    expect(allowedActions(orderPolicies, actor(9, 'Planner'), pending)).not.toContain('approve');
  });

  it('BR-03 the System Admin may approve its own SPK, and the decision is marked as self', () => {
    const admin = actor(1, 'System_Admin');
    expect(allowedActions(orderPolicies, admin, pending)).toContain('approve');
    expect(isSelfDecision(admin, pending.createdBy)).toBe(true);
    expect(isSelfDecision(actor(2, 'Supervisor'), pending.createdBy)).toBe(false);
  });

  it('REQ-IAM-014 only the creator submits its draft', () => {
    const draft: Order = { status: 'Draft', createdBy: 1, vehicleId: 7 };
    expect(allowedActions(orderPolicies, actor(1, 'Planner'), draft)).toContain('submit');
    expect(allowedActions(orderPolicies, actor(9, 'Planner'), draft)).not.toContain('submit');
  });

  it('BR-02 the scope lock passes while listing and is checked when the action is sent', () => {
    const warehouse = actor(4, 'Warehouse_Manager');
    expect(allowedActions(orderPolicies, warehouse, pending)).toContain('issue_part');
    expect(() =>
      assertAllowed(orderPolicies, warehouse, pending, 'issue_part', { vehicleId: 7 }),
    ).not.toThrow();
    expect(() =>
      assertAllowed(orderPolicies, warehouse, pending, 'issue_part', { vehicleId: 8 }),
    ).toThrow('This part is for another vehicle than the SPK names.');
  });

  it('REQ-IAM-014 every listed action is accepted and every other action is refused', () => {
    for (const role of ['Planner', 'Supervisor', 'GM', 'System_Admin', 'Mechanic'] as const) {
      const who = actor(5, role);
      const listed = new Set(allowedActions(orderPolicies, who, pending));
      for (const action of Object.keys(orderPolicies) as OrderAction[]) {
        expect(refusalOf(orderPolicies, who, pending, action) === null, `${role} ${action}`).toBe(
          listed.has(action),
        );
      }
    }
  });
});
