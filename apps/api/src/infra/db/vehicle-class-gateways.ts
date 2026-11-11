import type { ChassisDefinition, GeneratedPosition, UnitKind } from '@bmi/shared';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type {
  LayoutRow,
  VehicleClassGateway,
  VehicleClassGateways,
  VehicleClassRow,
} from '../../ports/vehicle-classes.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { chassisLayouts, partPositions, vehicleClasses } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleVehicleClassGateway implements VehicleClassGateway {
  constructor(private readonly tx: DbTransaction) {}

  list(): Promise<VehicleClassRow[]> {
    return this.select();
  }

  async findById(
    id: number,
    options: { forUpdate?: boolean } = {},
  ): Promise<VehicleClassRow | null> {
    if (options.forUpdate) {
      await this.tx
        .select({ id: vehicleClasses.id })
        .from(vehicleClasses)
        .where(eq(vehicleClasses.id, id))
        .for('update');
    }
    const [row] = await this.select(eq(vehicleClasses.id, id));
    return row ?? null;
  }

  async codeTaken(code: string): Promise<boolean> {
    const [row] = await this.tx
      .select({ id: vehicleClasses.id })
      .from(vehicleClasses)
      .where(sql`lower(${vehicleClasses.code}) = ${code.toLowerCase()}`)
      .limit(1);
    return row !== undefined;
  }

  async latestVersion(layoutCode: string): Promise<number> {
    const [row] = await this.tx
      .select({ version: sql<number>`coalesce(max(${chassisLayouts.version}), 0)::int` })
      .from(chassisLayouts)
      .where(eq(chassisLayouts.code, layoutCode));
    return row?.version ?? 0;
  }

  async insertLayout(layout: Omit<LayoutRow, 'id'>): Promise<number> {
    const [row] = await this.tx
      .insert(chassisLayouts)
      .values(layout)
      .returning({ id: chassisLayouts.id });
    if (!row) throw new Error('chassis_layouts insert returned no row');
    return row.id;
  }

  async insertPositions(layoutId: number, positions: readonly GeneratedPosition[]): Promise<void> {
    if (positions.length === 0) return;
    await this.tx
      .insert(partPositions)
      .values(positions.map((position) => ({ chassisLayoutId: layoutId, ...position })));
  }

  async insertClass(vehicleClass: {
    code: string;
    name: string;
    unitKind: UnitKind;
    layoutId: number;
  }): Promise<number> {
    const [row] = await this.tx
      .insert(vehicleClasses)
      .values({
        code: vehicleClass.code,
        name: vehicleClass.name,
        unitKind: vehicleClass.unitKind,
        defaultChassisLayoutId: vehicleClass.layoutId,
      })
      .returning({ id: vehicleClasses.id });
    if (!row) throw new Error('vehicle_classes insert returned no row');
    return row.id;
  }

  async setDefaultLayout(classId: number, layoutId: number): Promise<void> {
    await this.tx
      .update(vehicleClasses)
      .set({ defaultChassisLayoutId: layoutId, updatedAt: sql`now()` })
      .where(eq(vehicleClasses.id, classId));
  }

  private async select(condition?: SQL): Promise<VehicleClassRow[]> {
    const rows = await this.tx
      .select({
        id: vehicleClasses.id,
        code: vehicleClasses.code,
        name: vehicleClasses.name,
        unitKind: vehicleClasses.unitKind,
        layoutId: chassisLayouts.id,
        layoutCode: chassisLayouts.code,
        layoutName: chassisLayouts.name,
        version: chassisLayouts.version,
        definition: chassisLayouts.definition,
        axleCount: chassisLayouts.axleCount,
        tyreCount: chassisLayouts.tyreCount,
        vehicleCount: sql<number>`(SELECT count(*)::int FROM vehicles v WHERE v.chassis_layout_id = chassis_layouts.id AND v.deleted_at IS NULL)`,
      })
      .from(vehicleClasses)
      .innerJoin(chassisLayouts, eq(chassisLayouts.id, vehicleClasses.defaultChassisLayoutId))
      .where(condition)
      .orderBy(asc(vehicleClasses.name), asc(vehicleClasses.id));
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      unitKind: row.unitKind as UnitKind,
      layout: {
        id: row.layoutId,
        code: row.layoutCode,
        name: row.layoutName,
        version: row.version,
        definition: row.definition as ChassisDefinition,
        axleCount: row.axleCount,
        tyreCount: row.tyreCount,
        vehicleCount: row.vehicleCount,
      },
    }));
  }
}

export const vehicleClassGateways = (tx: DbTransaction): VehicleClassGateways => ({
  vehicleClasses: new DrizzleVehicleClassGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
