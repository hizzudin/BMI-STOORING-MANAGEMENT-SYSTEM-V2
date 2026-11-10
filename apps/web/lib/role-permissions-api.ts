import type { ApiClient } from '@bmi/api-client';
import type { RolePermissionsChangeRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Roles and permissions (REQ-IAM-005, DEC-117) through the generated client. */
export function rolePermissionsApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  return {
    get: () => settle(client().GET('/role-permissions')),
    change: (changes: RolePermissionsChangeRequest['changes']) =>
      settle(client().PATCH('/role-permissions', { body: { changes } })),
  };
}

export type RolePermissionsApi = ReturnType<typeof rolePermissionsApi>;
