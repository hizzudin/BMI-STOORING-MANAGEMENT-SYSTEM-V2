import type { ChassisDefinition, GeneratedPosition, UnitKind } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';

/** §9.3 chassis_layouts: one version of a layout. */
export interface LayoutRow {
  id: number;
  code: string;
  name: string;
  version: number;
  definition: ChassisDefinition;
  axleCount: number;
  tyreCount: number;
}

/** §9.3 vehicle_classes with its default layout version. */
export interface VehicleClassRow {
  id: number;
  code: string;
  name: string;
  unitKind: UnitKind;
  /** DEC-120: with the count of vehicles that use this version. */
  layout: LayoutRow & { vehicleCount: number };
}

export interface VehicleClassGateway {
  list(): Promise<VehicleClassRow[]>;
  /** `forUpdate` holds the class until the transaction ends, so two new versions do not collide. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<VehicleClassRow | null>;
  /** Case-insensitive, so Wingbox_Rigid and wingbox_rigid are one code. */
  codeTaken(code: string): Promise<boolean>;
  latestVersion(layoutCode: string): Promise<number>;
  insertLayout(layout: Omit<LayoutRow, 'id'>): Promise<number>;
  insertPositions(layoutId: number, positions: readonly GeneratedPosition[]): Promise<void>;
  insertClass(vehicleClass: {
    code: string;
    name: string;
    unitKind: UnitKind;
    layoutId: number;
  }): Promise<number>;
  setDefaultLayout(classId: number, layoutId: number): Promise<void>;
}

export interface VehicleClassGateways {
  vehicleClasses: VehicleClassGateway;
  audit: AuditGateway;
}
