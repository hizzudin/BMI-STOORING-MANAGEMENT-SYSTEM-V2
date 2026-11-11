import type { ApiClient } from '@bmi/api-client';
import type { VehicleDeactivateRequest, VehicleRequest, VehicleUpdateRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Vehicles (REQ-VEH-001 to REQ-VEH-004, DEC-122) through the generated client. */
export function vehiclesApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  const path = (id: number) => ({ params: { path: { id: String(id) } } });
  return {
    list: () => settle(client().GET('/vehicles')),
    get: (id: number) => settle(client().GET('/vehicles/{id}', path(id))),
    create: (body: VehicleRequest) => settle(client().POST('/vehicles', { body })),
    update: (id: number, body: VehicleUpdateRequest) =>
      settle(client().PATCH('/vehicles/{id}', { ...path(id), body })),
    deactivate: (id: number, body: VehicleDeactivateRequest) =>
      settle(client().POST('/vehicles/{id}/deactivate', { ...path(id), body })),
  };
}

export type VehiclesApi = ReturnType<typeof vehiclesApi>;
