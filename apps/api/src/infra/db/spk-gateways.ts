import {
  formatDocumentNumber,
  NumberingConfigSchema,
  OPEN_SPK_STATUSES,
  type SpkCategory,
  type SpkSource,
  type SpkStatus,
  type VehicleStatus,
} from '@bmi/shared';
import { and, asc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  NumberingConfigError,
  type DocumentNumberGateway,
  type NumberedKind,
} from '../../ports/numbering.js';
import type {
  NewSpk,
  SpkFields,
  SpkGateway,
  SpkGateways,
  SpkRow,
  SpkVehicleRow,
} from '../../ports/spks.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleNotificationGateway } from './notification-gateways.js';
import { updateWithVersion } from './optimistic-lock.js';
import { DrizzlePlannerApprovalGateway } from './planner-approval-gateways.js';
import { appSettings, spkApprovals, spks, vehicleClasses, vehicles } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

type Db = NodePgDatabase | DbTransaction;

/** NFR-15, DEC-111: each code has its own sequence (§9); a later code adds its line here. */
const SEQUENCES: Record<NumberedKind, string> = { SPK: 'spk_number_seq' };

/** Numbers from the stored formats and the code's sequence, inside the caller's transaction. */
export class DrizzleDocumentNumbers implements DocumentNumberGateway {
  constructor(private readonly db: Db) {}

  async next(kind: NumberedKind, createdAt: Date): Promise<string> {
    const [setting] = await this.db
      .select({ value: appSettings.settingValue })
      .from(appSettings)
      .where(eq(appSettings.settingKey, 'numbering_formats'));
    if (!setting) throw new NumberingConfigError('the setting numbering_formats is missing');
    const config = NumberingConfigSchema.safeParse(setting.value);
    if (!config.success) {
      throw new NumberingConfigError(config.error.issues[0]?.message ?? 'invalid formats');
    }
    const { rows } = await this.db.execute<{ value: string }>(
      sql`SELECT nextval(${SEQUENCES[kind]}::regclass)::text AS value`,
    );
    const value = rows[0]?.value;
    if (!value) throw new Error(`${SEQUENCES[kind]} returned no value`);
    return formatDocumentNumber(kind, BigInt(value), createdAt, config.data);
  }
}

export class DrizzleSpkGateway implements SpkGateway {
  constructor(private readonly db: Db) {}

  async insert(spk: NewSpk & { spkNumber: string }): Promise<number> {
    const [row] = await this.db
      .insert(spks)
      .values({
        spkNumber: spk.spkNumber,
        vehicleId: spk.vehicleId,
        title: spk.title,
        category: spk.category,
        requestSource: spk.requestSource,
        description: spk.description,
        createdBy: spk.createdBy,
        ...(spk.requiresDowntime === undefined ? {} : { requiresDowntime: spk.requiresDowntime }),
        ...(spk.priority === undefined ? {} : { priority: spk.priority }),
        presetId: spk.presetId ?? null,
        breakdownReportId: spk.breakdownReportId ?? null,
        findingNote: spk.findingNote ?? null,
      })
      .returning({ id: spks.id });
    if (!row) throw new Error('spks insert returned no row');
    return row.id;
  }

  async findById(id: number, options: { forUpdate?: boolean } = {}): Promise<SpkRow | null> {
    if (options.forUpdate) {
      await this.db.select({ id: spks.id }).from(spks).where(eq(spks.id, id)).for('update');
    }
    const [row] = await this.db
      .select({
        id: spks.id,
        spkNumber: spks.spkNumber,
        vehicleId: spks.vehicleId,
        licensePlate: vehicles.licensePlate,
        className: vehicleClasses.name,
        title: spks.title,
        category: spks.category,
        requiresDowntime: spks.requiresDowntime,
        requestSource: spks.requestSource,
        priority: spks.priority,
        description: spks.description,
        status: spks.status,
        createdBy: spks.createdBy,
        // Written out in full: a subquery inside this select would leave its columns unqualified.
        stepCount: sql<number>`(SELECT count(*)::int FROM spk_assignments a WHERE a.spk_id = spks.id)`,
        version: spks.version,
      })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(and(eq(spks.id, id), isNull(spks.deletedAt)));
    if (!row) return null;
    const { licensePlate, className, ...rest } = row;
    return {
      ...rest,
      vehicle: { id: row.vehicleId, licensePlate, className },
      category: row.category as SpkCategory,
      requestSource: row.requestSource as SpkSource,
      status: row.status as SpkStatus,
    };
  }

  update(id: number, version: number, fields: SpkFields): Promise<void> {
    return updateWithVersion(this.db, spks, id, version, fields);
  }

  setStatus(id: number, version: number, status: SpkStatus): Promise<void> {
    return updateWithVersion(this.db, spks, id, version, { status });
  }

  async insertApproval(row: Parameters<SpkGateway['insertApproval']>[0]): Promise<void> {
    await this.db.insert(spkApprovals).values({
      spkId: row.spkId,
      stage: row.stage,
      action: row.action,
      actedBy: row.actedBy,
      approverRole: row.approverRole,
      note: row.note ?? null,
    });
  }

  async vehicle(id: number): Promise<SpkVehicleRow | null> {
    const [row] = await this.vehicleRows(and(eq(vehicles.id, id), isNull(vehicles.deletedAt)));
    return row ?? null;
  }

  vehiclesForNewSpk(): Promise<SpkVehicleRow[]> {
    return this.vehicleRows(and(ne(vehicles.status, 'Inactive'), isNull(vehicles.deletedAt)));
  }

  private async vehicleRows(condition: SQL | undefined): Promise<SpkVehicleRow[]> {
    const rows = await this.db
      .select({
        id: vehicles.id,
        licensePlate: vehicles.licensePlate,
        className: vehicleClasses.name,
        status: vehicles.status,
      })
      .from(vehicles)
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(condition)
      .orderBy(asc(vehicles.licensePlate), asc(vehicles.id));
    return rows.map((row) => ({ ...row, status: row.status as VehicleStatus }));
  }

  async openNumbersByVehicle(vehicleIds: readonly number[]): Promise<Map<number, string[]>> {
    const open = new Map<number, string[]>();
    if (vehicleIds.length === 0) return open;
    const rows = await this.db
      .select({ vehicleId: spks.vehicleId, spkNumber: spks.spkNumber })
      .from(spks)
      .where(
        and(
          inArray(spks.vehicleId, [...vehicleIds]),
          inArray(spks.status, [...OPEN_SPK_STATUSES]),
          isNull(spks.deletedAt),
        ),
      )
      .orderBy(asc(spks.id));
    for (const row of rows) {
      open.set(row.vehicleId, [...(open.get(row.vehicleId) ?? []), row.spkNumber]);
    }
    return open;
  }
}

export const spkGateways = (tx: DbTransaction): SpkGateways => ({
  spks: new DrizzleSpkGateway(tx),
  numbers: new DrizzleDocumentNumbers(tx),
  audit: new DrizzleAuditGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
  plannerApproval: new DrizzlePlannerApprovalGateway(tx),
});
