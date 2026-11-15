import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalReview } from './ApprovalReview';
import {
  approvedDecision,
  approvedReview,
  fakeApprovalsApi,
  pendingReview,
} from './approvals-fixtures';

afterEach(() => {
  cleanup();
});

async function show(api = fakeApprovalsApi()) {
  await act(async () => render(<ApprovalReview api={api} id={42} />));
  return api;
}

const reason = () => screen.getByLabelText('Reason (required to reject)');

describe('ApprovalReview (REQ-APR-004, REQ-SPK-005 to REQ-SPK-007, C-24, C-25, DEC-128)', () => {
  it('REQ-APR-004 the header, the SPK and its steps; DEC-128 hides the report reference and part age', async () => {
    await show();
    expect(screen.getByText('Approvals / SPK-2611040142')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Creation review');
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to inbox' }).getAttribute('href')).toBe(
      '/approvals',
    );
    expect(screen.getByText('SPK-2611040142 · B 1234 ABC · Corrective')).toBeTruthy();
    expect(screen.getByText('Part Replacement')).toBeTruthy();
    expect(screen.getByText('Warehouse Manager')).toBeTruthy();
    expect(screen.queryByText(/Report reference/)).toBeNull();
    expect(screen.queryByText('Part age')).toBeNull();
    expect(screen.getByText('Waiting for a decision')).toBeTruthy();
  });

  it('C-25 Reject stays disabled until the reason has text, then sends it with the version and a key', async () => {
    const api = await show();
    const reject = screen.getByRole('button', { name: 'Reject' }) as HTMLButtonElement;
    expect(reject.disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: '   ' } });
    expect(reject.disabled).toBe(true);
    fireEvent.change(reason(), { target: { value: 'Wrong vehicle' } });
    expect(reject.disabled).toBe(false);
    await act(async () => fireEvent.click(reject));
    expect(api.reject).toHaveBeenCalledWith(
      42,
      { version: 4, reason: 'Wrong vehicle' },
      expect.any(String),
    );
  });

  it('C-24 REQ-SPK-005 Approve commits at once: the stamp, Decided and the way back', async () => {
    const api = await show();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve' })));
    expect(api.approve).toHaveBeenCalledWith(42, { version: 4 }, expect.any(String));
    const stamp = screen.getByText('Approved by Supervisor: Budi S.').closest('.stamp');
    expect(stamp?.className).toContain('done');
    expect(stamp?.className).toContain('stamp-in');
    expect(screen.getByText('Decided')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });

  it('NFR-01 a retry of the same decision sends the same Idempotency-Key', async () => {
    const approve = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        status: 0,
        message: 'The server did not answer.',
      })
      .mockResolvedValue({ ok: true as const, data: { review: approvedReview } });
    await show(fakeApprovalsApi({ approve }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve' })));
    expect(screen.getByRole('alert').textContent).toBe('The server did not answer.');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve' })));
    expect(approve.mock.calls[1]?.[2]).toBe(approve.mock.calls[0]?.[2]);
  });

  it('AC-SPK-006 a self decision reads Self-approved; a decided item opens read only without animation', async () => {
    await show(
      fakeApprovalsApi({
        review: vi.fn(() =>
          Promise.resolve({
            ok: true as const,
            data: {
              review: {
                ...approvedReview,
                decision: { ...approvedDecision, selfApproved: true },
              },
            },
          }),
        ),
      }),
    );
    expect(screen.getByText('Self-approved')).toBeTruthy();
    expect(
      screen.getByText('Approved by Supervisor: Budi S.').closest('.stamp')?.className,
    ).not.toContain('stamp-in');
    expect(screen.queryByLabelText('Reason (required to reject)')).toBeNull();
  });

  it('AC-SPK-001 C-34 a refused decision shows its sentence; an item the user may not decide says so', async () => {
    await show(
      fakeApprovalsApi({
        approve: vi.fn(() =>
          Promise.resolve({
            ok: false as const,
            status: 403,
            message: 'You cannot decide an item you created.',
          }),
        ),
      }),
    );
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Approve' })));
    expect(screen.getByRole('alert').textContent).toBe('You cannot decide an item you created.');
    cleanup();
    await show(
      fakeApprovalsApi({
        review: vi.fn(() =>
          Promise.resolve({
            ok: true as const,
            data: { review: { ...pendingReview, yours: true, allowedActions: [] } },
          }),
        ),
      }),
    );
    expect(screen.getByText('You cannot decide this item.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  });
});
