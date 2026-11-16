import type { ApiClient } from '@bmi/api-client';
import type { VendorRequest, VendorUpdateRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** The vendor master (REQ-INV-014, DEC-134) through the generated client. */
export function vendorsApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ params: { path: { id: String(id) } } });
  return {
    list: () => settle(client().GET('/vendors')),
    create: (body: VendorRequest) => settle(client().POST('/vendors', { body })),
    update: (id: number, body: VendorUpdateRequest) =>
      settle(client().PATCH('/vendors/{id}', { ...path(id), body })),
    deactivate: (id: number) => settle(client().POST('/vendors/{id}/deactivate', path(id))),
    activate: (id: number) => settle(client().POST('/vendors/{id}/activate', path(id))),
  };
}

export type VendorsApi = ReturnType<typeof vendorsApi>;
