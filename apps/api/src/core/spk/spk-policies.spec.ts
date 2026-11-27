import {
  defaultRolePermissions,
  SPK_STATUSES,
  type PermissionCode,
  type Role,
  type SpkStatus,
} from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import type { SpkRow } from '../../ports/spks.js';
import { allowedActions, refusalOf, type Actor } from '../iam/actions.js';
import { effectiveCapabilities } from '../iam/capabilities.js';
import { SPK_MESSAGES, SPK_POLICIES } from './spk-service.js';

// TASK-124: T15 the approver cancel next to T6 the creator cancel (REQ-SPK-008, DEC-93, DEC-129, DEC-140).

const NOW = new Date('2026-11-27T08:00:00+07:00');
const CREATOR = 7;

function actor(id: number, role: Role): Actor {
  const allowedCodes: PermissionCode[] = defaultRolePermissions()
    .filter((row) => row.role === role && row.allowed)
    .map((row) => row.permissionCode);
  return {
    user: { id, name: role, email: `${role}@bmi.test`, role, mustChangePassword: false },
    capabilities: effectiveCapabilities({
      role,
      allowedCodes,
      plannerApproval: { kinds: [], until: null },
      systemMode: 'Live',
      now: NOW,
    }),
    systemMode: 'Live',
  };
}

function spk(status: SpkStatus): SpkRow {
  return {
    id: 1,
    spkNumber: 'SPK-2611270001',
    vehicleId: 1,
    vehicle: { id: 1, licensePlate: 'B 1234 APR', className: 'Tractor head' },
    title: 'Brake check',
    category: 'Corrective',
    requiresDowntime: false,
    requestSource: 'Manual_Planner',
    priority: 'Normal',
    description: '',
    status,
    createdBy: CREATOR,
    stepCount: 1,
    version: 1,
  };
}

const OPEN: SpkStatus[] = [
  'Draft',
  'Pending_Approval',
  'Rejected',
  'Active',
  'In_Progress',
  'Pending_Verification',
  'Pending_Amendment',
];
const APPROVERS: Role[] = ['Supervisor', 'GM', 'System_Admin'];

describe('T15 approverCancel', () => {
  it.each(APPROVERS.flatMap((role) => OPEN.map((status) => [role, status] as const)))(
    'T15 REQ-SPK-008 a %s may approverCancel an SPK in %s',
    (role, status) => {
      expect(refusalOf(SPK_POLICIES, actor(1, role), spk(status), 'approverCancel')).toBeNull();
    },
  );

  it.each(['Completed', 'Cancelled'] as const)(
    'T15 approverCancel is refused on a %s SPK with one sentence',
    (status) => {
      expect(SPK_MESSAGES.alreadyFinal).toBe('This SPK is already Completed or Cancelled.');
      expect(refusalOf(SPK_POLICIES, actor(1, 'Supervisor'), spk(status), 'approverCancel')).toBe(
        SPK_MESSAGES.alreadyFinal,
      );
    },
  );

  it.each(['Planner', 'Warehouse_Manager', 'Mechanic', 'Access_Manager'] as const)(
    'DEC-93 a %s holds no spk.cancel, so approverCancel is not in allowedActions',
    (role) => {
      expect(
        allowedActions(SPK_POLICIES, actor(CREATOR, role), spk('Pending_Approval')),
      ).not.toContain('approverCancel');
    },
  );

  it('DEC-140 the System Admin cancelling its own SPK while Live is not refused (BR-03 covers approvals)', () => {
    expect(
      refusalOf(SPK_POLICIES, actor(CREATOR, 'System_Admin'), spk('Active'), 'approverCancel'),
    ).toBeNull();
  });
});

describe('DEC-129 T6 creator cancel is unchanged', () => {
  it.each(SPK_STATUSES.map((status) => [status] as const))(
    'DEC-129 the creator Planner may cancel only a Draft or Rejected SPK: %s',
    (status) => {
      const allowed =
        refusalOf(SPK_POLICIES, actor(CREATOR, 'Planner'), spk(status), 'cancel') === null;
      expect(allowed).toBe(status === 'Draft' || status === 'Rejected');
    },
  );

  it('DEC-129 another Planner may not cancel it', () => {
    expect(refusalOf(SPK_POLICIES, actor(99, 'Planner'), spk('Draft'), 'cancel')).toBe(
      SPK_MESSAGES.onlyCreatorCancels,
    );
  });
});
