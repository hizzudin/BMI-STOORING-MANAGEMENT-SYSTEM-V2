import type { ApiClient } from '@bmi/api-client';
import type { DocumentTypeRequest, DocumentTypeUpdateRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Document types (REQ-DOC-002, DEC-121) through the generated client. */
export function documentTypesApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ params: { path: { id: String(id) } } });
  return {
    list: () => settle(client().GET('/document-types')),
    create: (body: DocumentTypeRequest) => settle(client().POST('/document-types', { body })),
    update: (id: number, body: DocumentTypeUpdateRequest) =>
      settle(client().PATCH('/document-types/{id}', { ...path(id), body })),
    deactivate: (id: number) => settle(client().POST('/document-types/{id}/deactivate', path(id))),
  };
}

export type DocumentTypesApi = ReturnType<typeof documentTypesApi>;
