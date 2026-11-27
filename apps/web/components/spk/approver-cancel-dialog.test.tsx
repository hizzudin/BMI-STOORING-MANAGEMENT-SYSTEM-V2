import type { Spk } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { ApproverCancelDialog } from './CancelSpkDialog';

afterEach(cleanup);

// TASK-124: the CancelSPK artboard for an Approver (REQ-SPK-008, T15, C-14, DEC-122, DEC-140).

const waiting: Spk = {
  id: 41,
  spkNumber: 'SPK-2611270041',
  vehicle: { id: 8, licensePlate: 'B 1234 APR', className: 'Tractor head' },
  title: 'Brake check',
  category: 'Corrective',
  priority: 'Normal',
  requiresDowntime: false,
  description: 'Rem blong.',
  requestSource: 'Manual_Planner',
  status: 'Pending_Approval',
  stepCount: 2,
  version: 3,
  allowedActions: ['approverCancel'],
};

function show(approverCancel: SpksApi['approverCancel']) {
  const onCancelled = vi.fn();
  const onClose = vi.fn();
  render(
    <ApproverCancelDialog
      api={{ approverCancel } as unknown as SpksApi}
      spk={waiting}
      onCancelled={onCancelled}
      onClose={onClose}
    />,
  );
  return { onCancelled, onClose };
}

const reason = () => screen.getByLabelText('Reason');
const confirm = () => screen.getByRole('button', { name: 'Cancel SPK' }) as HTMLButtonElement;
const cancelled = { ...waiting, status: 'Cancelled' as const, allowedActions: [] };
const resolved = () =>
  vi.fn(() => Promise.resolve({ ok: true as const, data: { spk: cancelled } }));

describe('CancelSPK for an Approver (T15, DEC-140)', () => {
  it('REQ-SPK-008 the dialog shows the artboard texts and the reason is required', () => {
    const approverCancel = resolved();
    show(approverCancel as unknown as SpksApi['approverCancel']);
    expect(screen.getByRole('dialog', { name: 'Cancel SPK-2611270041?' })).toBeTruthy();
    expect(
      screen.getByText(
        'Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep the SPK' })).toBeTruthy();
    expect(confirm().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: '   ' } });
    expect(confirm().disabled).toBe(true);
    expect(approverCancel).not.toHaveBeenCalled();
  });

  it('DEC-122 the SPK document link of the artboard is not shown before TASK-212', () => {
    show(resolved() as unknown as SpksApi['approverCancel']);
    expect(screen.queryByText('SPK document')).toBeNull();
  });

  it('REQ-SPK-008 NFR-01 Cancel SPK sends the version and the trimmed reason; a retry reuses the key', async () => {
    const approverCancel = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 0, message: 'The server cannot be reached.' })
      .mockResolvedValueOnce({ ok: true, data: { spk: cancelled } });
    const { onCancelled } = show(approverCancel as unknown as SpksApi['approverCancel']);
    fireEvent.change(reason(), { target: { value: ' Vehicle sold ' } });
    await act(async () => fireEvent.click(confirm()));
    expect(screen.getByText('The server cannot be reached.')).toBeTruthy();
    await act(async () => fireEvent.click(confirm()));
    expect(approverCancel).toHaveBeenCalledTimes(2);
    const [first, second] = approverCancel.mock.calls;
    expect(first?.slice(0, 2)).toEqual([41, { version: 3, reason: 'Vehicle sold' }]);
    expect(second?.[2]).toBe(first?.[2]);
    expect(onCancelled).toHaveBeenCalledWith(cancelled);
  });

  it('REQ-SPK-008 a refusal shows its one sentence in the dialog', async () => {
    const approverCancel = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        status: 403,
        message: 'This SPK is already Completed or Cancelled.',
      }),
    );
    const { onCancelled } = show(approverCancel as unknown as SpksApi['approverCancel']);
    fireEvent.change(reason(), { target: { value: 'Vehicle sold' } });
    await act(async () => fireEvent.click(confirm()));
    expect(screen.getByText('This SPK is already Completed or Cancelled.')).toBeTruthy();
    expect(onCancelled).not.toHaveBeenCalled();
  });

  it('C-14 Keep the SPK, Escape and the scrim close it unchanged', () => {
    const approverCancel = resolved();
    const { onClose } = show(approverCancel as unknown as SpksApi['approverCancel']);
    fireEvent.click(screen.getByRole('button', { name: 'Keep the SPK' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(approverCancel).not.toHaveBeenCalled();
  });
});
