import {
  defaultRolePermissions,
  type MeResponse,
  type Notification,
  type NotificationListResponse,
} from '@bmi/shared';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthApi } from '../../lib/auth-api';
import type { NotificationsApi } from '../../lib/notifications-api';
import { PageHead } from './AppShell';
import { NotificationCenter, whenText } from './NotificationCenter';
import { SignedInShell } from './SignedInShell';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const now = new Date('2026-11-11T01:00:00.000Z'); // 08:00 WIB
const notice = (overrides: Partial<Notification>): Notification => ({
  id: 1,
  kind: 'Approval',
  title: 'SPK-2611040142 waits for your approval',
  body: 'Creation approval',
  link: null,
  createdAt: '2026-11-11T00:55:00.000Z',
  read: false,
  ...overrides,
});

const page: NotificationListResponse = {
  notifications: [
    notice({ id: 3, kind: 'Step', title: 'Step 3 opened on SPK-2611040139', link: '/vehicles/1' }),
    notice({
      id: 2,
      title: 'Planner approval switched on',
      body: 'Planners may approve SPK creation',
    }),
    notice({ id: 1, kind: 'Alert', title: 'KIR expires in 14 days', read: true }),
  ],
  unread: { all: 2, approvals: 1, steps: 1, alerts: 0, schedule: 0 },
};

const ok = <T,>(data: T) => Promise.resolve({ ok: true as const, data });

function apiWith(
  overrides: Partial<Record<keyof NotificationsApi, unknown>> = {},
): NotificationsApi {
  return {
    list: vi.fn(() => ok(page)),
    unreadCount: vi.fn(() => ok({ unread: 2 })),
    read: vi.fn(() => ok({ ok: true as const })),
    readAll: vi.fn(() => ok({ ok: true as const })),
    ...overrides,
  } as unknown as NotificationsApi;
}

async function openPanel(api: NotificationsApi) {
  const handlers = { navigate: vi.fn(), onClose: vi.fn(), onUnread: vi.fn() };
  await act(async () => {
    render(<NotificationCenter api={api} now={() => now} {...handlers} />);
  });
  return handlers;
}

const rowOf = (title: string) => screen.getByRole('button', { name: new RegExp(title) });

describe('NotificationCenter (REQ-NTF-001, C-03, DEC-125)', () => {
  it('REQ-NTF-001 lists the notices with read and unread state; the tabs filter and count unread', async () => {
    const handlers = await openPanel(apiWith());
    expect(handlers.onUnread).toHaveBeenCalledWith(2);
    expect(within(rowOf('Step 3 opened')).getByText('Unread')).toBeTruthy();
    expect(within(rowOf('KIR expires')).queryByText('Unread')).toBeNull();
    expect(rowOf('Planner approval').textContent).toContain(
      'Planners may approve SPK creation · 5 min ago',
    );
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'All',
      'Approvals1',
      'Steps1',
      'Alerts',
      'Schedule',
    ]);
    fireEvent.click(screen.getByRole('tab', { name: /Steps/ }));
    expect(screen.queryByRole('button', { name: /Planner approval/ })).toBeNull();
    expect(rowOf('Step 3 opened')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Schedule' }));
    expect(screen.getByText('No notifications here.')).toBeTruthy();
  });

  it('NAV-5 a notice marks itself read and opens the record it names', async () => {
    const api = apiWith();
    const handlers = await openPanel(api);
    await act(async () => {
      fireEvent.click(rowOf('Step 3 opened'));
    });
    expect(api.read).toHaveBeenCalledWith(3);
    expect(handlers.onClose).toHaveBeenCalled();
    expect(handlers.navigate).toHaveBeenCalledWith('/vehicles/1');
  });

  it('DEC-125 a notice without a record is only marked read; Mark all read reads every notice', async () => {
    const api = apiWith();
    const handlers = await openPanel(api);
    await act(async () => {
      fireEvent.click(rowOf('Planner approval'));
    });
    expect(api.read).toHaveBeenCalledWith(2);
    expect(handlers.navigate).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(2);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    });
    expect(api.readAll).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(3);
  });

  it('C-14 Close and Escape close the panel; a refusal shows its sentence', async () => {
    const api = apiWith({
      list: vi.fn(() =>
        Promise.resolve({
          ok: false as const,
          status: 0,
          message: 'The server cannot be reached.',
        }),
      ),
    });
    const handlers = await openPanel(api);
    expect(screen.getByRole('alert').textContent).toBe('The server cannot be reached.');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Notifications' }), { key: 'Escape' });
    expect(handlers.onClose).toHaveBeenCalledTimes(2);
  });

  it('NFR-14 shows when a notice came, in WIB', () => {
    expect(whenText('2026-11-11T00:59:40.000Z', now)).toBe('just now');
    expect(whenText('2026-11-10T23:00:00.000Z', now)).toBe('2 h ago');
    expect(whenText('2026-11-10T09:40:00.000Z', now)).toBe('yesterday 16:40');
    expect(whenText('2026-11-03T09:40:00.000Z', now)).toBe('2026-11-03 16:40');
  });
});

describe('The bell (C-03, DEC-125)', () => {
  const me: MeResponse = {
    user: {
      id: 7,
      name: 'Budi',
      email: 'budi@bmi.co.id',
      role: 'Supervisor',
      mustChangePassword: false,
    },
    capabilities: defaultRolePermissions()
      .filter((row) => row.role === 'Supervisor' && row.allowed)
      .map((row) => row.permissionCode),
    systemMode: 'Live',
  };
  const auth = {
    me: vi.fn(() => ok(me)),
    signOut: vi.fn(() => ok({ ok: true as const })),
  } as unknown as AuthApi;

  it('C-03 the badge shows the unread count, read again every 60 seconds; the bell opens the panel', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const unreadCount = vi
      .fn()
      .mockReturnValueOnce(ok({ unread: 2 }))
      .mockReturnValue(ok({ unread: 5 }));
    const notices = apiWith({ unreadCount });
    await act(async () => {
      render(
        <SignedInShell api={auth} navigate={vi.fn()} pathname="/" notices={notices}>
          <PageHead title="Dashboard" />
        </SignedInShell>,
      );
    });
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByRole('button', { name: 'Notifications, 5 unread' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Notifications, 5 unread' }));
    });
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeTruthy();
    // Opening the panel reads the list, and the badge follows it.
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeTruthy();
  });
});
