import type { ChassisDefinition, UnitKind } from '@bmi/shared';
import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type {
  VehicleActivity,
  VehicleActivityGateway,
  VehicleGateway,
  VehicleGateways,
  VehicleRow,
} from '../../ports/vehicles.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { updateWithVersion } from './optimistic-lock.js';
import { chassisLayouts, vehicleClasses, vehicles } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';
import { DrizzleVehicleClassGateway } from './vehicle-class-gateways.js';

export class DrizzleVehicleGateway implements VehicleGateway {
  constructor(private readonly tx: DbTransaction) {}

  list(): Promise<VehicleRow[]> {
    return this.select(isNull(vehicles.deletedAt));
  }

  async findById(id: number, options: { forUpdate?: boolean } = {}): Promise<VehicleRow | null> {
    if (options.forUpdate) {
      await this.tx
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.id, id))
        .for('update');
    }
    const [row] = await this.select(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)));
    return row ?? null;
  }

  plateTaken(plate: string, exceptId?: number): Promise<boolean> {
    return this.taken(sql`lower(${vehicles.licensePlate}) = ${plate.toLowerCase()}`, exceptId);
  }

  vinTaken(vin: string, exceptId?: number): Promise<boolean> {
    return this.taken(sql`lower(${vehicles.vin}) = ${vin.toLowerCase()}`, exceptId);
  }

  async insert(vehicle: Parameters<VehicleGateway['insert']>[0]): Promise<number> {
    const [row] = await this.tx.insert(vehicles).values(vehicle).returning({ id: vehicles.id });
    if (!row) throw new Error('vehicles insert returned no row');
    return row.id;
  }

  update(id: number, version: number, values: Parameters<VehicleGateway['update']>[2]) {
    return updateWithVersion(this.tx, vehicles, id, version, values);
  }

  private async taken(condition: SQL, exceptId?: number): Promise<boolean> {
    const [row] = await this.tx
      .select({ id: vehicles.id })
      .from(vehicles)
      .where(
        and(
          condition,
          isNull(vehicles.deletedAt),
          exceptId === undefined ? undefined : ne(vehicles.id, exceptId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  private async select(condition: SQL | undefined): Promise<VehicleRow[]> {
    const rows = await this.tx
      .select({
        id: vehicles.id,
        licensePlate: vehicles.licensePlate,
        vin: vehicles.vin,
        engineNumber: vehicles.engineNumber,
        brand: vehicles.brand,
        model: vehicles.model,
        year: vehicles.year,
        fuelType: vehicles.fuelType,
        classId: vehicleClasses.id,
        className: vehicleClasses.name,
        unitKind: vehicleClasses.unitKind,
        layoutId: chassisLayouts.id,
        layoutCode: chassisLayouts.code,
        layoutName: chassisLayouts.name,
        layoutVersion: chassisLayouts.version,
        definition: chassisLayouts.definition,
        axleCount: chassisLayouts.axleCount,
        tyreCount: chassisLayouts.tyreCount,
        currentOdometer: vehicles.currentOdometer,
        status: vehicles.status,
        deactivateReason: vehicles.deactivateReason,
        version: vehicles.version,
      })
      .from(vehicles)
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .innerJoin(chassisLayouts, eq(chassisLayouts.id, vehicles.chassisLayoutId))
      .where(condition)
      .orderBy(asc(vehicles.licensePlate), asc(vehicles.id));
    return rows.map((row) => ({
      id: row.id,
      licensePlate: row.licensePlate,
      vin: row.vin,
      engineNumber: row.engineNumber,
      brand: row.brand,
      model: row.model,
      year: row.year,
      fuelType: row.fuelType,
      vehicleClass: { id: row.classId, name: row.className, unitKind: row.unitKind as UnitKind },
      layout: {
        id: row.layoutId,
        code: row.layoutCode,
        name: row.layoutName,
        version: row.layoutVersion,
        definition: row.definition as ChassisDefinition,
        axleCount: row.axleCount,
        tyreCount: row.tyreCount,
      },
      currentOdometer: row.currentOdometer,
      status: row.status,
      deactivateReason: row.deactivateReason,
      version: row.version,
    }));
  }
}

export const vehicleGateways = (tx: DbTransaction): VehicleGateways => ({
  vehicles: new DrizzleVehicleGateway(tx),
  vehicleClasses: new DrizzleVehicleClassGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});

/**
 * DEC-122: no tyre can be mounted (TASK-501) and no SPK opened (TASK-120) yet, so nothing blocks a
 * class change or a deactivation. Those tasks replace this adapter.
 */
export class NoVehicleActivityYet implements VehicleActivityGateway {
  of(vehicleIds: readonly number[]): Promise<Map<number, VehicleActivity>> {
    return Promise.resolve(
      new Map(vehicleIds.map((id) => [id, { mountedTyres: 0, openSpks: [] }])),
    );
  }
}
