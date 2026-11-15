import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ApprovalsHistory } from './ApprovalsHistory';
import { fakeApprovalsApi } from './approvals-fixtures';

afterEach(() => {
  cleanup();
});

async function show(api = fakeApprovalsApi()) {
  await act(async () => render(<ApprovalsHistory api={api} />));
  return api;
}

const rows = () => screen.getAllByRole('row').slice(1);

describe('ApprovalsHistory (REQ-APR-007, DEC-128)', () => {
  it("REQ-APR-007 DEC-128 every Approver's decisions with the columns of the PRD", async () => {
    await show();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Decided',
      'SPK',
      'Vehicle',
      'Approval',
      'Decision',
      'Decided by',
      'Requested by',
    ]);
    const first = within(rows()[0] as HTMLElement);
    expect(first.getByText('2026-10-30 16:02:33')).toBeTruthy();
    expect(first.getByText('SPK-2611040128')).toBeTruthy();
    expect(first.getByText('Approved')).toBeTruthy();
    expect(first.getByText('GM Hendra')).toBeTruthy();
    expect(within(rows()[1] as HTMLElement).getByText('Rejected')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'History' }).getAttribute('aria-current')).toBe('page');
  });

  it('REQ-APR-007 the preview shows the stamp and the reason, and Open SPK', async () => {
    await show();
    const preview = () => screen.getByRole('region', { name: 'Preview' });
    expect(within(preview()).getByText('Approved by GM: Hendra')).toBeTruthy();
    expect(within(preview()).getByText('Self-approved')).toBeTruthy();
    expect(within(preview()).getByText('None given')).toBeTruthy();
    fireEvent.click(within(rows()[1] as HTMLElement).getByText('SPK-2611040125'));
    expect(within(preview()).getByText('Rejected by Supervisor: Budi S.')).toBeTruthy();
    expect(within(preview()).getByText('Wrong vehicle')).toBeTruthy();
    expect(within(preview()).getByRole('link', { name: 'Open SPK' }).getAttribute('href')).toBe(
      '/spk/25',
    );
  });

  it('REQ-APR-007 the chips Approved and Rejected ask the server again', async () => {
    const api = await show();
    fireEvent.click(screen.getByRole('button', { name: 'Rejected' }));
    expect(api.history).toHaveBeenLastCalledWith({ decision: 'Reject' });
    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));
    expect(api.history).toHaveBeenLastCalledWith({ decision: 'Approve' });
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(api.history).toHaveBeenLastCalledWith({});
  });
});
