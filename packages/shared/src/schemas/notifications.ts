import { z } from 'zod';

/** §9.12 notifications.kind (REQ-NTF-001). */
export const NOTIFICATION_KINDS = [
  'Approval',
  'Step',
  'Alert',
  'Schedule',
  'Change_Request',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The filter tabs of NotificationCenter (ui-action-map) and the kinds each one shows. */
export const NOTIFICATION_TABS = [
  { key: 'approvals', label: 'Approvals', kinds: ['Approval', 'Change_Request'] },
  { key: 'steps', label: 'Steps', kinds: ['Step'] },
  { key: 'alerts', label: 'Alerts', kinds: ['Alert'] },
  { key: 'schedule', label: 'Schedule', kinds: ['Schedule'] },
] as const satisfies readonly {
  key: string;
  label: string;
  kinds: readonly NotificationKind[];
}[];
export type NotificationTab = (typeof NOTIFICATION_TABS)[number]['key'];

/** DEC-125: the bell badge is read again every 60 seconds while a page is open. */
export const NOTIFICATION_POLL_MS = 60_000;

export const NotificationSchema = z.object({
  id: z.number().int(),
  kind: z.enum(NOTIFICATION_KINDS),
  title: z.string(),
  body: z.string().nullable(),
  /** The app path of the record it opens, or null when it opens nothing (DEC-125). */
  link: z.string().nullable(),
  createdAt: z.string(),
  read: z.boolean(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
  /** Unread notices per tab; `all` is the bell badge. */
  unread: z.object({
    all: z.number().int(),
    approvals: z.number().int(),
    steps: z.number().int(),
    alerts: z.number().int(),
    schedule: z.number().int(),
  }),
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

export const UnreadCountResponseSchema = z.object({ unread: z.number().int() });
export type UnreadCountResponse = z.infer<typeof UnreadCountResponseSchema>;
