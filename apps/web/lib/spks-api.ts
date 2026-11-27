import type { ApiClient } from '@bmi/api-client';
import type {
  SpkCancelRequest,
  SpkListQuery,
  SpkRequest,
  SpkSubmitRequest,
  SpkUpdateRequest,
} from '@bmi/shared';
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
    list: (query?: SpkListQuery) => settle(client().GET('/spks', { params: { query } })),
    getDetail: (id: number) => settle(client().GET('/spks/{id}/detail', path(id))),
    /** T6, DEC-129; NFR-01: a retry of the same cancel sends the same key. */
    cancel: (id: number, body: SpkCancelRequest, key: string) =>
      settle(
        client().POST('/spks/{id}/cancel', {
          ...path(id),
          body,
          headers: { 'Idempotency-Key': key },
        }),
      ),
    /** T15, DEC-140: an Approver cancels an open SPK; NFR-01 as for `cancel`. */
    approverCancel: (id: number, body: SpkCancelRequest, key: string) =>
      settle(
        client().POST('/spks/{id}/approver-cancel', {
          ...path(id),
          body,
          headers: { 'Idempotency-Key': key },
        }),
      ),
  };
}

export type SpksApi = ReturnType<typeof spksApi>;
