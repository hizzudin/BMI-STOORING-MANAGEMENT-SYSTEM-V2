import type { SpkListItem, SpkListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpksApi } from '../../lib/spks-api';
import { SpkList } from './SpkList';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const base: SpkListItem = {
  id: 1,
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
  version: 1,
  allowedActions: [],
  currentStep: { sequenceNo: 2, name: 'Mechanic Action', status: 'Open' },
  waitingOn: 'Mechanic Joko',
};

const draft: SpkListItem = {
  ...base,
  id: 2,
  spkNumber: 'SPK-2611040146',
  priority: 'Normal',
  status: 'Draft',
  allowedActions: ['edit', 'submit'],
  currentStep: null,
  waitingOn: 'Planner Sari',
};

const response = (over: Partial<SpkListResponse> = {}): SpkListResponse => ({
  items: [base, draft],
  tabCounts: {
    active: 1,
    mine: 0,
    draft: 1,
    pending: 0,
    rejected: 0,
    completed: 0,
    cancelled: 0,
    all: 2,
  },
  pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  vehicles: [{ id: 7, licensePlate: 'B 9012 KX' }],
  allowedActions: ['create'],
  ...over,
});

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(list = vi.fn((_q?: unknown) => ok(response()))) {
  return { api: { list } as unknown as SpksApi, list };
}

async function show(api: SpksApi) {
  await act(async () => {
    render(<SpkList api={api} />);
  });
}

const lastQuery = (list: ReturnType<typeof vi.fn>) => list.mock.calls.at(-1)?.[0];

describe('SPKList (REQ-SPK-010, REQ-SPK-015, DEC-127)', () => {
  it('REQ-SPK-010 the tabs with counts, the columns and the urgency pill beside the number', async () => {
    const { api, list } = apiWith();
    await show(api);
    expect(lastQuery(list)).toEqual({ tab: 'active', page: 1, pageSize: 20 });
    expect(screen.getByRole('tab', { name: 'Active1' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Completed' })).toBeTruthy();
    const row = screen.getByText('SPK-2611040139').closest('tr') as HTMLElement;
    expect(within(row).getByText('High')).toBeTruthy();
    expect(within(row).getByText('In progress')).toBeTruthy();
    expect(within(row).getByText('Step 2 Mechanic Action')).toBeTruthy();
    expect(within(row).getByText('Mechanic Joko')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1 (2 total)')).toBeTruthy();
  });

  it('DEC-127 Open edits a draft its creator may edit; every other row offers View', async () => {
    await show(apiWith().api);
    const view = screen.getByRole('link', { name: 'View' });
    expect(view.getAttribute('href')).toBe('/spk/1');
    expect(screen.getByRole('link', { name: 'Open' }).getAttribute('href')).toBe('/spk/2/edit');
  });

  it('REQ-IAM-014 Create SPK shows only when the page allows create', async () => {
    await show(apiWith().api);
    expect(screen.getByRole('link', { name: 'Create SPK' }).getAttribute('href')).toBe('/spk/new');
    cleanup();
    await show(apiWith(vi.fn(() => ok(response({ allowedActions: [] })))).api);
    expect(screen.queryByRole('link', { name: 'Create SPK' })).toBeNull();
  });

  it('REQ-SPK-010 a tab, the type, the vehicle and the search ask the server again from page 1', async () => {
    vi.useFakeTimers();
    const { api, list } = apiWith();
    await show(api);
    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Draft1' }));
    });
    expect(lastQuery(list)).toMatchObject({ tab: 'draft', page: 1 });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Tyre' } });
    });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Vehicle'), { target: { value: '7' } });
    });
    expect(lastQuery(list)).toMatchObject({ type: 'Tyre', vehicleId: 7 });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Search SPK, plate, title'), {
        target: { value: ' 9012 ' },
      });
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(lastQuery(list)).toMatchObject({ search: '9012', page: 1 });
  });

  it('DEC-127 pages: Previous, Next and the page size', async () => {
    const paged = response({ pagination: { page: 1, pageSize: 20, total: 45, totalPages: 3 } });
    const { api, list } = apiWith(vi.fn(() => ok(paged)));
    await show(api);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    });
    expect(lastQuery(list)).toMatchObject({ page: 2 });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Rows per page'), { target: { value: '50' } });
    });
    expect(lastQuery(list)).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('REQ-SPK-010 an empty page says so', async () => {
    const empty = response({
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });
    await show(apiWith(vi.fn(() => ok(empty))).api);
    expect(screen.getByText('No SPK matches.')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1 (0 total)')).toBeTruthy();
  });
});
