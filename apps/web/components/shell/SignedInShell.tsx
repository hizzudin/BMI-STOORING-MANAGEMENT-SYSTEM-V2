'use client';

import { menuFor, MENU, type MenuKey, type MeResponse } from '@bmi/shared';
import { useEffect, useState, type ReactNode } from 'react';
import type { AuthApi } from '../../lib/auth-api';
import type { IconName } from '../kit/Icon';
import { AppShell, PageHead, type NavItem } from './AppShell';

/** C-01: where each item of the 2.4 menu table opens, and its icon. */
const ROUTES: Record<MenuKey, { href: string; icon: IconName }> = {
  dashboard: { href: '/', icon: 'dashboard' },
  spk: { href: '/spk', icon: 'spk' },
  breakdown: { href: '/breakdown-reports', icon: 'breakdown' },
  schedule: { href: '/schedule', icon: 'schedule' },
  approvals: { href: '/approvals', icon: 'approvals' },
  inventory: { href: '/inventory', icon: 'inventory' },
  vehicles: { href: '/vehicles', icon: 'vehicles' },
  documents: { href: '/documents', icon: 'documents' },
  invoices: { href: '/invoices', icon: 'invoices' },
  customers: { href: '/customers', icon: 'customers' },
  reports: { href: '/reports', icon: 'reports' },
  settings: { href: '/settings', icon: 'settings' },
  users: { href: '/users', icon: 'users' },
  audit: { href: '/audit-log', icon: 'audit' },
  setup: { href: '/setup', icon: 'setup' },
};

const covers = (href: string, pathname: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/** The menu item a path belongs to, whether or not this user may see it. */
const itemOf = (pathname: string): MenuKey | undefined =>
  MENU.find((item) => covers(ROUTES[item.key].href, pathname))?.key;

const homeOf = (menu: { key: MenuKey }[]): string => (menu[0] ? ROUTES[menu[0].key].href : '/');

const railKey = (userId: number) => `bmi.rail.${userId}`;

/** C-02: the rail is collapsed unless this user expanded it on this browser. */
function readCollapsed(userId: number): boolean {
  try {
    return window.localStorage.getItem(railKey(userId)) !== 'expanded';
  } catch {
    return true;
  }
}

function saveCollapsed(userId: number, collapsed: boolean): void {
  try {
    window.localStorage.setItem(railKey(userId), collapsed ? 'collapsed' : 'expanded');
  } catch {
    // A browser without storage keeps the choice for this visit only.
  }
}

export interface SignedInShellProps {
  api: AuthApi;
  navigate: (path: string) => void;
  pathname: string;
  children: ReactNode;
}

/**
 * NAV-9, REQ-IAM-013: every signed-in page asks GET /me on load and shows exactly the items of the 2.4
 * menu table whose codes the user holds. Nothing here looks at the role name to decide what shows.
 */
export function SignedInShell({ api, navigate, pathname, children }: SignedInShellProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    let live = true;
    void api.me().then((outcome) => {
      if (!live) return;
      if (!outcome.ok) return navigate('/login');
      if (outcome.data.user.mustChangePassword) return navigate('/change-password');
      setCollapsed(readCollapsed(outcome.data.user.id));
      setMe(outcome.data);
    });
    return () => {
      live = false;
    };
  }, [api, navigate]);

  useEffect(() => {
    if (!me) return;
    const menu = menuFor(new Set(me.capabilities), me.systemMode);
    const home = homeOf(menu);
    if (pathname === '/' && !menu.some((item) => item.key === 'dashboard') && home !== '/') {
      navigate(home);
    }
  }, [me, pathname, navigate]);

  if (!me) return null;

  const menu = menuFor(new Set(me.capabilities), me.systemMode);
  const items: NavItem[] = menu.map((item) => ({
    key: item.key,
    label: item.label,
    ...ROUTES[item.key],
  }));
  const current = itemOf(pathname);
  const hidden = current !== undefined && !menu.some((item) => item.key === current);
  // The home page of a user without the Dashboard item is its first menu item: the Access Manager
  // lands on Users and roles (ui-action-map WebLogin), decided by the capabilities, not the role name.
  const home = homeOf(menu);
  const sendHome = pathname === '/' && hidden && home !== '/';

  if (sendHome) return null;

  return (
    <AppShell
      items={items}
      activeKey={current ?? ''}
      user={{
        name: me.user.name,
        email: me.user.email,
        role: (me.user.role ?? '').replaceAll('_', ' '),
      }}
      collapsed={collapsed}
      onCollapsedChange={(next) => {
        setCollapsed(next);
        saveCollapsed(me.user.id, next);
      }}
      onSignOut={() => {
        void api.signOut().then(() => navigate('/login'));
      }}
    >
      {hidden ? (
        <>
          <PageHead title="Not allowed" />
          <p className="muted">You do not have permission to open this page.</p>
        </>
      ) : (
        children
      )}
    </AppShell>
  );
}
