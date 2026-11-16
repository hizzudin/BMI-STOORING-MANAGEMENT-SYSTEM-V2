import type { Spk } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { CancelSpkDialog } from './CancelSpkDialog';

afterEach(cleanup);

const rejected: Spk = {
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
};

function show(cancel: SpksApi['cancel']) {
  const onCancelled = vi.fn();
  const onClose = vi.fn();
  render(
    <CancelSpkDialog
      api={{ cancel } as unknown as SpksApi}
      spk={rejected}
      onCancelled={onCancelled}
      onClose={onClose}
    />,
  );
  return { onCancelled, onClose };
}

const reason = () => screen.getByLabelText('Reason');
const confirm = () => screen.getByRole('button', { name: 'Cancel SPK' }) as HTMLButtonElement;

describe('Cancel SPK (T6, DEC-129, C-14)', () => {
  it('T6 the reason is required; Cancel SPK sends the version, the reason and a key', async () => {
    const cancelled = { ...rejected, status: 'Cancelled' as const, allowedActions: [] };
    const cancel = vi.fn(() => Promise.resolve({ ok: true as const, data: { spk: cancelled } }));
    const { onCancelled } = show(cancel as unknown as SpksApi['cancel']);
    expect(screen.getByRole('dialog', { name: 'Cancel SPK-2611040125?' })).toBeTruthy();
    expect(confirm().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: '   ' } });
    expect(confirm().disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: ' Raised twice ' } });
    await act(async () => fireEvent.click(confirm()));
    expect(cancel).toHaveBeenCalledWith(
      25,
      { version: 4, reason: 'Raised twice' },
      expect.any(String),
    );
    expect(onCancelled).toHaveBeenCalledWith(cancelled);
  });

  it('C-14 Keep SPK and Escape close it without sending', () => {
    const cancel = vi.fn();
    const { onClose } = show(cancel as unknown as SpksApi['cancel']);
    fireEvent.click(screen.getByRole('button', { name: 'Keep SPK' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('C-34 a refusal shows its sentence; a retry keeps the same key (NFR-01)', async () => {
    const cancel = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        status: 409,
        message: 'Someone changed this SPK. Reload it.',
      }),
    );
    show(cancel as unknown as SpksApi['cancel']);
    fireEvent.change(reason(), { target: { value: 'Raised twice' } });
    await act(async () => fireEvent.click(confirm()));
    expect(screen.getByRole('alert').textContent).toBe('Someone changed this SPK. Reload it.');
    await act(async () => fireEvent.click(confirm()));
    const calls = cancel.mock.calls as unknown as [number, unknown, string][];
    expect(calls[1]?.[2]).toBe(calls[0]?.[2]);
  });
});
