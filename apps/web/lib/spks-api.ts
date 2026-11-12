import type { ApiClient } from '@bmi/api-client';
import type { SpkRequest, SpkSubmitRequest, SpkUpdateRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Create SPK (REQ-SPK-001, REQ-SPK-013, REQ-SPK-015, DEC-126) through the generated client. */
export function spksApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ params: { path: { id: String(id) } } });
  return {
    options: () => settle(client().GET('/spks/options')),
    get: (id: number) => settle(client().GET('/spks/{id}', path(id))),
    create: (body: SpkRequest) => settle(client().POST('/spks', { body })),
    update: (id: number, body: SpkUpdateRequest) =>
      settle(client().PATCH('/spks/{id}', { ...path(id), body })),
    submit: (id: number, body: SpkSubmitRequest) =>
      settle(client().POST('/spks/{id}/submit', { ...path(id), body })),
  };
}

export type SpksApi = ReturnType<typeof spksApi>;
