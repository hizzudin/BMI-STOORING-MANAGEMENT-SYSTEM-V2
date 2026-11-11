import type { VehicleRequest, VehicleStatus } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';
import type { LayoutRow, VehicleClassRow } from './vehicle-classes.js';

/** §9.3 vehicles with its class and the layout version it uses. */
export interface VehicleRow {
  id: number;
  licensePlate: string;
  vin: string | null;
  engineNumber: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  fuelType: string | null;
  vehicleClass: Pick<VehicleClassRow, 'id' | 'name' | 'unitKind'>;
  layout: LayoutRow;
  currentOdometer: number;
  status: VehicleStatus;
  deactivateReason: string | null;
  version: number;
}

/** The typed fields of a vehicle (REQ-VEH-002); the class decides the layout. */
export type VehicleFields = Omit<VehicleRequest, 'vehicleClassId' | 'odometer'>;

export interface VehicleGateway {
  /** Not soft-deleted, by plate. */
  list(): Promise<VehicleRow[]>;
  /** `forUpdate` holds the vehicle until the transaction ends. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<VehicleRow | null>;
  /** TX-18, case-insensitive among vehicles that are not soft-deleted; `exceptId` skips this one. */
  plateTaken(plate: string, exceptId?: number): Promise<boolean>;
  vinTaken(vin: string, exceptId?: number): Promise<boolean>;
  insert(
    vehicle: VehicleFields & {
      vehicleClassId: number;
      chassisLayoutId: number;
      currentOdometer: number;
    },
  ): Promise<number>;
  /** NFR-03: refused with ConcurrentUpdateError when `version` is no longer current. */
  update(
    id: number,
    version: number,
    values: Partial<VehicleFields> & {
      vehicleClassId?: number;
      chassisLayoutId?: number;
      currentOdometer?: number;
      status?: VehicleStatus;
      deactivateReason?: string;
      deactivatedAt?: Date;
    },
  ): Promise<void>;
}

export interface VehicleGateways {
  vehicles: VehicleGateway;
  /** The active classes with their default layout: the form offers them. */
  vehicleClasses: { list(): Promise<VehicleClassRow[]> };
  audit: AuditGateway;
}

/** What blocks a class change (REQ-VEH-003, DEC-17) or a deactivation (REQ-VEH-004). */
export interface VehicleActivity {
  mountedTyres: number;
  /** SPK numbers that are not Closed or Cancelled. */
  openSpks: string[];
}

/**
 * DEC-122: tyre mounting (TASK-501) and SPKs (TASK-120) answer this port when they are built;
 * until then the adapter answers that nothing is mounted and nothing is open.
 */
export interface VehicleActivityGateway {
  /** One entry for every id asked. */
  of(vehicleIds: readonly number[]): Promise<Map<number, VehicleActivity>>;
}
