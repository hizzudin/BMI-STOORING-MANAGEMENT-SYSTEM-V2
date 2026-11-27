import {
  defaultRolePermissions,
  type PermissionCode,
  type Role,
  type SpkStatus,
} from '@bmi/shared';
import { describe, expect, it } from 'vitest';
import type { SpkCancelSteps } from '../../ports/spk-cancel-steps.js';
import type { SpkGateways, SpkRow } from '../../ports/spks.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { Actor } from '../iam/actions.js';
import { effectiveCapabilities } from '../iam/capabilities.js';
import { SpkService } from './spk-service.js';

// TASK-124: TX-14 of the approver cancel with a recording fake (T15, REQ-SPK-008, DEC-140). The
// real transaction and its rollback are proven in test/integration/spk/spk-approver-cancel.test.ts.

const NOW = new Date('2026-11-27T08:00:00+07:00');
const CREATOR = 7;
const SUPERVISOR = 3;

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

function row(status: SpkStatus): SpkRow {
  return {
    id: 41,
    spkNumber: 'SPK-2611270041',
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
    version: 3,
  };
}

/** Every call the service makes, in order, with its argument. */
function recorder(status: SpkStatus, failAt?: keyof SpkCancelSteps) {
  const calls: { name: string; arg?: unknown }[] = [];
  let current = row(status);
  const record = (name: string, arg?: unknown) => {
    calls.push({ name, arg });
    if (name === failAt) return Promise.reject(new Error(`${name} failed`));
    return Promise.resolve();
  };
  const cancelSteps: SpkCancelSteps = {
    reversePostedIssues: (spkId) => record('reversePostedIssues', spkId),
    releaseIssuedTyres: (spkId) => record('releaseIssuedTyres', spkId),
    listPurchasedItems: (spkId) => record('listPurchasedItems', spkId),
    leaveOpenSchedule: (spkId) => record('leaveOpenSchedule', spkId),
    reopenReportBreakdown: (spkId) => record('reopenReportBreakdown', spkId),
  };
  const gateways = {
    cancelSteps,
    spks: {
      findById: () => Promise.resolve(current),
      cancel: (_id: number, version: number, cancelled: unknown) => {
        current = { ...current, status: 'Cancelled', version: version + 1 };
        return record('cancel', cancelled);
      },
      insertApproval: (approval: unknown) => record('insertApproval', approval),
    },
    audit: { write: (entry: unknown) => record('audit', entry) },
    notifications: {
      send: (userIds: readonly number[], notice: unknown) => record('notify', { userIds, notice }),
    },
    idempotency: {
      claim: () => Promise.resolve({ kind: 'new' as const }),
      store: () => Promise.resolve(),
    },
  } as unknown as SpkGateways;
  const unitOfWork: UnitOfWork<SpkGateways> = { run: (work) => work(gateways) };
  const service = new SpkService(unitOfWork, { now: () => NOW, wibToday: () => '2026-11-27' });
  return { calls, service };
}

const KEY = { key: 'k-1', requestHash: 'h-1' };
const REQUEST = { version: 3, reason: 'Vehicle sold' };

describe('TX-14 approver cancel', () => {
  it('TX-14 DEC-140 the steps run in the order reverse issues, release tyres, purchased items, schedule, report, then Cancelled, the approval row, the audit record and the notice', async () => {
    const { calls, service } = recorder('Active');
    const outcome = await service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY);
    expect(outcome.status).toBe(200);
    expect(calls.map((call) => call.name)).toEqual([
      'reversePostedIssues',
      'releaseIssuedTyres',
      'listPurchasedItems',
      'leaveOpenSchedule',
      'reopenReportBreakdown',
      'cancel',
      'insertApproval',
      'audit',
      'notify',
    ]);
    expect(calls.find((call) => call.name === 'cancel')?.arg).toEqual({
      reason: 'Vehicle sold',
      by: SUPERVISOR,
    });
  });

  it.each([
    ['Draft', 'Creation'],
    ['Pending_Approval', 'Creation'],
    ['Rejected', 'Creation'],
    ['Active', 'Completion'],
    ['In_Progress', 'Completion'],
    ['Pending_Verification', 'Completion'],
    ['Pending_Amendment', 'Amendment'],
  ] as const)(
    'T15 REQ-SPK-008 a Cancel approval row of an SPK in %s carries the reason at stage %s',
    async (status, stage) => {
      const { calls, service } = recorder(status);
      await service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY);
      expect(calls.find((call) => call.name === 'insertApproval')?.arg).toEqual({
        spkId: 41,
        stage,
        action: 'Cancel',
        actedBy: SUPERVISOR,
        approverRole: 'Supervisor',
        note: 'Vehicle sold',
      });
    },
  );

  it('NFR-02 one audit record approver_cancel with before, after and the reason', async () => {
    const { calls, service } = recorder('Pending_Approval');
    await service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY);
    const audit = calls.find((call) => call.name === 'audit')?.arg as Record<string, unknown>;
    expect(audit).toMatchObject({
      entity: 'spk',
      entityId: 41,
      action: 'approver_cancel',
      reason: 'Vehicle sold',
      userId: SUPERVISOR,
      userRole: 'Supervisor',
    });
    expect((audit.before as SpkRow).status).toBe('Pending_Approval');
    expect((audit.after as SpkRow).status).toBe('Cancelled');
  });

  it('DEC-140 the creator is notified with kind Approval, the reason and dedupe key spk:<id>:cancel', async () => {
    const { calls, service } = recorder('Active');
    await service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY);
    expect(calls.find((call) => call.name === 'notify')?.arg).toEqual({
      userIds: [CREATOR],
      notice: {
        kind: 'Approval',
        title: 'SPK-2611270041 was cancelled',
        body: 'Vehicle sold',
        linkRecord: '/spk/41',
        dedupeKey: 'spk:41:cancel',
      },
    });
  });

  it('DEC-140 nobody is notified when the Approver cancels an SPK it created', async () => {
    const { calls, service } = recorder('Active');
    await service.approverCancel(actor(CREATOR, 'System_Admin'), 41, REQUEST, KEY);
    expect(calls.map((call) => call.name)).not.toContain('notify');
  });

  it('TX-14 a step that fails stops the cancel: no Cancelled write, approval row, audit record or notice', async () => {
    const { calls, service } = recorder('Active', 'releaseIssuedTyres');
    await expect(
      service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY),
    ).rejects.toThrow('releaseIssuedTyres failed');
    expect(calls.map((call) => call.name)).toEqual(['reversePostedIssues', 'releaseIssuedTyres']);
  });

  it('T15 a Completed SPK is refused before any step runs', async () => {
    const { calls, service } = recorder('Completed');
    await expect(
      service.approverCancel(actor(SUPERVISOR, 'Supervisor'), 41, REQUEST, KEY),
    ).rejects.toThrow('This SPK is already Completed or Cancelled.');
    expect(calls).toEqual([]);
  });
});
