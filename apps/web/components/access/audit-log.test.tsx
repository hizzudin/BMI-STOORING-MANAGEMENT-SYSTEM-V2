import type { AccessHistoryResponse, AuditLogItem, AuditLogResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditApi } from '../../lib/audit-api';
import { AccessHistory } from './AccessHistory';
import { AuditLog } from './AuditLog';

afterEach(cleanup);

const approve: AuditLogItem = {
  id: 41,
  at: '2026-11-02T09:40:12.000Z',
  user: { id: 2, name: 'Yusuf', role: 'System_Admin' },
  area: 'SPK',
  entity: 'spk',
  entityId: 9,
  record: 'SPK-2611040141',
  action: 'approve',
  before: 'Pending_Approval',
  after: 'Active',
  self: 'Self-approved',
  reason: null,
};

const ended: AuditLogItem = {
  ...approve,
  id: 40,
  user: null,
  area: 'Access',
  entity: 'planner_approval',
  record: 'Planner approval',
  action: 'end',
  before: 'kinds: spk_creation',
  after: 'kinds: —',
  self: null,
  reason: 'Planner approval ended at its end time.',
};

const page = (over: Partial<AuditLogResponse> = {}): AuditLogResponse => ({
  items: [approve, ended],
  pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  range: { from: '2026-11-10', to: '2026-11-16' },
  users: [
    { id: 2, name: 'Yusuf' },
    { id: 3, name: 'Dewi' },
  ],
  ...over,
});

const history = (over: Partial<AccessHistoryResponse> = {}): AccessHistoryResponse => ({
  items: [
    {
      id: 7,
      at: '2026-11-02T03:12:00.000Z',
      who: 'Dewi',
      what: 'Planner approval on until 18:00 (SPK creation)',
    },
    {
      id: 6,
      at: '2026-10-30T02:00:00.000Z',
      who: null,
      what: 'Planner approval ended at its end time',
    },
  ],
  pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  ...over,
});

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(over: Record<string, unknown> = {}) {
  const api = {
    list: vi.fn((_q?: unknown) => ok(page())),
    detail: vi.fn((_id: number) =>
      ok({ item: approve, before: { status: 'Pending_Approval' }, after: { status: 'Active' } }),
    ),
    exportFile: vi.fn((_q?: unknown) =>
      ok({ blob: new Blob(['x']), fileName: 'audit-log-2026-11-16.csv' }),
    ),
    accessHistory: vi.fn((_q?: unknown) => ok(history())),
    ...over,
  };
  return api as typeof api & AuditApi;
}

async function show(api: AuditApi, area?: 'SPK' | 'Access') {
  await act(async () => {
    render(<AuditLog api={api} {...(area ? { initialArea: area } : {})} />);
  });
}

describe('AuditLog (REQ-IAM-007, DEC-131)', () => {
  it('REQ-IAM-007 shows the rows with time in WIB, user, role, area, record, before, after and Self', async () => {
    await show(apiWith());
    expect(screen.getByRole('heading', { level: 1, name: 'Audit log' })).toBeTruthy();
    const headers = screen.getAllByRole('columnheader').map((cell) => cell.textContent);
    expect(headers).toEqual(['Time', 'User', 'Role', 'Area', 'Record', 'Before', 'After', 'Self']);
    const row = screen.getByRole('row', { name: /SPK-2611040141/ });
    for (const text of [
      '2026-11-02 16:40:12',
      'Yusuf',
      'System Admin',
      'SPK',
      'Pending_Approval',
      'Active',
      'Self-approved',
    ]) {
      expect(within(row).getByText(text)).toBeTruthy();
    }
    const system = screen.getByRole('row', { name: /Planner approval/ });
    expect(within(system).getByText('System')).toBeTruthy();
  });

  it('DEC-131 shows the dates of the page and filters by user, area and dates from page 1', async () => {
    const api = apiWith();
    await show(api);
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
    expect((screen.getByLabelText('From') as HTMLInputElement).value).toBe('2026-11-10');
    expect((screen.getByLabelText('To') as HTMLInputElement).value).toBe('2026-11-16');
    await act(async () =>
      fireEvent.change(screen.getByLabelText('User'), { target: { value: '3' } }),
    );
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, userId: 3 });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Access' } }),
    );
    expect(api.list).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      userId: 3,
      area: 'Access',
    });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } }),
    );
    expect(api.list).toHaveBeenLastCalledWith({
      page: 1,
      pageSize: 20,
      userId: 3,
      area: 'Access',
      from: '2026-11-01',
      to: '2026-11-16',
    });
  });

  it('DEC-131 opens with the area of the link that led here', async () => {
    const api = apiWith();
    await show(api, 'Access');
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, area: 'Access' });
    expect((screen.getByLabelText('Area') as HTMLSelectElement).value).toBe('Access');
  });

  it('DEC-127 pages like SPKList: Previous, Next, rows per page and the total', async () => {
    const api = apiWith({
      list: vi.fn((_q?: unknown) =>
        ok(page({ pagination: { page: 1, pageSize: 20, total: 45, totalPages: 3 } })),
      ),
    });
    await show(api);
    expect(screen.getByText('Page 1 of 3 (45 total)')).toBeTruthy();
    const previous = screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next' })));
    expect(api.list).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } }),
    );
    expect(api.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 50 });
  });

  it('DEC-131 a row opens a panel with the full before, after and the reason', async () => {
    const api = apiWith();
    await show(api);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'SPK-2611040141' })));
    expect(api.detail).toHaveBeenCalledWith(41);
    const panel = screen.getByRole('dialog', { name: 'Audit record' });
    expect(panel.textContent).toContain('"status": "Pending_Approval"');
    expect(panel.textContent).toContain('"status": "Active"');
    expect(within(panel).getByText('Self-approved')).toBeTruthy();
    expect(within(panel).getByText('No reason given')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Audit record' })).toBeNull();
  });

  it('DEC-74 C-26 Export asks for the format and exports the rows under the filters', async () => {
    const api = apiWith();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:audit');
    URL.revokeObjectURL = vi.fn();
    await show(api);
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'SPK' } }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export' });
    expect(within(dialog).getByText(/The export is logged/)).toBeTruthy();
    fireEvent.click(within(dialog).getByLabelText('xlsx'));
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Export' })));
    expect(api.exportFile).toHaveBeenCalledWith({ format: 'xlsx', area: 'SPK' });
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Export' })).toBeNull();
    click.mockRestore();
  });

  it('C-34 an export the server refuses keeps the dialog open with its sentence', async () => {
    const api = apiWith({
      exportFile: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 400,
          message: 'Narrow the filters to export at most 10,000 rows.',
        }),
      ),
    });
    await show(api);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export' });
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'Export' })));
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Narrow the filters to export at most 10,000 rows.',
    );
  });
});

describe('Access history (REQ-IAM-003, FLW-AM-05)', () => {
  it('FLW-AM-05 is the third tab of Users and roles, with When, Who and What', async () => {
    await act(async () => {
      render(<AccessHistory api={apiWith()} />);
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Users and roles' })).toBeTruthy();
    const tab = screen.getByRole('link', { name: 'Access history' });
    expect(tab.getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'When',
      'Who',
      'What',
    ]);
    const row = screen.getByRole('row', { name: /Planner approval on/ });
    expect(within(row).getByText('2026-11-02 10:12')).toBeTruthy();
    expect(within(row).getByText('Dewi')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /ended/ })).getByText('System')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1 (2 total)')).toBeTruthy();
  });

  it('FLW-AM-05 links to the full trail on the Audit log', async () => {
    await act(async () => {
      render(<AccessHistory api={apiWith()} />);
    });
    const link = screen.getByRole('link', { name: 'Full trail in Audit log' });
    expect(link.getAttribute('href')).toBe('/audit-log?area=Access');
  });

  it('DEC-127 pages on the server', async () => {
    const api = apiWith({
      accessHistory: vi.fn((_q?: unknown) =>
        ok(history({ pagination: { page: 1, pageSize: 20, total: 30, totalPages: 2 } })),
      ),
    });
    await act(async () => {
      render(<AccessHistory api={api} />);
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next' })));
    expect(api.accessHistory).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 });
  });
});
