import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsInbox } from './ApprovalsInbox';
import { fakeApprovalsApi, normalItem, urgentItem } from './approvals-fixtures';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function show(api = fakeApprovalsApi()) {
  await act(async () => render(<ApprovalsInbox api={api} />));
  return api;
}

const rows = () => screen.getAllByRole('row').slice(1);

describe('Approvals inbox (REQ-APR-002, REQ-APR-004, REQ-APR-006, DEC-128)', () => {
  it('REQ-APR-002 DEC-128 the columns, in the order the server sends, with the urgency pill and hh:mm:ss', async () => {
    await show();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'SPK',
      'Vehicle',
      'Title',
      'Category',
      'Approval',
      'Requested by',
      'Submitted',
      'Waiting',
      'Action',
    ]);
    const first = within(rows()[0] as HTMLElement);
    expect(first.getByText(urgentItem.spkNumber)).toBeTruthy();
    expect(first.getByText('Urgent')).toBeTruthy();
    expect(first.getByText('B 1234 ABC')).toBeTruthy();
    expect(first.getByText('Brake pads front')).toBeTruthy();
    expect(first.getByText('Creation')).toBeTruthy();
    expect(first.getByText('Planner Sari')).toBeTruthy();
    expect(first.getByText('2026-11-04 08:12:00')).toBeTruthy();
    expect(first.getByText('00:42:10')).toBeTruthy();
    expect(first.getByRole('link', { name: 'Open review' }).getAttribute('href')).toBe(
      '/approvals/spk/42',
    );
    expect(within(rows()[1] as HTMLElement).getByText('03:02:44')).toBeTruthy();
  });

  it("REQ-APR-006 the System Admin's own item is marked Yours", async () => {
    await show();
    expect(within(rows()[1] as HTMLElement).getByText('Yours')).toBeTruthy();
    expect(within(rows()[0] as HTMLElement).queryByText('Yours')).toBeNull();
  });

  it('REQ-APR-004 DEC-128 the first row is previewed; selecting a row shows its key data and Open review', async () => {
    await show();
    const preview = () => screen.getByRole('region', { name: 'Preview' });
    expect(within(preview()).getByText(urgentItem.spkNumber)).toBeTruthy();
    expect(within(preview()).getByText('1 Stock · Warehouse Manager')).toBeTruthy();
    fireEvent.click(within(rows()[1] as HTMLElement).getByText('PM 20.000 km'));
    expect(rows()[1]?.getAttribute('aria-selected')).toBe('true');
    expect(within(preview()).getByText(normalItem.spkNumber)).toBeTruthy();
    expect(within(preview()).getByText('Scheduled service.')).toBeTruthy();
    expect(within(preview()).getByRole('link', { name: 'Open review' }).getAttribute('href')).toBe(
      '/approvals/spk/31',
    );
  });

  it('REQ-APR-002 the Creation chip and the search ask the server again', async () => {
    vi.useFakeTimers();
    const api = await show();
    fireEvent.click(screen.getByRole('button', { name: 'Creation' }));
    expect(api.inbox).toHaveBeenLastCalledWith({ kind: 'Creation' });
    fireEvent.change(screen.getByLabelText('Search SPK, plate'), { target: { value: ' B 12 ' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(api.inbox).toHaveBeenLastCalledWith({ kind: 'Creation', search: 'B 12' });
  });

  it('DEC-128 what later tasks build is hidden: no Warehouse tab, no Amendment or Completion chip', async () => {
    await show();
    expect(screen.queryByText('Warehouse')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Amendment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Completion' })).toBeNull();
    expect(
      screen.getByRole('link', { name: /Surat Perintah Kerja/ }).getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('link', { name: 'History' }).getAttribute('href')).toBe(
      '/approvals/history',
    );
  });

  it('REQ-APR-005 an empty inbox says so', async () => {
    await show(
      fakeApprovalsApi({
        inbox: vi.fn(() => Promise.resolve({ ok: true as const, data: { items: [] } })),
      }),
    );
    expect(screen.getByText('Nothing is waiting for your decision.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull();
  });
});
