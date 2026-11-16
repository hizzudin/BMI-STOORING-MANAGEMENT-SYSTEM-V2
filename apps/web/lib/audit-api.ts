import type { ApiClient } from '@bmi/api-client';
import type { AccessHistoryQuery, AuditLogExportQuery, AuditLogQuery } from '@bmi/shared';
import { browserApi, settle, type Outcome } from './auth-api';

const FILE_NAME = /filename="([^"]+)"/;

/** The Audit log (REQ-IAM-007, DEC-131), its export (DEC-74) and Access history through the client. */
export function auditApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  return {
    list: (query?: Partial<AuditLogQuery>) =>
      settle(client().GET('/audit-logs', { params: { query } })),
    detail: (id: number) =>
      settle(client().GET('/audit-logs/{id}', { params: { path: { id: String(id) } } })),
    /** The file under the filters, named as the server names it. */
    exportFile: async (
      query: AuditLogExportQuery,
    ): Promise<Outcome<{ blob: Blob; fileName: string }>> => {
      let fileName = `audit-log.${query.format}`;
      const outcome = await settle(
        client()
          .GET('/audit-logs/export', { params: { query }, parseAs: 'blob' })
          .then((answer) => {
            const named = FILE_NAME.exec(answer.response.headers.get('content-disposition') ?? '');
            if (named?.[1]) fileName = named[1];
            return answer;
          }),
      );
      return outcome.ok ? { ok: true, data: { blob: outcome.data as Blob, fileName } } : outcome;
    },
    accessHistory: (query?: Partial<AccessHistoryQuery>) =>
      settle(client().GET('/access-history', { params: { query } })),
  };
}

export type AuditApi = ReturnType<typeof auditApi>;
