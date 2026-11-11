import {
  NOTIFICATION_TABS,
  type Notification,
  type NotificationListResponse,
  type UnreadCountResponse,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { NotificationGateways, NotificationRow } from '../../ports/notifications.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { Actor } from '../iam/actions.js';

/** How many of the newest notices the panel shows. */
export const NOTIFICATION_PAGE = 50;

export const NOTIFICATION_MESSAGES = {
  notFound: 'This notification does not exist.',
} as const;

/** 404: no notice with this id belongs to the signed-in user. */
export class NotificationNotFoundError extends Error {
  constructor() {
    super(NOTIFICATION_MESSAGES.notFound);
    this.name = 'NotificationNotFoundError';
  }
}

const view = (row: NotificationRow): Notification => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  link: row.linkRecord,
  createdAt: row.createdAt.toISOString(),
  read: row.readAt !== null,
});

/** REQ-NTF-001, C-03, DEC-125: the bell and NotificationCenter of every signed-in user. */
export class NotificationService {
  constructor(
    private readonly unitOfWork: UnitOfWork<NotificationGateways>,
    private readonly clock: ClockPort,
  ) {}

  list(actor: Actor): Promise<NotificationListResponse> {
    return this.unitOfWork.run(async ({ notifications }) => {
      const rows = await notifications.list(actor.user.id, NOTIFICATION_PAGE);
      const byKind = await notifications.unreadByKind(actor.user.id);
      const count = (kinds: readonly string[]) =>
        kinds.reduce((sum, kind) => sum + (byKind[kind as keyof typeof byKind] ?? 0), 0);
      const tabs = Object.fromEntries(NOTIFICATION_TABS.map((tab) => [tab.key, count(tab.kinds)]));
      return {
        notifications: rows.map(view),
        unread: {
          all: count(Object.keys(byKind)),
          approvals: tabs.approvals ?? 0,
          steps: tabs.steps ?? 0,
          alerts: tabs.alerts ?? 0,
          schedule: tabs.schedule ?? 0,
        },
      };
    });
  }

  /** The bell badge (DEC-125: read on page load, panel open and every 60 seconds). */
  unreadCount(actor: Actor): Promise<UnreadCountResponse> {
    return this.unitOfWork.run(async ({ notifications }) => {
      const byKind = await notifications.unreadByKind(actor.user.id);
      return { unread: Object.values(byKind).reduce<number>((sum, n) => sum + (n ?? 0), 0) };
    });
  }

  /** A click on a notice marks it read (ui-action-map NotificationCenter). */
  markRead(actor: Actor, id: number): Promise<void> {
    return this.unitOfWork.run(async ({ notifications }) => {
      if (!(await notifications.markRead(actor.user.id, id, this.clock.now()))) {
        throw new NotificationNotFoundError();
      }
    });
  }

  markAllRead(actor: Actor): Promise<void> {
    return this.unitOfWork.run(({ notifications }) =>
      notifications.markAllRead(actor.user.id, this.clock.now()),
    );
  }
}
