import type { Role } from '@bmi/shared';
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  AuditLogGateway,
  AuditLogGateways,
  AuditLogRow,
  AuditLogRowFilter,
  ExportLogEntry,
  ExportLogGateway,
} from '../../ports/audit-log.js';
import {
  auditLogs,
  documentTypes,
  exportLogs,
  spks,
  users,
  vehicleClasses,
  vehicles,
  vendors,
} from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

/** The account an audit record is about, apart from the account that acted. */
const subject = alias(users, 'subject');

/** Audit records with who acted and the own name of the record each one is about. */
function selectRows(tx: DbTransaction, condition: SQL | undefined) {
  const of = (entity: string) => eq(auditLogs.entity, entity);
  return tx
    .select({
      id: auditLogs.id,
      at: auditLogs.at,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      action: auditLogs.action,
      before: auditLogs.before,
      after: auditLogs.after,
      reason: auditLogs.reason,
      selfDecision: auditLogs.selfDecision,
      userId: users.id,
      userName: users.name,
      userRole: auditLogs.userRole,
      recordName: sql<
        string | null
      >`coalesce(${spks.spkNumber}, ${vehicles.licensePlate}, ${subject.name}, ${vehicleClasses.code}, ${documentTypes.code}, ${vendors.code})`,
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.userId))
    .leftJoin(spks, and(of('spk'), eq(spks.id, auditLogs.entityId)))
    .leftJoin(vehicles, and(of('vehicle'), eq(vehicles.id, auditLogs.entityId)))
    .leftJoin(subject, and(of('user'), eq(subject.id, auditLogs.entityId)))
    .leftJoin(vehicleClasses, and(of('vehicle_class'), eq(vehicleClasses.id, auditLogs.entityId)))
    .leftJoin(documentTypes, and(of('document_type'), eq(documentTypes.id, auditLogs.entityId)))
    .leftJoin(vendors, and(of('vendor'), eq(vendors.id, auditLogs.entityId)))
    .where(condition);
}

type SelectedRow = Awaited<ReturnType<typeof selectRows>>[number];

function toRow(row: SelectedRow): AuditLogRow {
  return {
    id: row.id,
    at: row.at,
    entity: row.entity,
    entityId: row.entityId,
    action: row.action,
    before: row.before,
    after: row.after,
    reason: row.reason,
    selfDecision: row.selfDecision,
    user:
      row.userId === null
        ? null
        : { id: row.userId, name: row.userName ?? '', role: (row.userRole as Role | null) ?? null },
    recordName: row.recordName,
  };
}

function conditionOf(filter: AuditLogRowFilter): SQL | undefined {
  return and(
    filter.userId !== undefined ? eq(auditLogs.userId, filter.userId) : undefined,
    filter.entities ? inArray(auditLogs.entity, [...filter.entities]) : undefined,
    filter.from ? gte(auditLogs.at, filter.from) : undefined,
    filter.to ? lt(auditLogs.at, filter.to) : undefined,
  );
}

export class DrizzleAuditLogGateway implements AuditLogGateway {
  constructor(private readonly tx: DbTransaction) {}

  async page(
    filter: AuditLogRowFilter,
    window: { offset: number; limit: number },
  ): Promise<AuditLogRow[]> {
    const rows = await selectRows(this.tx, conditionOf(filter))
      .orderBy(desc(auditLogs.at), desc(auditLogs.id))
      .offset(window.offset)
      .limit(window.limit);
    return rows.map(toRow);
  }

  async count(filter: AuditLogRowFilter): Promise<number> {
    const [row] = await this.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(conditionOf(filter));
    return row?.count ?? 0;
  }

  async one(id: number): Promise<AuditLogRow | null> {
    const [row] = await selectRows(this.tx, eq(auditLogs.id, id));
    return row ? toRow(row) : null;
  }

  users(): Promise<{ id: number; name: string }[]> {
    return this.tx
      .selectDistinct({ id: users.id, name: users.name })
      .from(auditLogs)
      .innerJoin(users, eq(users.id, auditLogs.userId))
      .orderBy(asc(users.name), asc(users.id));
  }

  async userNames(ids: readonly number[]): Promise<Map<number, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.tx
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, [...ids]));
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}

export class DrizzleExportLogGateway implements ExportLogGateway {
  constructor(private readonly tx: DbTransaction) {}

  async write(entry: ExportLogEntry): Promise<void> {
    await this.tx.insert(exportLogs).values(entry);
  }
}

export const auditLogGateways = (tx: DbTransaction): AuditLogGateways => ({
  auditLog: new DrizzleAuditLogGateway(tx),
  exportLogs: new DrizzleExportLogGateway(tx),
});
