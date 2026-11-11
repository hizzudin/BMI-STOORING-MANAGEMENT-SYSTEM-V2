'use client';

import {
  NOTIFICATION_TABS,
  formatTimeWib,
  wibCalendarDay,
  type Notification,
  type NotificationKind,
  type NotificationListResponse,
} from '@bmi/shared';
import { useCallback, useEffect, useState } from 'react';
import type { NotificationsApi } from '../../lib/notifications-api';
import { Button } from '../kit/Button';
import { Icon, type IconName } from '../kit/Icon';
import { Refusal } from '../kit/SidePanel';
import { StatusPill } from '../kit/StatusPill';

const ICONS: Record<NotificationKind, IconName> = {
  Approval: 'approvals',
  Change_Request: 'spk',
  Step: 'wrench',
  Alert: 'alert',
  Schedule: 'schedule',
};

const DAY_MS = 86_400_000;

/** "5 min ago", "2 h ago", "yesterday 16:40" or "2026-11-03 16:40", in WIB (NFR-14). */
export function whenText(createdAt: string, now: Date): string {
  const at = new Date(createdAt);
  const minutes = Math.max(0, Math.floor((now.getTime() - at.getTime()) / 60_000));
  const time = formatTimeWib(at).slice(0, 5);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (wibCalendarDay(at) === wibCalendarDay(now)) return `${Math.floor(minutes / 60)} h ago`;
  if (wibCalendarDay(at) === wibCalendarDay(new Date(now.getTime() - DAY_MS))) {
    return `yesterday ${time}`;
  }
  return `${wibCalendarDay(at)} ${time}`;
}

type TabKey = 'all' | (typeof NOTIFICATION_TABS)[number]['key'];

/**
 * REQ-NTF-001, C-03: the panel the bell opens over the current page. A notice marks itself read and
 * opens the record it names; a notice without a record (DEC-125) is only marked read.
 */
export function NotificationCenter({
  api,
  navigate,
  onClose,
  onUnread,
  now = () => new Date(),
}: {
  api: NotificationsApi;
  navigate: (path: string) => void;
  onClose: () => void;
  /** Tells the bell the new unread count. */
  onUnread: (unread: number) => void;
  now?: () => Date;
}) {
  const [page, setPage] = useState<NotificationListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');

  const load = useCallback(async () => {
    const outcome = await api.list();
    if (!outcome.ok) return setError(outcome.message);
    setPage(outcome.data);
    onUnread(outcome.data.unread.all);
    return undefined;
  }, [api, onUnread]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = async (notice: Notification) => {
    if (!notice.read) {
      const outcome = await api.read(notice.id);
      if (!outcome.ok) return setError(outcome.message);
    }
    if (notice.link) {
      onClose();
      navigate(notice.link);
      return undefined;
    }
    return load();
  };

  const readAll = async () => {
    const outcome = await api.readAll();
    if (!outcome.ok) return setError(outcome.message);
    return load();
  };

  const shown = (page?.notifications ?? []).filter((notice) => {
    if (tab === 'all') return true;
    const kinds: readonly NotificationKind[] =
      NOTIFICATION_TABS.find((t) => t.key === tab)?.kinds ?? [];
    return kinds.includes(notice.kind);
  });
  const at = now();

  return (
    <div
      className="overlay right"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="panel notice-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <h3 className="notice-title">Notifications</h3>
        <div className="bar bar-start notice-actions">
          <Button variant="ghost" onClick={() => void readAll()}>
            Mark all read
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="tabs" role="tablist">
          {[{ key: 'all' as const, label: 'All' }, ...NOTIFICATION_TABS].map((item) => {
            const unread = item.key === 'all' ? 0 : (page?.unread[item.key] ?? 0);
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={tab === item.key ? 'tab on' : 'tab'}
                onClick={() => setTab(item.key)}
              >
                {item.label}
                {unread > 0 && <span className="tab-count">{unread}</span>}
              </button>
            );
          })}
        </div>
        <Refusal message={error} />
        {page && shown.length === 0 && <p className="small muted">No notifications here.</p>}
        <ul className="notice-list">
          {shown.map((notice) => (
            <li key={notice.id}>
              <button
                type="button"
                className={notice.read ? 'notice-row' : 'notice-row unread'}
                onClick={() => void open(notice)}
              >
                <span className="circle-ic">
                  <Icon name={ICONS[notice.kind]} size={18} />
                </span>
                <span className="grow">
                  <span className="notice-head">{notice.title}</span>
                  <span className="small muted">
                    {notice.body ? `${notice.body} · ` : ''}
                    {whenText(notice.createdAt, at)}
                  </span>
                </span>
                {!notice.read && <StatusPill tone="info">Unread</StatusPill>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
