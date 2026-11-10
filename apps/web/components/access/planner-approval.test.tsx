import type { PlannerApprovalResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlannerApprovalApi } from '../../lib/planner-approval-api';
import { PlannerApprovalCard } from './PlannerApprovalCard';

afterEach(cleanup);

const off: PlannerApprovalResponse = {
  on: false,
  kinds: [],
  until: null,
  allowedActions: ['switch_on'],
};
const on: PlannerApprovalResponse = {
  on: true,
  kinds: ['spk_creation', 'spk_completion'],
  until: '2026-11-11T11:00:00.000Z',
  allowedActions: ['change', 'switch_off'],
};

const ok = (data: PlannerApprovalResponse) => Promise.resolve({ ok: true as const, data });

function apiWith(state: PlannerApprovalResponse, overrides: Partial<PlannerApprovalApi> = {}) {
  return {
    get: vi.fn(() => ok(state)),
    set: vi.fn(() => ok(on)),
    switchOff: vi.fn(() => ok(off)),
    ...overrides,
  } satisfies PlannerApprovalApi;
}

async function open(api: PlannerApprovalApi) {
  await act(async () => {
    render(<PlannerApprovalCard api={api} />);
  });
}

const panel = () => screen.getByRole('dialog', { name: 'Planner approval' });

describe('Planner approval card (REQ-IAM-008, DEC-118)', () => {
  it('RL-7 off by default: the card says so and offers Switch on', async () => {
    await open(apiWith(off));
    expect(screen.getByRole('heading', { level: 2, name: 'Planner approval' })).toBeTruthy();
    expect(screen.getByText('Planner approval is off')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Switch off' })).toBeNull();
  });

  it('DEC-118 Switch on sends the ticked kinds, the end time read as WIB and the reason', async () => {
    const api = apiWith(off);
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    fireEvent.click(within(panel()).getByLabelText('SPK creation'));
    fireEvent.click(within(panel()).getByLabelText('SPK completion'));
    fireEvent.change(within(panel()).getByLabelText('End time (WIB, optional)'), {
      target: { value: '2026-11-11T18:00' },
    });
    fireEvent.change(within(panel()).getByLabelText('Reason'), {
      target: { value: 'Site visit' },
    });
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Switch on' }));
    });
    expect(api.set).toHaveBeenCalledWith({
      kinds: ['spk_creation', 'spk_completion'],
      until: '2026-11-11T11:00:00.000Z',
      reason: 'Site visit',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Planner approval is on')).toBeTruthy();
    expect(
      screen.getByText('SPK creation, SPK completion · until 2026-11-11 18:00 WIB'),
    ).toBeTruthy();
  });

  it('DEC-118 while on, Change opens the panel filled in; an empty end time keeps it on until switched off', async () => {
    const api = apiWith(on);
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect((within(panel()).getByLabelText('SPK creation') as HTMLInputElement).checked).toBe(true);
    expect((within(panel()).getByLabelText('Tyre count') as HTMLInputElement).checked).toBe(false);
    const end = within(panel()).getByLabelText('End time (WIB, optional)') as HTMLInputElement;
    expect(end.value).toBe('2026-11-11T18:00');
    fireEvent.change(end, { target: { value: '' } });
    fireEvent.change(within(panel()).getByLabelText('Reason'), { target: { value: 'Longer' } });
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Save' }));
    });
    expect(api.set).toHaveBeenCalledWith({
      kinds: ['spk_creation', 'spk_completion'],
      until: null,
      reason: 'Longer',
    });
  });

  it('DEC-118 Switch off asks for a reason', async () => {
    const api = apiWith(on);
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }));
    fireEvent.change(within(panel()).getByLabelText('Reason'), { target: { value: 'Back' } });
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Switch off' }));
    });
    expect(api.switchOff).toHaveBeenCalledWith('Back');
    expect(screen.getByText('Planner approval is off')).toBeTruthy();
  });

  it('C-34 a refusal shows one sentence and keeps the panel as typed; Cancel closes it', async () => {
    const api = apiWith(off, {
      set: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 400,
          message: 'The end time must be later than now.',
        }),
      ),
    });
    await open(api);
    fireEvent.click(screen.getByRole('button', { name: 'Switch on' }));
    fireEvent.click(within(panel()).getByLabelText('Tyre count'));
    fireEvent.change(within(panel()).getByLabelText('Reason'), { target: { value: 'x' } });
    await act(async () => {
      fireEvent.click(within(panel()).getByRole('button', { name: 'Switch on' }));
    });
    expect(within(panel()).getByText('The end time must be later than now.')).toBeTruthy();
    expect((within(panel()).getByLabelText('Tyre count') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('REQ-IAM-014 without its actions the card only reads; a refused load shows its sentence', async () => {
    await open(apiWith({ ...on, allowedActions: [] }));
    expect(
      screen.getByText('SPK creation, SPK completion · until 2026-11-11 18:00 WIB'),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    await open(
      apiWith(off, {
        get: vi.fn(() =>
          Promise.resolve({ ok: false as const, status: 500, message: 'Something went wrong.' }),
        ),
      }),
    );
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('an on switch without an end time says it stays on until switched off', async () => {
    await open(apiWith({ ...on, kinds: ['tyre_count'], until: null }));
    expect(screen.getByText('Tyre count · until switched off')).toBeTruthy();
  });
});
