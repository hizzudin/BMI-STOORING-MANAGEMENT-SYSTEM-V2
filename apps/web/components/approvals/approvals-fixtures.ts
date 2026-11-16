import type {
  ApprovalDecision,
  ApprovalHistoryItem,
  ApprovalInboxItem,
  ApprovalReview,
} from '@bmi/shared';
import { vi } from 'vitest';
import type { ApprovalsApi } from '../../lib/approvals-api';

export const urgentItem: ApprovalInboxItem = {
  spkId: 42,
  spkNumber: 'SPK-2611040142',
  priority: 'Urgent',
  vehicle: { id: 7, licensePlate: 'B 1234 ABC', className: 'Tractor head' },
  title: 'Brake pads front',
  category: 'Corrective',
  description: 'Pads worn to the indicator on the front axle.',
  kind: 'Creation',
  requestedBy: { name: 'Sari', role: 'Planner' },
  submittedAt: '2026-11-04T01:12:00.000Z',
  waitingSeconds: 42 * 60 + 10,
  yours: false,
  steps: [
    { sequenceNo: 1, name: 'Stock', executorRoles: ['Warehouse_Manager'] },
    { sequenceNo: 2, name: 'Part Replacement', executorRoles: ['Mechanic'] },
  ],
};

export const normalItem: ApprovalInboxItem = {
  ...urgentItem,
  spkId: 31,
  spkNumber: 'SPK-2611040131',
  priority: 'Normal',
  vehicle: { id: 8, licensePlate: 'B 7710 TR', className: 'Wingbox rigid' },
  title: 'PM 20.000 km',
  category: 'PM',
  description: 'Scheduled service.',
  waitingSeconds: 3 * 3600 + 2 * 60 + 44,
  yours: true,
  steps: [],
};

export const pendingReview: ApprovalReview = {
  ...urgentItem,
  status: 'Pending_Approval',
  version: 4,
  decision: null,
  allowedActions: ['approve', 'reject'],
};

export const approvedDecision: ApprovalDecision = {
  action: 'Approve',
  by: { name: 'Budi S.', role: 'Supervisor' },
  at: '2026-11-04T02:00:00.000Z',
  selfApproved: false,
  reason: null,
};

export const approvedReview: ApprovalReview = {
  ...pendingReview,
  status: 'Active',
  version: 5,
  decision: approvedDecision,
  allowedActions: [],
};

export const historyItems: ApprovalHistoryItem[] = [
  {
    spkId: 28,
    spkNumber: 'SPK-2611040128',
    vehicle: { id: 9, licensePlate: 'B 5521 UY', className: 'Tractor head' },
    kind: 'Creation',
    decision: {
      action: 'Approve',
      by: { name: 'Hendra', role: 'GM' },
      at: '2026-10-30T09:02:33.000Z',
      selfApproved: true,
      reason: null,
    },
    requestedBy: { name: 'Sari', role: 'Planner' },
  },
  {
    spkId: 25,
    spkNumber: 'SPK-2611040125',
    vehicle: { id: 10, licensePlate: 'B 3310 PQ', className: 'Pickup patrol' },
    kind: 'Creation',
    decision: {
      action: 'Reject',
      by: { name: 'Budi S.', role: 'Supervisor' },
      at: '2026-10-29T03:11:02.000Z',
      selfApproved: false,
      reason: 'Wrong vehicle',
    },
    requestedBy: { name: 'Sari', role: 'Planner' },
  },
];

const ok = <T>(data: T) => Promise.resolve({ ok: true as const, data });

/** An Approvals API whose calls the tests read back. */
export function fakeApprovalsApi(overrides: Partial<ApprovalsApi> = {}): ApprovalsApi {
  return {
    count: vi.fn(() => ok({ count: 2 })),
    inbox: vi.fn(() => ok({ items: [urgentItem, normalItem] })),
    review: vi.fn(() => ok({ review: pendingReview })),
    approve: vi.fn(() => ok({ review: approvedReview })),
    reject: vi.fn(() => ok({ review: pendingReview })),
    history: vi.fn(() => ok({ items: historyItems })),
    ...overrides,
  } as unknown as ApprovalsApi;
}
