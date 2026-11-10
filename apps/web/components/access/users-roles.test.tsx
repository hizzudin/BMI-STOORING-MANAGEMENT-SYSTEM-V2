import type { Account, AccountListResponse } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AccountsApi } from '../../lib/accounts-api';
import { UsersRoles } from './UsersRoles';

afterEach(cleanup);

const account = (overrides: Partial<Account>): Account => ({
  id: 1,
  name: 'Budi S.',
  email: 'budi.s@bmi.co.id',
  role: 'Supervisor',
  status: 'Active',
  lastSignInAt: '2026-11-03T00:40:00.000Z',
  allowedActions: ['edit', 'reset_password', 'deactivate'],
  ...overrides,
});

const budi = account({});
const yusuf = account({
  id: 2,
  name: 'Yusuf',
  email: 'yusuf@bmi.co.id',
  role: 'System_Admin',
  allowedActions: ['edit', 'reset_password'],
});
const rina = account({
  id: 3,
  name: 'Rina',
  email: 'rina@bmi.co.id',
  role: 'Planner',
  status: 'Locked',
  allowedActions: ['edit', 'unlock', 'reset_password', 'deactivate'],
});
const sari = account({
  id: 4,
  name: 'Sari',
  email: 'sari@bmi.co.id',
  role: 'Mechanic',
  status: 'Inactive',
  lastSignInAt: null,
  allowedActions: ['edit', 'activate'],
});

const page = (overrides: Partial<AccountListResponse> = {}): AccountListResponse => ({
  accounts: [budi, yusuf, rina, sari],
  allowedActions: ['create', 'move_system_admin'],
  ...overrides,
});

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function fakeApi(overrides: Partial<Record<keyof AccountsApi, unknown>> = {}): AccountsApi {
  return {
    list: vi.fn(() => ok(page())),
    create: vi.fn(() =>
      ok({ account: account({ id: 9, name: 'Dewi' }), temporaryPassword: 'abcdEFGHjk42' }),
    ),
    update: vi.fn(() => ok({ account: budi })),
    unlock: vi.fn(() => ok({ account: { ...rina, status: 'Active' } })),
    deactivate: vi.fn(() => ok({ account: { ...budi, status: 'Inactive' } })),
    activate: vi.fn(() => ok({ account: { ...sari, status: 'Active' } })),
    resetPassword: vi.fn(() => ok({ account: budi, temporaryPassword: 'zyxwVUTSrq17' })),
    moveSystemAdmin: vi.fn(() => ok(page())),
    ...overrides,
  } as AccountsApi;
}

async function show(api = fakeApi()) {
  await act(async () => render(<UsersRoles api={api} />));
  return api;
}

const click = async (name: string, scope: HTMLElement = document.body) => {
  await act(async () => fireEvent.click(within(scope).getByRole('button', { name })));
};
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const panel = () => screen.getByRole('dialog');
const openRow = async (name: string) => {
  await act(async () => fireEvent.click(screen.getByText(name)));
};

describe('UsersRoles', () => {
  it('REQ-IAM-003 Users and roles shows its tabs and every account with role, status and last sign-in', async () => {
    await show();
    expect(screen.getByRole('heading', { level: 1, name: 'Users and roles' })).toBeTruthy();
    const tabs = within(screen.getByRole('navigation', { name: 'Users and roles' }));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Accounts',
      'Roles and permissions',
      'Access history',
    ]);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Budi S.budi.s@bmi.co.idSupervisorActive2026-11-03 07:40',
      'Yusufyusuf@bmi.co.idSystem AdminActive2026-11-03 07:40',
      'Rinarina@bmi.co.idPlannerLocked2026-11-03 07:40',
      'Sarisari@bmi.co.idMechanicInactiveNever',
    ]);
  });

  it('NAV-9 the page buttons follow the page actions of the API', async () => {
    await show(fakeApi({ list: vi.fn(() => ok(page({ allowedActions: [] }))) }));
    expect(screen.queryByRole('button', { name: 'New account' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move System Admin role' })).toBeNull();
  });

  it('REQ-IAM-002 REQ-IAM-009 FLW-AM-01 a new account has one role and shows its temporary password once', async () => {
    const api = await show();
    await click('New account');
    const roles = within(panel())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(roles).not.toContain('System Admin');
    expect(roles).toContain('Access Manager');
    await click('Save', panel());
    expect(within(panel()).getByRole('alert').textContent).toBe(
      'Enter a name and an email address.',
    );
    type('Name', 'Dewi');
    type('Email', 'dewi@bmi.co.id');
    await click('Save', panel());
    expect(within(panel()).getByRole('alert').textContent).toBe('Choose one role.');
    type('Role', 'Mechanic');
    await click('Save', panel());
    expect(api.create).toHaveBeenCalledWith({
      name: 'Dewi',
      email: 'dewi@bmi.co.id',
      role: 'Mechanic',
    });
    expect(within(panel()).getByRole('status').textContent).toContain('abcdEFGHjk42');
    expect(api.list).toHaveBeenCalledTimes(2);
    await click('Done', panel());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('C-34 a refusal shows one sentence and keeps the panel as typed', async () => {
    await show(
      fakeApi({
        create: vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 409,
            message: 'Another account already uses this email.',
          }),
        ),
      }),
    );
    await click('New account');
    type('Name', 'Dewi');
    type('Email', 'budi.s@bmi.co.id');
    type('Role', 'GM');
    await click('Save', panel());
    expect(within(panel()).getByRole('alert').textContent).toBe(
      'Another account already uses this email.',
    );
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Dewi');
  });

  it('REQ-IAM-014 the account panel shows only the buttons of its allowedActions', async () => {
    await show();
    await openRow('Rina');
    expect(
      within(panel())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Deactivate', 'Unlock', 'Reset password', 'Save']);
    cleanup();
    await show();
    await openRow('Sari');
    expect(
      within(panel())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Activate', 'Save']);
  });

  it('BR-14 the System Admin holder shows its role read only and edits name and email', async () => {
    const api = await show();
    await openRow('Yusuf');
    const role = screen.getByLabelText('Role') as HTMLSelectElement;
    expect(role.disabled).toBe(true);
    expect(role.value).toBe('System_Admin');
    type('Name', 'Yusuf Admin');
    await click('Save', panel());
    expect(api.update).toHaveBeenCalledWith(2, {
      name: 'Yusuf Admin',
      email: 'yusuf@bmi.co.id',
      role: 'System_Admin',
    });
  });

  it('REQ-IAM-001 FLW-AM-04 Unlock and Reset password act on the account', async () => {
    const api = await show();
    await openRow('Rina');
    await click('Unlock', panel());
    expect(api.unlock).toHaveBeenCalledWith(3);
    await click('Reset password', panel());
    expect(api.resetPassword).toHaveBeenCalledWith(3);
    expect(within(panel()).getByRole('status').textContent).toContain('zyxwVUTSrq17');
  });

  it('FLW-AM-04 DEC-116 Deactivate asks first; Cancel keeps the account', async () => {
    const api = await show();
    await openRow('Budi S.');
    await click('Deactivate', panel());
    const confirm = screen.getByRole('dialog', { name: 'Deactivate Budi S.?' });
    expect(confirm.textContent).toContain('can no longer sign in');
    await click('Cancel', confirm);
    expect(api.deactivate).not.toHaveBeenCalled();
    await click('Deactivate', screen.getByRole('dialog', { name: 'Budi S.' }));
    await click('Deactivate', screen.getByRole('dialog', { name: 'Deactivate Budi S.?' }));
    expect(api.deactivate).toHaveBeenCalledWith(1);
  });

  it('DEC-116 Activate brings a deactivated account back', async () => {
    const api = await show();
    await openRow('Sari');
    await click('Activate', panel());
    expect(api.activate).toHaveBeenCalledWith(4);
  });

  it('REQ-IAM-004 FLW-AM-03 the role moves to another active account with a reason, after a confirmation', async () => {
    const api = await show();
    await click('Move System Admin role');
    const choices = within(panel())
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(choices).toEqual(['Choose an active account', 'Budi S. (Supervisor)', 'Rina (Planner)']);
    await click('Move role', panel());
    expect(within(panel()).getByRole('alert').textContent).toBe(
      'Choose the account that becomes System Admin.',
    );
    type('New System Admin', '3');
    await click('Move role', panel());
    expect(within(panel()).getByRole('alert').textContent).toBe('Give a reason.');
    type('Reason', 'Yusuf moves to Jakarta');
    await click('Move role', panel());
    const confirm = screen.getByRole('dialog', { name: 'Move the System Admin role to Rina?' });
    expect(confirm.textContent).toContain('Yusuf keeps no role until you give one');
    await click('Move role', confirm);
    expect(api.moveSystemAdmin).toHaveBeenCalledWith(3, 'Yusuf moves to Jakarta');
  });

  it('NAV-9 a refused list shows the sentence instead of the table', async () => {
    await show(
      fakeApi({
        list: vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 403,
            message: 'You do not have permission to do this.',
          }),
        ),
      }),
    );
    expect(screen.getByRole('alert').textContent).toBe('You do not have permission to do this.');
    expect(screen.queryByRole('table')).toBeNull();
  });
});
