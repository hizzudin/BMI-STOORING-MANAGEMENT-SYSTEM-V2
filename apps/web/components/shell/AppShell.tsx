'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  /** Items waiting for this user (shown on the icon, and beside the name when expanded). */
  count?: number;
}

export interface AppShellProps {
  /** The items of the 2.4 menu table that the user's capabilities allow (TASK-106 decides them). */
  items: NavItem[];
  activeKey: string;
  user: { name: string; role: string; email?: string };
  collapsed: boolean;
  /** C-02: the caller saves the choice per user. */
  onCollapsedChange: (collapsed: boolean) => void;
  onSignOut?: () => void;
  onOpenNotifications?: () => void;
  unreadNotifications?: number;
  children: ReactNode;
}

interface BellState {
  unread: number;
  open?: () => void;
}

/** The bell sits with the page actions in the sheet's header row (ui.md 7.2, DEC-94). */
const BellContext = createContext<BellState | null>(null);

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/** 7.2 App shell and DEC-82, DEC-94: a floating white rail capsule and one main sheet. */
export function AppShell({
  items,
  activeKey,
  user,
  collapsed,
  onCollapsedChange,
  onSignOut,
  onOpenNotifications,
  unreadNotifications = 0,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="shell" data-collapsed={collapsed}>
      <aside className="rail">
        <a className="rail-logo" href="/dashboard" aria-label="BMI Stooring System">
          {/* DEC-81: the client's logo in a white circle, blended into the rail. */}
          <img className="logo-tile" src="/bmi-logo.png" alt="" width={52} height={52} />
          <span className="rail-brand">
            BMI Stooring<small>System</small>
          </span>
        </a>
        <nav aria-label="Main menu" className="rail-nav">
          {items.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={item.key === activeKey ? 'rail-item on' : 'rail-item'}
              aria-current={item.key === activeKey ? 'page' : undefined}
              data-tip={item.label}
              aria-label={item.count ? `${item.label}, ${item.count} waiting` : item.label}
            >
              <Icon name={item.icon} />
              <span className="rail-label">{item.label}</span>
              {item.count ? <b className="rail-count">{item.count}</b> : null}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="rail-toggle"
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
          aria-expanded={!collapsed}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <Icon name="expand" size={16} />
        </button>
        <button
          type="button"
          className="me"
          aria-label={`${user.name}, ${user.role}`}
          onClick={() => setMenuOpen(true)}
        >
          {initials(user.name)}
        </button>
      </aside>

      <main className="sheet">
        <BellContext.Provider value={{ unread: unreadNotifications, open: onOpenNotifications }}>
          {children}
        </BellContext.Provider>
      </main>

      {menuOpen && (
        <div
          className="overlay right"
          onClick={(event) => event.target === event.currentTarget && setMenuOpen(false)}
        >
          <div
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-label={user.name}
            onKeyDown={(event) => event.key === 'Escape' && setMenuOpen(false)}
          >
            <h3>{user.name}</h3>
            <p className="small muted">{[user.email, user.role].filter(Boolean).join(' · ')}</p>
            <div className="menu-row">
              <a className="btn btn-ghost" href="/change-password">
                Change password
              </a>
            </div>
            <div className="menu-row">
              <Button variant="ghost" disabled title="Release 2">
                Notification settings
              </Button>
            </div>
            <div className="menu-row">
              <Button variant="ghost" onClick={onSignOut}>
                <Icon name="logout" size={16} />
                Sign out
              </Button>
            </div>
            <div className="bar">
              <Button variant="ghost" onClick={() => setMenuOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export interface PageHeadProps {
  title: string;
  /** A short trail above the title, e.g. "Surat Perintah Kerja / New". */
  crumb?: string;
  /** Status pills and the primary action of the page. */
  actions?: ReactNode;
}

/** The sheet's header row: title, status and actions, then the bell (DEC-94). */
export function PageHead({ title, crumb, actions }: PageHeadProps) {
  const bell = useContext(BellContext);
  return (
    <div className="head">
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
      </div>
      <span className="grow" />
      {actions}
      {bell && (
        <button
          type="button"
          className="icon-btn"
          aria-label={`Notifications, ${bell.unread} unread`}
          onClick={bell.open}
        >
          <Icon name="bell" size={18} />
          {bell.unread > 0 && <b className="badge">{bell.unread}</b>}
        </button>
      )}
    </div>
  );
}
