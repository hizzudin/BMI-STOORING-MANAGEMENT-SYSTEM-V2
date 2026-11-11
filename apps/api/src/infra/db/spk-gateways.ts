import {
  formatDocumentNumber,
  NumberingConfigSchema,
  OPEN_SPK_STATUSES,
  type SpkCategory,
  type SpkSource,
  type SpkStatus,
} from '@bmi/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  NumberingConfigError,
  type DocumentNumberGateway,
  type NumberedKind,
} from '../../ports/numbering.js';
import type { NewSpk, SpkGateway, SpkGateways, SpkRow } from '../../ports/spks.js';
import { appSettings, spks } from './schema/index.js';
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

  async findById(id: number): Promise<SpkRow | null> {
    const [row] = await this.db
      .select({
        id: spks.id,
        spkNumber: spks.spkNumber,
        vehicleId: spks.vehicleId,
        title: spks.title,
        category: spks.category,
        requiresDowntime: spks.requiresDowntime,
        requestSource: spks.requestSource,
        priority: spks.priority,
        description: spks.description,
        status: spks.status,
        createdBy: spks.createdBy,
        version: spks.version,
      })
      .from(spks)
      .where(and(eq(spks.id, id), isNull(spks.deletedAt)));
    if (!row) return null;
    return {
      ...row,
      category: row.category as SpkCategory,
      requestSource: row.requestSource as SpkSource,
      status: row.status as SpkStatus,
    };
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
});
