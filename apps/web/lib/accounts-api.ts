import type { ApiClient } from '@bmi/api-client';
import type { AccountRequest, AccountUpdateRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Users and roles (REQ-IAM-002 to REQ-IAM-004) through the generated client. */
export function accountsApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ params: { path: { id: String(id) } } });
  return {
    list: () => settle(client().GET('/accounts')),
    create: (body: AccountRequest) => settle(client().POST('/accounts', { body })),
    update: (id: number, body: AccountUpdateRequest) =>
      settle(client().PATCH('/accounts/{id}', { ...path(id), body })),
    unlock: (id: number) => settle(client().POST('/accounts/{id}/unlock', path(id))),
    deactivate: (id: number) => settle(client().POST('/accounts/{id}/deactivate', path(id))),
    activate: (id: number) => settle(client().POST('/accounts/{id}/activate', path(id))),
    resetPassword: (id: number) => settle(client().POST('/accounts/{id}/reset-password', path(id))),
    moveSystemAdmin: (toUserId: number, reason: string) =>
      settle(client().POST('/accounts/move-system-admin', { body: { toUserId, reason } })),
  };
}

export type AccountsApi = ReturnType<typeof accountsApi>;
