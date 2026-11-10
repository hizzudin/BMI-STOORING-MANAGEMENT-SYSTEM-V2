import type { ApiClient } from '@bmi/api-client';
import type { ChassisDefinition, VehicleClassRequest } from '@bmi/shared';
import { browserApi, settle } from './auth-api';

/** Vehicle classes and chassis layouts (REQ-PLC-013, DEC-120) through the generated client. */
export function vehicleClassesApi(given?: ApiClient) {
  let made: ApiClient | undefined = given;
  const client = () => (made ??= browserApi());
  return {
    list: () => settle(client().GET('/vehicle-classes')),
    create: (body: VehicleClassRequest) => settle(client().POST('/vehicle-classes', { body })),
    newLayoutVersion: (id: number, definition: ChassisDefinition) =>
      settle(
        client().POST('/vehicle-classes/{id}/layouts', {
          params: { path: { id: String(id) } },
          body: { definition },
        }),
      ),
  };
}

export type VehicleClassesApi = ReturnType<typeof vehicleClassesApi>;
