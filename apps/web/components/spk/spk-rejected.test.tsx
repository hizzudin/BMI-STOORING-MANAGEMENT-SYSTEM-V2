import type { SpkDetail as Detail } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { SpkDetail } from './SpkDetail';

afterEach(cleanup);

const rejected: Detail = {
  spk: {
    id: 25,
    spkNumber: 'SPK-2611040125',
    vehicle: { id: 8, licensePlate: 'B 7710 TR', className: 'Trailer tail' },
    title: 'Clutch replacement',
    category: 'Corrective',
    priority: 'Normal',
    requiresDowntime: true,
    description: 'Kopling selip di tanjakan.',
    requestSource: 'Manual_Planner',
    status: 'Rejected',
    stepCount: 2,
    version: 4,
    allowedActions: ['edit', 'submit', 'cancel'],
  },
  vehicle: {
    id: 8,
    licensePlate: 'B 7710 TR',
    className: 'Trailer tail',
    unitKind: 'Towed',
    currentOdometer: 0,
  },
  createdBy: { name: 'Sari', role: 'Planner' },
  steps: [1, 2].map((sequenceNo) => ({
    id: sequenceNo,
    sequenceNo,
    name: sequenceNo === 1 ? 'Stock' : 'Mechanic Action',
    status: 'Locked' as const,
    executorRoles: [sequenceNo === 1 ? ('Warehouse_Manager' as const) : ('Mechanic' as const)],
    assignee: null,
    openedAt: null,
    submittedAt: null,
    verifiedAt: null,
    verifiedBy: null,
    allowedActions: [],
  })),
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
      action: 'Reject',
      by: { name: 'Hendra', role: 'GM' },
      actedAt: '2026-11-02T09:40:12Z',
      note: 'Combine with the clutch job on SPK-2611040131.',
      selfApproved: false,
    },
  ],
  costs: { labor: '0.00', parts: '0.00', document: '0.00', stooring: '0.00', total: '0.00' },
};

async function show(
  detail: Detail = rejected,
  extra: Partial<Record<keyof SpksApi, unknown>> = {},
) {
  const navigate = vi.fn();
  const api = {
    getDetail: vi.fn(() => Promise.resolve({ ok: true as const, data: { detail } })),
    ...extra,
  } as unknown as SpksApi;
  await act(async () => {
    render(<SpkDetail api={api} id={25} navigate={navigate} />);
  });
  return navigate;
}

describe('SPKRejected (REQ-SPK-007, AC-SPK-005, DEC-101, DEC-129)', () => {
  it('AC-SPK-005 the rejector, the time and the reason, with the SPK and its steps', async () => {
    await show();
    expect(screen.getByText('Surat Perintah Kerja / SPK-2611040125')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Clutch replacement');
    expect(screen.getByText('Rejected', { selector: '.pill' })).toBeTruthy();
    expect(screen.getByText('Rejected by GM Hendra · 2026-11-02 16:40:12')).toBeTruthy();
    expect(screen.getByText('Combine with the clutch job on SPK-2611040131.')).toBeTruthy();
    expect(screen.getByText('Kopling selip di tanjakan.')).toBeTruthy();
    expect(screen.getByText('Mechanic Action')).toBeTruthy();
    expect(screen.getAllByText('Locked')).toHaveLength(2);
    // DEC-129: SPK document waits for its task; SPKDetail's tabs are not on this page.
    expect(screen.queryByText('SPK document')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'History' })).toBeNull();
  });

  it('T5 DEC-101 its creator may edit and resubmit, or cancel it', async () => {
    await show();
    expect(screen.getByText(/It stays Rejected with this note/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit and resubmit' }).getAttribute('href')).toBe(
      '/spk/25/edit',
    );
    expect(screen.getByRole('button', { name: 'Cancel SPK' })).toBeTruthy();
  });

  it('DQ-06 anyone else reads it only: no Edit and resubmit, no Cancel SPK', async () => {
    await show({ ...rejected, spk: { ...rejected.spk, allowedActions: [] } });
    expect(screen.getByText('Rejected by GM Hendra · 2026-11-02 16:40:12')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Edit and resubmit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel SPK' })).toBeNull();
  });

  it('T6 DEC-129 Cancel SPK asks for a reason, then the page moves to the Cancelled tab', async () => {
    const cancel = vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        data: { spk: { ...rejected.spk, status: 'Cancelled', allowedActions: [] } },
      }),
    );
    const navigate = await show(rejected, { cancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel SPK' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel SPK-2611040125?' });
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Raised twice' } });
    await act(async () => {
      fireEvent.click(dialog.querySelector('.btn-danger') as HTMLButtonElement);
    });
    expect(cancel).toHaveBeenCalledWith(
      25,
      { version: 4, reason: 'Raised twice' },
      expect.any(String),
    );
    expect(navigate).toHaveBeenCalledWith('/spk?tab=cancelled');
  });
});

describe('SPKRejected Cancel SPK for an Approver (T15, DEC-140)', () => {
  const forApprover: Detail = {
    ...rejected,
    spk: { ...rejected.spk, allowedActions: ['approverCancel'] },
  };

  it('DEC-140 an Approver cancels a Rejected SPK through CancelSPK and lands on the Cancelled tab', async () => {
    const approverCancel = vi.fn(() =>
      Promise.resolve({
        ok: true as const,
        data: { spk: { ...forApprover.spk, status: 'Cancelled' as const, allowedActions: [] } },
      }),
    );
    const navigate = await show(forApprover, { approverCancel });
    expect(screen.queryByRole('link', { name: 'Edit and resubmit' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel SPK' }));
    expect(
      screen.getByText(
        'Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified.',
      ),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Not needed' } });
    const dialog = screen.getByRole('dialog');
    const confirm = [...dialog.querySelectorAll('button')].find(
      (button) => button.textContent === 'Cancel SPK',
    );
    await act(async () => {
      if (confirm) fireEvent.click(confirm);
    });
    expect(approverCancel).toHaveBeenCalledWith(
      25,
      { version: 4, reason: 'Not needed' },
      expect.any(String),
    );
    expect(navigate).toHaveBeenCalledWith('/spk?tab=cancelled');
  });

  it('DEC-129 the creator keeps its own cancel when it holds both (the System Admin): one Cancel SPK, the T6 dialog', async () => {
    const both: Detail = {
      ...rejected,
      spk: { ...rejected.spk, allowedActions: ['edit', 'submit', 'cancel', 'approverCancel'] },
    };
    await show(both);
    expect(screen.getAllByRole('button', { name: 'Cancel SPK' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel SPK' }));
    expect(screen.getByRole('button', { name: 'Keep SPK' })).toBeTruthy();
  });
});
