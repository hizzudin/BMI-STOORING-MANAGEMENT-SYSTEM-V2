import type { NotificationKind, Role } from '@bmi/shared';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type {
  NewNotice,
  NotificationGateway,
  NotificationGateways,
  NotificationRow,
} from '../../ports/notifications.js';
import { notificationDeliveries, notifications, userRoles, users } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleNotificationGateway implements NotificationGateway {
  constructor(private readonly tx: DbTransaction) {}

  async activeUsersWithRoles(roles: readonly Role[]): Promise<number[]> {
    if (roles.length === 0) return [];
    const rows = await this.tx
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(inArray(userRoles.role, [...roles]), eq(users.isActive, true), isNull(users.deletedAt)),
      )
      .orderBy(users.id);
    return rows.map((row) => row.id);
  }

  async send(userIds: readonly number[], notice: NewNotice): Promise<void> {
    if (userIds.length === 0) return;
    const written = await this.tx
      .insert(notifications)
      .values(
        userIds.map((userId) => ({
          userId,
          kind: notice.kind,
          title: notice.title,
          body: notice.body,
          linkRecord: notice.linkRecord,
          dedupeKey: notice.dedupeKey,
        })),
      )
      .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
      .returning({ id: notifications.id });
    if (written.length === 0) return;
    // In-app is delivered by being written; the Push rows come with the mobile app (DEC-125).
    await this.tx.insert(notificationDeliveries).values(
      written.map(({ id }) => ({
        notificationId: id,
        channel: 'InApp',
        status: 'Sent',
        sentAt: sql`now()`,
      })),
    );
  }

  async list(userId: number, limit: number): Promise<NotificationRow[]> {
    const rows = await this.tx
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        linkRecord: notifications.linkRecord,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.id))
      .limit(limit);
    return rows.map((row) => ({ ...row, kind: row.kind as NotificationKind }));
  }

  async unreadByKind(userId: number): Promise<Partial<Record<NotificationKind, number>>> {
    const rows = await this.tx
      .select({ kind: notifications.kind, count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .groupBy(notifications.kind);
    return Object.fromEntries(rows.map((row) => [row.kind, row.count]));
  }

  async markRead(userId: number, id: number, at: Date): Promise<boolean> {
    const [own] = await this.tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    if (!own) return false;
    await this.tx
      .update(notifications)
      .set({ readAt: at, updatedAt: sql`now()` })
      .where(and(eq(notifications.id, id), isNull(notifications.readAt)));
    return true;
  }

  async markAllRead(userId: number, at: Date): Promise<void> {
    await this.tx
      .update(notifications)
      .set({ readAt: at, updatedAt: sql`now()` })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
}

export const notificationGateways = (tx: DbTransaction): NotificationGateways => ({
  notifications: new DrizzleNotificationGateway(tx),
});
