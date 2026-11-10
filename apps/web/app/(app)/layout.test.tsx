import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AppLayout from './layout';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/settings',
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const answer = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

it('NAV-9 every signed-in page loads GET /me and shows the menu of its capabilities', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      answer(200, {
        user: {
          id: 1,
          name: 'Planner Sari',
          email: 's@bmi.co.id',
          role: 'Planner',
          mustChangePassword: false,
        },
        capabilities: ['dashboard.view', 'registry.manage'],
        systemMode: 'Live',
      }),
    ),
  );
  await act(async () =>
    render(
      <AppLayout>
        <p>Settings page</p>
      </AppLayout>,
    ),
  );
  expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe('page');
  expect(screen.queryByRole('link', { name: 'Surat Perintah Kerja' })).toBeNull();
  expect(screen.getByText('Settings page')).toBeTruthy();
});

it('NFR-05 without a session the page goes to sign in', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => answer(401, { message: 'Your session ended. Sign in again.' })),
  );
  await act(async () =>
    render(
      <AppLayout>
        <p>Settings page</p>
      </AppLayout>,
    ),
  );
  expect(replace).toHaveBeenCalledWith('/login');
  expect(screen.queryByText('Settings page')).toBeNull();
});
