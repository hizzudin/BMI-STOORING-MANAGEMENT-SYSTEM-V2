import type { NotificationKind, Role } from '@bmi/shared';

/** One notice, sent to each recipient of an event (REQ-NTF-005). */
export interface NewNotice {
  kind: NotificationKind;
  title: string;
  body: string | null;
  /** The app path of the record it opens, or null when it opens nothing (DEC-125). */
  linkRecord: string | null;
  /** DEC-125: names the event; a recipient gets one notice per key. */
  dedupeKey: string;
}

/** §9.12 notifications: one notice of one user. */
export interface NotificationRow {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string | null;
  linkRecord: string | null;
  createdAt: Date;
  readAt: Date | null;
}

export interface NotificationGateway {
  /** Active accounts holding one of these roles: the recipients the matrix names by role. */
  activeUsersWithRoles(roles: readonly Role[]): Promise<number[]>;
  /**
   * The outbox of 8.3 (DEC-125): written in the caller's transaction with its InApp delivery
   * (Sent); a recipient that already has a notice with this key gets nothing more.
   */
  send(userIds: readonly number[], notice: NewNotice): Promise<void>;
  /** The user's newest notices first. */
  list(userId: number, limit: number): Promise<NotificationRow[]>;
  unreadByKind(userId: number): Promise<Partial<Record<NotificationKind, number>>>;
  /** False when the notice is not the user's. */
  markRead(userId: number, id: number, at: Date): Promise<boolean>;
  markAllRead(userId: number, at: Date): Promise<void>;
}

export interface NotificationGateways {
  notifications: NotificationGateway;
}
