import {
  formatDocumentNumber,
  NumberingConfigSchema,
  OPEN_SPK_STATUSES,
  type ApprovalAction,
  type ApprovalStage,
  type AsgStatus,
  type Role,
  type SpkCategory,
  type SpkSource,
  type SpkStatus,
  type UnitKind,
  type VehicleStatus,
} from '@bmi/shared';
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  NumberingConfigError,
  type DocumentNumberGateway,
  type NumberedKind,
} from '../../ports/numbering.js';
import type {
  NewSpk,
  PersonRow,
  SpkApprovalRow,
  SpkDetailRow,
  SpkFields,
  SpkGateway,
  SpkGateways,
  SpkListFilter,
  SpkListRow,
  SpkRow,
  SpkStepRow,
  SpkVehicleRow,
} from '../../ports/spks.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import { DrizzleNotificationGateway } from './notification-gateways.js';
import { updateWithVersion } from './optimistic-lock.js';
import { DrizzlePlannerApprovalGateway } from './planner-approval-gateways.js';
import {
  appSettings,
  assignmentModules,
  spkApprovals,
  spkAssignments,
  spks,
  userRoles,
  users,
  vehicleClasses,
  vehicles,
} from './schema/index.js';
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

/** REQ-SPK-015: Urgent, then High, Normal and Low. */
const URGENCY_ORDER = sql`CASE ${spks.priority} WHEN 'Urgent' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END`;
/** A step that is done is no longer the current step. */
const DONE_STEPS: readonly AsgStatus[] = ['Verified', 'Skipped'];
export const UNKNOWN_PERSON: PersonRow = { name: 'Unknown', role: null };

/** The SpkRow part of a header row. */
export function toSpkRow(row: {
  id: number;
  spkNumber: string;
  vehicleId: number;
  licensePlate: string;
  className: string;
  title: string;
  category: string;
  requiresDowntime: boolean;
  requestSource: string;
  priority: string;
  description: string;
  status: string;
  createdBy: number;
  stepCount: number;
  version: number;
}): SpkRow {
  return {
    id: row.id,
    spkNumber: row.spkNumber,
    vehicleId: row.vehicleId,
    vehicle: { id: row.vehicleId, licensePlate: row.licensePlate, className: row.className },
    title: row.title,
    category: row.category as SpkCategory,
    requiresDowntime: row.requiresDowntime,
    requestSource: row.requestSource as SpkSource,
    priority: row.priority,
    description: row.description,
    status: row.status as SpkStatus,
    createdBy: row.createdBy,
    stepCount: row.stepCount,
    version: row.version,
  };
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
    const [row] = await this.headers(and(eq(spks.id, id), isNull(spks.deletedAt)));
    return row ? toSpkRow(row) : null;
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
      selfApproved: row.selfApproved ?? false,
      ...(row.actedAt ? { actedAt: row.actedAt } : {}),
    });
  }

  async openFirstStep(spkId: number, at: Date): Promise<void> {
    await this.db
      .update(spkAssignments)
      .set({
        status: sql`CASE WHEN ${spkAssignments.sequenceNo} = 1 THEN 'Open' ELSE 'Locked' END::asg_status_t`,
        openedAt: sql`CASE WHEN ${spkAssignments.sequenceNo} = 1 THEN ${at.toISOString()}::timestamptz END`,
      })
      .where(eq(spkAssignments.spkId, spkId));
  }

  cancel(id: number, version: number, cancelled: { reason: string; by: number }): Promise<void> {
    return updateWithVersion(this.db, spks, id, version, {
      status: 'Cancelled',
      cancelReason: cancelled.reason,
      cancelledBy: cancelled.by,
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

  async listPage(
    filter: SpkListFilter,
    page: { offset: number; limit: number },
  ): Promise<SpkListRow[]> {
    const rows = await this.headers(this.listCondition(filter))
      .orderBy(URGENCY_ORDER, desc(spks.createdAt), desc(spks.id))
      .limit(page.limit)
      .offset(page.offset);
    const steps = await this.stepsOf(rows.map((row) => row.id));
    const creators = await this.people(rows.map((row) => row.createdBy));
    return rows.map((row) => ({
      ...toSpkRow(row),
      creator: creators.get(row.createdBy) ?? UNKNOWN_PERSON,
      currentStep:
        (steps.get(row.id) ?? []).find((step) => !DONE_STEPS.includes(step.status)) ?? null,
    }));
  }

  async countMatching(filter: SpkListFilter): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .where(this.listCondition(filter));
    return row?.count ?? 0;
  }

  vehiclesWithSpks(): Promise<{ id: number; licensePlate: string }[]> {
    return this.db
      .selectDistinct({ id: vehicles.id, licensePlate: vehicles.licensePlate })
      .from(vehicles)
      .innerJoin(spks, eq(spks.vehicleId, vehicles.id))
      .where(isNull(spks.deletedAt))
      .orderBy(asc(vehicles.licensePlate), asc(vehicles.id));
  }

  async detail(id: number): Promise<SpkDetailRow | null> {
    const [row] = await this.headers(and(eq(spks.id, id), isNull(spks.deletedAt)));
    if (!row) return null;
    const steps = await this.stepsOf([id]);
    const approvalRows = await this.db
      .select({
        stage: spkApprovals.stage,
        action: spkApprovals.action,
        actedBy: spkApprovals.actedBy,
        approverRole: spkApprovals.approverRole,
        actedAt: spkApprovals.actedAt,
        note: spkApprovals.note,
        selfApproved: spkApprovals.selfApproved,
      })
      .from(spkApprovals)
      .where(eq(spkApprovals.spkId, id))
      .orderBy(asc(spkApprovals.actedAt), asc(spkApprovals.id));
    const people = await this.people([row.createdBy, ...approvalRows.map((a) => a.actedBy)]);
    const approvals: SpkApprovalRow[] = approvalRows.map((approval) => ({
      stage: approval.stage as ApprovalStage,
      action: approval.action as ApprovalAction,
      // The role the decision was taken in, as the approval stamp shows it.
      by: {
        name: people.get(approval.actedBy)?.name ?? UNKNOWN_PERSON.name,
        role: approval.approverRole as Role,
      },
      actedAt: approval.actedAt,
      note: approval.note,
      selfApproved: approval.selfApproved,
    }));
    return {
      ...toSpkRow(row),
      vehicleUnitKind: row.unitKind as UnitKind,
      vehicleOdometer: row.currentOdometer,
      creator: people.get(row.createdBy) ?? UNKNOWN_PERSON,
      steps: steps.get(id) ?? [],
      approvals,
      costs: {
        labor: row.laborCost,
        parts: row.partsCost,
        document: row.documentCost,
        stooring: row.stooringCost,
      },
    };
  }

  /** The header columns of SPKList and SPKDetail, with the vehicle and its class. */
  /** Also read by the approval gateway (not part of the port). */
  headers(condition: SQL | undefined) {
    return this.db
      .select({
        id: spks.id,
        spkNumber: spks.spkNumber,
        vehicleId: spks.vehicleId,
        licensePlate: vehicles.licensePlate,
        className: vehicleClasses.name,
        unitKind: vehicleClasses.unitKind,
        currentOdometer: vehicles.currentOdometer,
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
        laborCost: spks.laborCost,
        partsCost: spks.partsCost,
        documentCost: spks.documentCost,
        stooringCost: spks.stooringCost,
        version: spks.version,
      })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(condition)
      .$dynamic();
  }

  /** REQ-SPK-010: the tab, My steps, search, type and vehicle, among SPKs not soft-deleted. */
  private listCondition(filter: SpkListFilter): SQL | undefined {
    const conditions: (SQL | undefined)[] = [isNull(spks.deletedAt)];
    if (filter.statuses) conditions.push(inArray(spks.status, [...filter.statuses]));
    if (filter.category) conditions.push(eq(spks.category, filter.category));
    if (filter.vehicleId !== undefined) conditions.push(eq(spks.vehicleId, filter.vehicleId));
    if (filter.search) {
      const pattern = `%${filter.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      conditions.push(
        or(
          ilike(spks.spkNumber, pattern),
          ilike(spks.title, pattern),
          ilike(vehicles.licensePlate, pattern),
        ),
      );
    }
    if (filter.mineOf) {
      const { userId, roles } = filter.mineOf;
      conditions.push(
        exists(
          this.db
            .select({ one: sql`1` })
            .from(spkAssignments)
            .where(
              and(
                eq(spkAssignments.spkId, spks.id),
                inArray(spkAssignments.status, ['Open', 'In_Progress']),
                or(
                  eq(spkAssignments.assignedTo, userId),
                  roles.length === 0
                    ? undefined
                    : and(
                        isNull(spkAssignments.assignedTo),
                        arrayOverlaps(spkAssignments.executorRoles, [...roles]),
                      ),
                ),
              ),
            ),
        ),
      );
    }
    return and(...conditions);
  }

  /** The steps of these SPKs in order, with their module name and the people on them. */
  async stepsOf(spkIds: readonly number[]): Promise<Map<number, SpkStepRow[]>> {
    const bySpk = new Map<number, SpkStepRow[]>();
    if (spkIds.length === 0) return bySpk;
    const rows = await this.db
      .select({
        id: spkAssignments.id,
        spkId: spkAssignments.spkId,
        sequenceNo: spkAssignments.sequenceNo,
        name: assignmentModules.name,
        status: spkAssignments.status,
        executorRoles: spkAssignments.executorRoles,
        verifierRole: spkAssignments.verifierRole,
        assignedTo: spkAssignments.assignedTo,
        openedAt: spkAssignments.openedAt,
        submittedAt: spkAssignments.submittedAt,
        verifiedAt: spkAssignments.verifiedAt,
        verifiedBy: spkAssignments.verifiedBy,
      })
      .from(spkAssignments)
      .innerJoin(assignmentModules, eq(assignmentModules.code, spkAssignments.module))
      .where(inArray(spkAssignments.spkId, [...spkIds]))
      .orderBy(asc(spkAssignments.spkId), asc(spkAssignments.sequenceNo));
    const people = await this.people(
      rows.flatMap((row) => [row.assignedTo, row.verifiedBy]).filter((id) => id !== null),
    );
    for (const row of rows) {
      const step: SpkStepRow = {
        id: row.id,
        sequenceNo: row.sequenceNo,
        name: row.name,
        status: row.status as AsgStatus,
        executorRoles: row.executorRoles as Role[],
        verifierRole: row.verifierRole as Role,
        assignee: row.assignedTo === null ? null : (people.get(row.assignedTo) ?? null),
        openedAt: row.openedAt,
        submittedAt: row.submittedAt,
        verifiedAt: row.verifiedAt,
        verifiedBy: row.verifiedBy === null ? null : (people.get(row.verifiedBy) ?? null),
      };
      bySpk.set(row.spkId, [...(bySpk.get(row.spkId) ?? []), step]);
    }
    return bySpk;
  }

  /** Names and roles of these users (RL-1: one role each). */
  async people(userIds: readonly number[]): Promise<Map<number, PersonRow>> {
    const unique = [...new Set(userIds)];
    if (unique.length === 0) return new Map();
    const rows = await this.db
      .select({ id: users.id, name: users.name, role: userRoles.role })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, { name: row.name, role: row.role as Role | null }]));
  }
}

export const spkGateways = (tx: DbTransaction): SpkGateways => ({
  spks: new DrizzleSpkGateway(tx),
  numbers: new DrizzleDocumentNumbers(tx),
  audit: new DrizzleAuditGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
  plannerApproval: new DrizzlePlannerApprovalGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
