import { defaultRolePermissions, type MeResponse, type Role } from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthApi } from '../../lib/auth-api';
import { SignedInShell } from './SignedInShell';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function meOf(role: Role, overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    user: { id: 7, name: `${role} Sari`, email: 'sari@bmi.co.id', role, mustChangePassword: false },
    capabilities: defaultRolePermissions()
      .filter((row) => row.role === role && row.allowed)
      .map((row) => row.permissionCode),
    systemMode: 'Live',
    ...overrides,
  };
}

function fakeApi(me: MeResponse | null): AuthApi {
  return {
    me: vi.fn(() =>
      Promise.resolve(
        me
          ? { ok: true as const, data: me }
          : { ok: false as const, status: 401, message: 'Your session ended. Sign in again.' },
      ),
    ),
    signOut: vi.fn(() => Promise.resolve({ ok: true as const, data: { ok: true as const } })),
  } as unknown as AuthApi;
}

async function show(me: MeResponse | null, pathname = '/') {
  const api = fakeApi(me);
  const navigate = vi.fn();
  await act(async () =>
    render(
      <SignedInShell api={api} navigate={navigate} pathname={pathname}>
        <p>Page content</p>
      </SignedInShell>,
    ),
  );
  return { api, navigate };
}

const menu = () =>
  within(screen.getByRole('navigation', { name: 'Main menu' }))
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label'));

describe('NAV-9 the menu follows the capabilities of GET /me', () => {
  it('NAV-9 REQ-IAM-013 a Planner sees the items its codes open, and no Approvals or Users and roles', async () => {
    await show(meOf('Planner'));
    expect(menu()).toEqual([
      'Dashboard',
      'Surat Perintah Kerja',
      'Report Breakdown',
      'Schedule',
      'Vehicles',
      'Documents',
      'Reports',
      'Settings',
    ]);
    expect(screen.getByText('Page content')).toBeTruthy();
  });

  it('NAV-9 the same Planner role shows Approvals once the capability set holds spk.approve', async () => {
    const me = meOf('Planner');
    await show({ ...me, capabilities: [...me.capabilities, 'spk.approve'] });
    expect(menu()).toContain('Approvals');
  });

  it('C-01 a user without the Dashboard item opens its first item instead: the Access Manager lands on Users and roles', async () => {
    const { navigate } = await show(meOf('Access_Manager'), '/');
    expect(navigate).toHaveBeenCalledWith('/users');
    expect(screen.queryByText('Page content')).toBeNull();
  });

  it('NAV-9 the Access Manager has its own navigation', async () => {
    await show(meOf('Access_Manager'), '/users');
    expect(menu()).toEqual(['Users and roles', 'Audit log']);
  });

  it('REQ-IAM-010 Setup and go live shows only in Setup mode', async () => {
    await show(meOf('System_Admin', { systemMode: 'Setup' }));
    expect(menu()).toContain('Setup and go live');
    cleanup();
    await show(meOf('System_Admin'));
    expect(menu()).not.toContain('Setup and go live');
  });

  it('C-01 the item of the open page is marked, and each item opens its area', async () => {
    await show(meOf('Planner'), '/settings/spk-presets');
    const settings = screen.getByRole('link', { name: 'Settings' });
    expect(settings.getAttribute('aria-current')).toBe('page');
    expect(settings.getAttribute('href')).toBe('/settings');
    expect(screen.getByRole('link', { name: 'Surat Perintah Kerja' }).getAttribute('href')).toBe(
      '/spk',
    );
  });

  it('NAV-9 opening the page of a hidden item shows the not-allowed page instead of its content', async () => {
    await show(meOf('Accounting'), '/settings');
    expect(screen.queryByText('Page content')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Not allowed' })).toBeTruthy();
    expect(screen.getByText('You do not have permission to open this page.')).toBeTruthy();
  });
});

describe('session', () => {
  it('NFR-05 without a session the shell shows nothing and goes to sign in', async () => {
    const { navigate } = await show(null);
    expect(navigate).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('Page content')).toBeNull();
  });

  it('REQ-IAM-009 a first sign-in is sent to ChangePassword before any page', async () => {
    const me = meOf('Mechanic');
    const { navigate } = await show({ ...me, user: { ...me.user, mustChangePassword: true } });
    expect(navigate).toHaveBeenCalledWith('/change-password');
    expect(screen.queryByText('Page content')).toBeNull();
  });

  it('C-04 Sign out ends the session and goes back to sign in', async () => {
    const { api, navigate } = await show(meOf('Planner'));
    fireEvent.click(screen.getByRole('button', { name: 'Planner Sari, Planner' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })));
    expect(api.signOut).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('C-02 DEC-82 the rail starts collapsed and the choice is saved per user', async () => {
    await show(meOf('Planner'));
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }));
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeTruthy();
    expect(window.localStorage.getItem('bmi.rail.7')).toBe('expanded');
    cleanup();
    await show(meOf('Planner'));
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toBeTruthy();
  });
});
