import type { SystemModeResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SystemModeApi } from '../../lib/system-mode-api';
import { SetupGoLive } from './SetupGoLive';

afterEach(cleanup);

const setup: SystemModeResponse = {
  mode: 'Setup',
  wentLiveAt: null,
  checklist: [
    { key: 'accounts', label: 'Accounts', count: 4 },
    { key: 'master_data', label: 'Master data', count: 6 },
    { key: 'vehicles', label: 'Vehicles and documents', count: 0 },
  ],
  allowedActions: ['go_live'],
};
const live: SystemModeResponse = {
  ...setup,
  mode: 'Live',
  wentLiveAt: '2026-11-17T01:00:00.000Z',
  allowedActions: ['back_to_setup'],
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(status: SystemModeResponse, over: Record<string, unknown> = {}) {
  const api = {
    status: vi.fn(() => ok(status)),
    goLive: vi.fn((_body: unknown, _key: string) => ok(live)),
    backToSetup: vi.fn((_body: unknown, _key: string) => ok(setup)),
    ...over,
  };
  return api as typeof api & SystemModeApi;
}

async function show(api: SystemModeApi, onSwitched = vi.fn()) {
  await act(async () => {
    render(<SetupGoLive api={api} onSwitched={onSwitched} />);
  });
  return onSwitched;
}

describe('SetupGoLive (REQ-IAM-010, DEC-132)', () => {
  it('REQ-IAM-010 in Setup shows the checklist with counts, the sign-in note and Go live', async () => {
    await show(apiWith(setup));
    expect(screen.getByRole('heading', { level: 1, name: 'Setup and go live' })).toBeTruthy();
    expect(screen.getByText('Setup mode')).toBeTruthy();
    const accounts = screen.getByRole('listitem', { name: /Accounts/ });
    expect(accounts.textContent).toContain('4');
    expect(accounts.className).toContain('done');
    const vehicles = screen.getByRole('listitem', { name: /Vehicles and documents/ });
    expect(vehicles.className).not.toContain('done');
    expect(
      screen.getByText(
        'Only the System Admin and Access Managers can sign in while the system is in Setup mode.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go live' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back to Setup' })).toBeNull();
  });

  it('DEC-132 Go live needs a reason and GO LIVE typed before it switches', async () => {
    const api = apiWith(setup);
    const onSwitched = await show(api);
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    const dialog = screen.getByRole('dialog', { name: 'Go live?' });
    const confirm = within(dialog).getByRole('button', { name: 'Go live' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Data ready' } });
    fireEvent.change(within(dialog).getByLabelText('Type GO LIVE to confirm'), {
      target: { value: 'go live' },
    });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText('Type GO LIVE to confirm'), {
      target: { value: 'GO LIVE' },
    });
    expect(confirm.disabled).toBe(false);
    await act(async () => fireEvent.click(confirm));
    expect(api.goLive).toHaveBeenCalledWith(
      { reason: 'Data ready', confirmation: 'GO LIVE' },
      expect.any(String),
    );
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  it('DEC-132 in Live shows when it went live and Back to Setup with its own phrase', async () => {
    const api = apiWith(live);
    const onSwitched = await show(api);
    expect(screen.getByText('Live since 2026-11-17 08:00')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go live' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Setup' }));
    const dialog = screen.getByRole('dialog', { name: 'Back to Setup mode?' });
    expect(dialog.textContent).toContain(
      'Everyone except the System Admin and Access Managers is signed out at once',
    );
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Re-import' } });
    fireEvent.change(within(dialog).getByLabelText('Type BACK TO SETUP to confirm'), {
      target: { value: 'BACK TO SETUP' },
    });
    await act(async () =>
      fireEvent.click(within(dialog).getByRole('button', { name: 'Back to Setup' })),
    );
    expect(api.backToSetup).toHaveBeenCalledWith(
      { reason: 'Re-import', confirmation: 'BACK TO SETUP' },
      expect.any(String),
    );
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });

  it('C-34 NFR-01 a refusal keeps the dialog with its sentence; the retry sends the same key', async () => {
    const goLive = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 0, message: 'The server cannot be reached.' })
      .mockResolvedValueOnce({ ok: true, data: live });
    const onSwitched = await show(apiWith(setup, { goLive }));
    fireEvent.click(screen.getByRole('button', { name: 'Go live' }));
    const dialog = screen.getByRole('dialog', { name: 'Go live?' });
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Ready' } });
    fireEvent.change(within(dialog).getByLabelText('Type GO LIVE to confirm'), {
      target: { value: 'GO LIVE' },
    });
    const confirm = within(dialog).getByRole('button', { name: 'Go live' });
    await act(async () => fireEvent.click(confirm));
    expect(within(dialog).getByRole('alert').textContent).toBe('The server cannot be reached.');
    expect(onSwitched).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(confirm));
    expect(goLive.mock.calls[1]?.[1]).toBe(goLive.mock.calls[0]?.[1]);
    expect(onSwitched).toHaveBeenCalledTimes(1);
  });
});
