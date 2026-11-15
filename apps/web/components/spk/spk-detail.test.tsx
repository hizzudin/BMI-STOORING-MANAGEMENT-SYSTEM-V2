import type { SpkDetail as Detail } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { SpkDetail } from './SpkDetail';

afterEach(cleanup);

const detail: Detail = {
  spk: {
    id: 9,
    spkNumber: 'SPK-2611040139',
    vehicle: { id: 7, licensePlate: 'B 9012 KX', className: 'Tractor head' },
    title: 'PM 20.000 km',
    category: 'PM',
    priority: 'High',
    requiresDowntime: true,
    description: 'Service.',
    requestSource: 'Manual_Planner',
    status: 'In_Progress',
    stepCount: 3,
    version: 3,
    allowedActions: [],
  },
  vehicle: {
    id: 7,
    licensePlate: 'B 9012 KX',
    className: 'Tractor head',
    unitKind: 'Powered',
    currentOdometer: 48210,
  },
  createdBy: { name: 'Sari', role: 'Planner' },
  steps: [
    {
      id: 1,
      sequenceNo: 1,
      name: 'Stock',
      status: 'Verified',
      executorRoles: ['Warehouse_Manager'],
      assignee: { name: 'Andi', role: 'Warehouse_Manager' },
      openedAt: '2026-11-03T00:00:00Z',
      submittedAt: '2026-11-03T01:02:11Z',
      verifiedAt: '2026-11-03T01:20:40Z',
      verifiedBy: { name: 'Sari', role: 'Planner' },
    },
    {
      id: 2,
      sequenceNo: 2,
      name: 'Part Purchase',
      status: 'Open',
      executorRoles: ['Field_Coordinator'],
      assignee: null,
      openedAt: '2026-11-03T01:02:11Z',
      submittedAt: null,
      verifiedAt: null,
      verifiedBy: null,
    },
    {
      id: 3,
      sequenceNo: 3,
      name: 'Mechanic Action',
      status: 'Locked',
      executorRoles: ['Mechanic'],
      assignee: null,
      openedAt: null,
      submittedAt: null,
      verifiedAt: null,
      verifiedBy: null,
    },
  ],
  approvals: [
    {
      stage: 'Creation',
      action: 'Submit',
      by: { name: 'Sari', role: 'Planner' },
      actedAt: '2026-11-02T08:12:03Z',
      note: null,
      selfApproved: false,
    },
    {
      stage: 'Creation',
      action: 'Approve',
      by: { name: 'Budi S.', role: 'Supervisor' },
      actedAt: '2026-11-02T09:40:12Z',
      note: null,
      selfApproved: false,
    },
  ],
  costs: {
    labor: '0.00',
    parts: '1240000.00',
    document: '0.00',
    stooring: '0.00',
    total: '1240000.00',
  },
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

async function show(getDetail = vi.fn(() => ok({ detail }))) {
  await act(async () => {
    render(<SpkDetail api={{ getDetail } as unknown as SpksApi} id={9} />);
  });
  return getDetail;
}

describe('SPKDetail (REQ-SPK-011, DEC-127)', () => {
  it('REQ-SPK-011 the header, subline, step tracker and step cards', async () => {
    const getDetail = await show();
    expect(getDetail).toHaveBeenCalledWith(9);
    expect(screen.getByText('Surat Perintah Kerja / SPK-2611040139')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'PM 20.000 km' })).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
    expect(screen.getByText(/created by Planner Sari/).textContent).toContain(
      'approved by Supervisor Budi S.',
    );
    expect(screen.getByText('Stock · Warehouse Manager Andi')).toBeTruthy();
    expect(screen.getByText('Submitted 08:02:11 · verified by Sari 08:20:40')).toBeTruthy();
    expect(screen.getByText('Part Purchase · Field Coordinator')).toBeTruthy();
    expect(screen.getByText('Opens when step 2 is submitted')).toBeTruthy();
    expect(screen.getByRole('listitem', { current: 'step' }).textContent).toContain(
      'Part Purchase',
    );
    expect(screen.getByText('Rp 1.240.000')).toBeTruthy();
  });

  it('ui.md 7.5 ApprovalBlock: the creation stamp is set, completion waits', async () => {
    await show();
    expect(screen.getByText('Supervisor Budi S.')).toBeTruthy();
    expect(screen.getByText('Not approved yet')).toBeTruthy();
  });

  it('REQ-SPK-011 History lists the approval rows, newest first', async () => {
    await show();
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      '2026-11-02 16:40:12Supervisor Budi S.Approved creation',
      '2026-11-02 15:12:03Planner SariSubmitted for approval',
    ]);
  });

  it('DEC-127 what later tasks build is not shown', async () => {
    await show();
    for (const name of ['Parts and services', 'Cost', 'Change requests']) {
      expect(screen.queryByRole('tab', { name })).toBeNull();
    }
    for (const name of [
      'SPK document',
      'Raise change request',
      'Cancel SPK',
      'Reverse issue',
      'Assign step',
      'Reassign',
      'Correct time',
      'Open step',
    ]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
      expect(screen.queryByRole('link', { name })).toBeNull();
    }
    expect(screen.queryByText(/Report reference/)).toBeNull();
    expect(screen.queryByText('Planned day')).toBeNull();
    expect(screen.queryByText('Work location')).toBeNull();
  });

  it('REQ-SPK-011 an SPK that does not exist shows the sentence', async () => {
    await show(
      vi.fn(() =>
        Promise.resolve({ ok: false as const, status: 404, message: 'This SPK does not exist.' }),
      ) as never,
    );
    expect(screen.getByRole('alert').textContent).toBe('This SPK does not exist.');
  });
});
