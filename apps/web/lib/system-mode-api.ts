import type { ApiClient } from '@bmi/api-client';
import type { SystemModeSwitchRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Setup and go live (REQ-IAM-010, DEC-132) through the generated client. */
export function systemModeApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const headers = (key: string) => ({ 'Idempotency-Key': key });
  return {
    status: () => settle(client().GET('/system-mode')),
    /** NFR-01: a retry of the same switch sends the same key. */
    goLive: (body: SystemModeSwitchRequest, key: string) =>
      settle(client().POST('/system-mode/go-live', { body, headers: headers(key) })),
    backToSetup: (body: SystemModeSwitchRequest, key: string) =>
      settle(client().POST('/system-mode/back-to-setup', { body, headers: headers(key) })),
  };
}

export type SystemModeApi = ReturnType<typeof systemModeApi>;
