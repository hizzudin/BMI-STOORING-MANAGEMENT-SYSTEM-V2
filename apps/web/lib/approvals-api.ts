import type { ApiClient } from '@bmi/api-client';
import type {
  ApprovalDecisionRequest,
  ApprovalHistoryQuery,
  ApprovalInboxQuery,
} from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Approvals (REQ-APR-001 to REQ-APR-007, DEC-128) through the generated client. */
export function approvalsApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ path: { id: String(id) } });
  // NFR-01: one key per decision; a retry of the same decision sends the same key.
  const keyed = (key: string) => ({ headers: { 'Idempotency-Key': key } });
  return {
    count: () => settle(client().GET('/approvals/count')),
    inbox: (query?: ApprovalInboxQuery) =>
      settle(client().GET('/approvals/spk', { params: { query } })),
    review: (id: number) => settle(client().GET('/approvals/spk/{id}', { params: path(id) })),
    approve: (id: number, body: ApprovalDecisionRequest, key: string) =>
      settle(
        client().POST('/approvals/spk/{id}/approve', { params: path(id), body, ...keyed(key) }),
      ),
    reject: (id: number, body: ApprovalDecisionRequest, key: string) =>
      settle(
        client().POST('/approvals/spk/{id}/reject', { params: path(id), body, ...keyed(key) }),
      ),
    history: (query?: ApprovalHistoryQuery) =>
      settle(client().GET('/approvals/history', { params: { query } })),
  };
}

export type ApprovalsApi = ReturnType<typeof approvalsApi>;
