import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KINDS, NOTIFICATION_TABS, NotificationSchema } from './notifications.js';

describe('REQ-NTF-001 notifications', () => {
  it('every kind of §9.12 shows in exactly one filter tab', () => {
    const shown = NOTIFICATION_TABS.flatMap((tab) => tab.kinds);
    expect([...shown].sort()).toEqual([...NOTIFICATION_KINDS].sort());
  });

  it('a notice that opens nothing has a null link (DEC-125)', () => {
    const notice = {
      id: 1,
      kind: 'Approval',
      title: 'Planner approval switched on',
      body: null,
      link: null,
      createdAt: '2026-11-11T01:00:00.000Z',
      read: false,
    };
    expect(NotificationSchema.parse(notice)).toEqual(notice);
    expect(NotificationSchema.safeParse({ ...notice, kind: 'Access' }).success).toBe(false);
  });
});
