import {
  defaultRolePermissions,
  isSwitchableCell,
  PERMISSION_CODES,
  type RolePermissionsResponse,
} from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RolePermissionsApi } from '../../lib/role-permissions-api';
import { RolesPermissions } from './RolesPermissions';

afterEach(cleanup);

const defaults = (): RolePermissionsResponse => ({
  cells: defaultRolePermissions().map((row) => ({
    ...row,
    switchable: isSwitchableCell(row.role, row.permissionCode),
  })),
  allowedActions: ['edit'],
});

function apiWith(overrides: Partial<RolePermissionsApi> = {}): RolePermissionsApi {
  return {
    get: vi.fn(() => Promise.resolve({ ok: true as const, data: defaults() })),
    change: vi.fn(() => Promise.resolve({ ok: true as const, data: defaults() })),
    ...overrides,
  };
}

async function open(api: RolePermissionsApi) {
  await act(async () => {
    render(<RolesPermissions api={api} />);
  });
}

const cell = (role: string, code: string) => screen.getByLabelText(`${role}: ${code}`);
const rowOf = (code: string) => screen.getByRole('rowheader', { name: new RegExp(`^${code}`) });

describe('AMRolesPermissions (REQ-IAM-005, DEC-117)', () => {
  it('DEC-117 shows all ten roles and every code grouped by area with its meaning', async () => {
    await open(apiWith());
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Code',
      'Planner',
      'Mechanic',
      'Warehouse',
      'Supervisor',
      'GM',
      'System Admin',
      'Access Mgr.',
      'Driver',
      'Field Coord.',
      'Accounting',
    ]);
    expect(screen.getAllByRole('rowheader')).toHaveLength(PERMISSION_CODES.length);
    expect(screen.getByText('Surat Perintah Kerja')).toBeTruthy();
    expect(
      within(rowOf('vehicle.view')).getByText('View vehicles, documents and the placement map'),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Roles and permissions' }).getAttribute('aria-current'),
    ).toBe('page');
  });

  it('REQ-IAM-005 locked cells show L and S cells show S; neither can be clicked', async () => {
    await open(apiWith());
    expect(cell('System Admin', 'spk.approve').textContent).toBe('✓ L');
    expect(cell('Mechanic', 'spk.approve').textContent).toBe('L');
    expect(cell('Planner', 'spk.approve').textContent).toBe('S');
    expect(cell('Planner', 'spk.approve').tagName).not.toBe('BUTTON');
    expect(cell('Mechanic', 'spk.approve').tagName).not.toBe('BUTTON');
    expect(cell('Accounting', 'vehicle.view').tagName).toBe('BUTTON');
  });

  it('DEC-117 a click stages a cell; Save sends every staged cell and clears the bar', async () => {
    const api = apiWith();
    await open(api);
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
    fireEvent.click(cell('Accounting', 'vehicle.view'));
    fireEvent.click(cell('Driver', 'vehicle.view'));
    expect(cell('Accounting', 'vehicle.view').getAttribute('aria-pressed')).toBe('false');
    expect(cell('Driver', 'vehicle.view').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getAllByText('changed')).toHaveLength(2);
    expect(screen.getByText('2 changes')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(api.change).toHaveBeenCalledWith([
      { role: 'Accounting', permissionCode: 'vehicle.view', allowed: false },
      { role: 'Driver', permissionCode: 'vehicle.view', allowed: true },
    ]);
    expect(screen.queryByText('changed')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('DEC-117 a second click unstages the cell, and Cancel drops every staged cell', async () => {
    await open(apiWith());
    fireEvent.click(cell('Driver', 'vehicle.view'));
    fireEvent.click(cell('Driver', 'vehicle.view'));
    expect(screen.queryByText('changed')).toBeNull();
    fireEvent.click(cell('Mechanic', 'audit.view'));
    expect(screen.getByText('1 change')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cell('Mechanic', 'audit.view').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('1 change')).toBeNull();
  });

  it('C-34 a refused save shows one sentence and keeps the staged cells', async () => {
    const api = apiWith({
      change: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 403,
          message: 'A locked cell is fixed by a business rule and cannot change.',
        }),
      ),
    });
    await open(api);
    fireEvent.click(cell('Mechanic', 'audit.view'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    });
    expect(
      screen.getByText('A locked cell is fixed by a business rule and cannot change.'),
    ).toBeTruthy();
    expect(screen.getByText('1 change')).toBeTruthy();
  });

  it('REQ-IAM-014 without the edit action the matrix is read only', async () => {
    const readOnly = { ...defaults(), allowedActions: [] };
    await open(
      apiWith({ get: vi.fn(() => Promise.resolve({ ok: true as const, data: readOnly })) }),
    );
    expect(cell('Accounting', 'vehicle.view').tagName).not.toBe('BUTTON');
  });

  it('C-34 a refused load shows its sentence', async () => {
    await open(
      apiWith({
        get: vi.fn(() =>
          Promise.resolve({
            ok: false as const,
            status: 403,
            message: 'You do not have permission to do this.',
          }),
        ),
      }),
    );
    expect(screen.getByText('You do not have permission to do this.')).toBeTruthy();
  });
});

function ClickCounter() {
  const [clicks, setClicks] = useState(0);
  return (
    <button type="button" onClick={() => setClicks(clicks + 1)}>
      {`clicked ${clicks}`}
    </button>
  );
}

describe('AMRolesPermissions with the Planner approval card (DEC-118)', () => {
  it('the card keeps its state when the matrix arrives after a click', async () => {
    let arrive: (value: Awaited<ReturnType<RolePermissionsApi['get']>>) => void = () => undefined;
    const api = apiWith({
      get: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<RolePermissionsApi['get']>>>((resolve) => {
            arrive = resolve;
          }),
      ),
    });
    render(<RolesPermissions api={api} switchCard={<ClickCounter />} />);
    fireEvent.click(screen.getByRole('button', { name: 'clicked 0' }));
    await act(async () => {
      arrive({ ok: true, data: defaults() });
    });
    expect(screen.getByRole('button', { name: 'clicked 1' })).toBeTruthy();
    expect(screen.getAllByRole('rowheader').length).toBeGreaterThan(0);
  });
});
