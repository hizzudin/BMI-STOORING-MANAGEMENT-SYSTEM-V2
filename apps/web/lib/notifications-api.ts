import type { ApiClient } from '@bmi/api-client';
import { browserApi, settle } from './auth-api';

/** The bell and NotificationCenter (REQ-NTF-001, C-03, DEC-125) through the generated client. */
export function notificationsApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  return {
    list: () => settle(client().GET('/notifications')),
    unreadCount: () => settle(client().GET('/notifications/unread-count')),
    read: (id: number) =>
      settle(client().POST('/notifications/{id}/read', { params: { path: { id: String(id) } } })),
    readAll: () => settle(client().POST('/notifications/read-all')),
  };
}

export type NotificationsApi = ReturnType<typeof notificationsApi>;
