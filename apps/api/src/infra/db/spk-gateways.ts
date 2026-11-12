import {
  formatDocumentNumber,
  NumberingConfigSchema,
  OPEN_SPK_STATUSES,
  type SpkCategory,
  type SpkSource,
  type SpkStatus,
  type VehicleStatus,
  type SpkPriority,
  type Role,
} from "@bmi/shared";
import { and, asc, eq, inArray, isNull, ne, sql, type SQL, desc, ilike, or, isNotNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  NumberingConfigError,
  type DocumentNumberGateway,
  type NumberedKind,
} from "../../ports/numbering.js";
import type {
  NewSpk,
  SpkFields,
  SpkGateway,
  SpkGateways,
  SpkRow,
  SpkVehicleRow,
  SpkListItem,
  SpkTabCounts,
  SpkListResult,
  SpkAssignmentRow,
  SpkApprovalRow,
  SpkCostBreakdown,
  SpkHistoryEntry,
  SpkChangeRequestSummary,
  SpkPartLine,
  SpkServiceLine,
  SpkDetailRow,
} from "../../ports/spks.js";
import { DrizzleAuditGateway } from "./account-gateways.js";
import { DrizzleNotificationGateway } from "./notification-gateways.js";
import { updateWithVersion } from "./optimistic-lock.js";
import { DrizzlePlannerApprovalGateway } from "./planner-approval-gateways.js";
import {
  appSettings,
  spkApprovals,
  spks,
  spkAssignments,
  spkParts,
  spkAttachments,
  vehicleClasses,
  vehicles,
  users,
  assignmentModules,
} from "./schema/index.js";
import type { DbTransaction } from "./unit-of-work.js";

type Db = NodePgDatabase | DbTransaction;

const SEQUENCES: Record<NumberedKind, string> = { SPK: "spk_number_seq" };

export class DrizzleDocumentNumbers implements DocumentNumberGateway {
  constructor(private readonly db: Db) {}

  async next(kind: NumberedKind, createdAt: Date): Promise<string> {
    const [setting] = await this.db
      .select({ value: appSettings.settingValue })
      .from(appSettings)
      .where(eq(appSettings.settingKey, "numbering_formats"));
    if (!setting) throw new NumberingConfigError("the setting numbering_formats is missing");
    const config = NumberingConfigSchema.safeParse(setting.value);
    if (!config.success) {
      throw new NumberingConfigError(config.error.issues[0]?.message ?? "invalid formats");
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
    if (!row) throw new Error("spks insert returned no row");
    return row.id;
  }

  async findById(id: number, options: { forUpdate?: boolean } = {}): Promise<SpkRow | null> {
    if (options.forUpdate) {
      await this.db.select({ id: spks.id }).from(spks).where(eq(spks.id, id)).for("update");
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

  async insertApproval(row: Parameters<SpkGateway["insertApproval"]>[0]): Promise<void> {
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
    return this.vehicleRows(and(ne(vehicles.status, "Inactive"), isNull(vehicles.deletedAt)));
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

  async list(
    actorId: number,
    actorRole: Role,
    tab: string,
    search?: string,
    type?: string,
    vehicleId?: number,
  ): Promise<SpkListResult> {
    const conditions: SQL[] = [isNull(spks.deletedAt)];

    switch (tab) {
      case "active":
        conditions.push(inArray(spks.status, ["Active", "In_Progress", "Pending_Verification", "Pending_Amendment"]));
        break;
      case "mine":
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM spk_assignments sa
            WHERE sa.spk_id = spks.id
            AND (
              (sa.assigned_to = ${actorId} AND sa.status IN ("Open", "In_Progress"))
              OR (sa.assigned_to = ${actorId} AND sa.status = "Submitted" AND sa.verifier_role != "System_Admin")
            )
          )`
        );
        break;
      case "draft":
        conditions.push(eq(spks.status, "Draft"));
        break;
      case "pending":
        conditions.push(eq(spks.status, "Pending_Approval"));
        break;
      case "rejected":
        conditions.push(eq(spks.status, "Rejected"));
        break;
      case "completed":
        conditions.push(eq(spks.status, "Completed"));
        break;
      case "cancelled":
        conditions.push(eq(spks.status, "Cancelled"));
        break;
      case "all":
      default:
        break;
    }

    if (search) {
      conditions.push(
        or(
          ilike(spks.spkNumber, `%${search}%`),
          ilike(vehicles.licensePlate, `%${search}%`),
          ilike(spks.title, `%${search}%`),
        ) as SQL
      );
    }

    if (type) {
      conditions.push(eq(spks.category, type as SpkCategory));
    }

    if (vehicleId) {
      conditions.push(eq(spks.vehicleId, vehicleId));
    }

    const items = await this.db
      .select({
        id: spks.id,
        spkNumber: spks.spkNumber,
        vehicleId: spks.vehicleId,
        licensePlate: vehicles.licensePlate,
        className: vehicleClasses.name,
        category: spks.category,
        priority: spks.priority,
        status: spks.status,
        createdBy: spks.createdBy,
        stepCount: sql<number>`(SELECT count(*)::int FROM spk_assignments a WHERE a.spk_id = spks.id)`,
      })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(and(...conditions))
      .orderBy(desc(spks.createdAt))
      .limit(50);

    const listItems: SpkListItem[] = await Promise.all(
      items.map(async (item) => {
        const [currentAssignment] = await this.db
          .select({
            sequenceNo: spkAssignments.sequenceNo,
            module: spkAssignments.module,
            status: spkAssignments.status,
            assignedTo: spkAssignments.assignedTo,
            executedBy: spkAssignments.executedBy,
            verifierRole: spkAssignments.verifierRole,
            executorRoles: spkAssignments.executorRoles,
          })
          .from(spkAssignments)
          .where(eq(spkAssignments.spkId, item.id))
          .orderBy(asc(spkAssignments.sequenceNo))
          .limit(1);

        let currentStep = "";
        let waitingOn = "";
        const allowedActions: string[] = [];

        if (currentAssignment) {
          const moduleInfo = await this.db
            .select({ name: assignmentModules.name, uiComponent: assignmentModules.uiComponent })
            .from(assignmentModules)
            .where(eq(assignmentModules.code, currentAssignment.module))
            .limit(1);

          const moduleName = moduleInfo[0]?.name ?? currentAssignment.module;
          currentStep = `Step ${currentAssignment.sequenceNo} ${moduleName}`;

          if (currentAssignment.assignedTo) {
            const [assignee] = await this.db
              .select({ name: users.name })
              .from(users)
              .where(eq(users.id, currentAssignment.assignedTo))
              .limit(1);
            waitingOn = assignee?.name ?? "\u2014";
          } else if (currentAssignment.status === "Open") {
            waitingOn = currentAssignment.executorRoles[0] ?? "\u2014";
          } else if (currentAssignment.status === "Submitted") {
            waitingOn = "Verifier";
          }

          if (actorRole === "Planner" || actorRole === "System_Admin") {
            if (currentAssignment.status === "Submitted") {
              allowedActions.push("verify");
            }
            if (currentAssignment.status === "Open" || currentAssignment.status === "In_Progress") {
              allowedActions.push("assign");
            }
            allowedActions.push("open");
          }
          if (actorRole === currentAssignment.verifierRole || actorRole === "System_Admin") {
            if (currentAssignment.status === "Submitted") {
              allowedActions.push("verify");
            }
          }
          if (actorRole === "Warehouse_Manager" || actorRole === "System_Admin") {
            if (currentAssignment.module === "Stock" && currentAssignment.status === "Submitted") {
              allowedActions.push("reverse_issue");
            }
          }
        } else if (item.status === "Draft" || item.status === "Rejected") {
          if (item.createdBy === actorId) {
            allowedActions.push("edit");
          }
        }

        allowedActions.push("view");

        const [myAssignment] = await this.db
          .select({ id: spkAssignments.id })
          .from(spkAssignments)
          .where(
            and(
              eq(spkAssignments.spkId, item.id),
              eq(spkAssignments.assignedTo, actorId),
              inArray(spkAssignments.status, ["Open", "In_Progress"]),
            ),
          )
          .limit(1);

        return {
          id: item.id,
          spkNumber: item.spkNumber,
          vehicle: {
            id: item.vehicleId,
            licensePlate: item.licensePlate,
            className: item.className,
          },
          category: item.category as SpkCategory,
          priority: item.priority as SpkPriority,
          status: item.status as SpkStatus,
          currentStep: currentStep || "\u2014",
          waitingOn: waitingOn || "\u2014",
          allowedActions: allowedActions as ("open" | "view" | "edit")[],
          isMine: !!myAssignment,
        };
      })
    );

    const counts = await this.getTabCounts(actorId, actorRole);

    const allowedActions = actorRole === "Planner" || actorRole === "System_Admin" ? ["create"] : [];

    return {
      items: listItems,
      tabCounts: counts,
      allowedActions,
    };
  }

  private async getTabCounts(actorId: number, actorRole: Role): Promise<SpkTabCounts> {
    const baseCondition = isNull(spks.deletedAt);

    const counts: SpkTabCounts = {
      active: 0,
      mine: 0,
      draft: 0,
      pending: 0,
      rejected: 0,
      completed: 0,
      cancelled: 0,
      all: 0,
    };

    const [allCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(baseCondition);
    counts.all = allCount?.count ?? 0;

    const [draftCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(and(baseCondition, eq(spks.status, "Draft")));
    counts.draft = draftCount?.count ?? 0;

    const [pendingCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(and(baseCondition, eq(spks.status, "Pending_Approval")));
    counts.pending = pendingCount?.count ?? 0;

    const [rejectedCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(and(baseCondition, eq(spks.status, "Rejected")));
    counts.rejected = rejectedCount?.count ?? 0;

    const [completedCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(and(baseCondition, eq(spks.status, "Completed")));
    counts.completed = completedCount?.count ?? 0;

    const [cancelledCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(and(baseCondition, eq(spks.status, "Cancelled")));
    counts.cancelled = cancelledCount?.count ?? 0;

    const [activeCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(spks)
      .where(
        and(
          baseCondition,
          inArray(spks.status, ["Active", "In_Progress", "Pending_Verification", "Pending_Amendment"]),
        ),
      );
    counts.active = activeCount?.count ?? 0;

    if (actorRole === "Mechanic" || actorRole === "Warehouse_Manager" || actorRole === "Field_Coordinator" || actorRole === "Planner" || actorRole === "System_Admin") {
      const [mineCount] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(spks)
        .innerJoin(spkAssignments, eq(spkAssignments.spkId, spks.id))
        .where(
          and(
            baseCondition,
            eq(spkAssignments.assignedTo, actorId),
            inArray(spkAssignments.status, ["Open", "In_Progress"]),
          ),
        );
      counts.mine = mineCount?.count ?? 0;
    }

    return counts;
  }

  async detail(actorId: number, actorRole: Role, id: number): Promise<SpkDetailRow | null> {
    const row = await this.db
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
        stepCount: sql<number>`(SELECT count(*)::int FROM spk_assignments a WHERE a.spk_id = spks.id)`,
        version: spks.version,
        findingNote: spks.findingNote,
        approvedBy: spks.approvedBy,
        approvedAt: spks.approvedAt,
        activatedAt: spks.activatedAt,
        startedAt: spks.startedAt,
        completionRequestedAt: spks.completionRequestedAt,
        completionApprovedBy: spks.completionApprovedBy,
        completedAt: spks.completedAt,
        cancelledBy: spks.cancelledBy,
        cancelReason: spks.cancelReason,
        laborCost: spks.laborCost,
        partsCost: spks.partsCost,
        documentCost: spks.documentCost,
        stooringCost: spks.stooringCost,
        offDays: spks.offDays,
      })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(and(eq(spks.id, id), isNull(spks.deletedAt)))
      .limit(1);

    if (!row[0]) return null;
    const spk = row[0];

    const assignments = await this.db
      .select({
        id: spkAssignments.id,
        sequenceNo: spkAssignments.sequenceNo,
        module: spkAssignments.module,
        stepConfig: spkAssignments.stepConfig,
        isOptional: spkAssignments.isOptional,
        executorRoles: spkAssignments.executorRoles,
        verifierRole: spkAssignments.verifierRole,
        assignedTo: spkAssignments.assignedTo,
        executedBy: spkAssignments.executedBy,
        verifiedBy: spkAssignments.verifiedBy,
        openedAt: spkAssignments.openedAt,
        startedAt: spkAssignments.startedAt,
        submittedAt: spkAssignments.submittedAt,
        verifiedAt: spkAssignments.verifiedAt,
        returnNote: spkAssignments.returnNote,
        skipReason: spkAssignments.skipReason,
        status: spkAssignments.status,
        team: spkAssignments.team,
        stooringFee: spkAssignments.stooringFee,
      })
      .from(spkAssignments)
      .where(eq(spkAssignments.spkId, id))
      .orderBy(asc(spkAssignments.sequenceNo));

    const approvals = await this.db
      .select({
        id: spkApprovals.id,
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
      .orderBy(asc(spkApprovals.actedAt));

    const detail: SpkDetailRow = {
      id: spk.id,
      spkNumber: spk.spkNumber,
      vehicleId: spk.vehicleId,
      vehicle: { id: spk.vehicleId, licensePlate: spk.licensePlate, className: spk.className },
      title: spk.title,
      category: spk.category as SpkCategory,
      priority: spk.priority as SpkPriority,
      requiresDowntime: spk.requiresDowntime,
      description: spk.description,
      requestSource: spk.requestSource as SpkSource,
      status: spk.status as SpkStatus,
      stepCount: spk.stepCount,
      version: spk.version,
      findingNote: spk.findingNote ?? "",
      approvedBy: spk.approvedBy ? { id: spk.approvedBy, name: "" } : null,
      approvedAt: spk.approvedAt?.toISOString() ?? null,
      activatedAt: spk.activatedAt?.toISOString() ?? null,
      startedAt: spk.startedAt?.toISOString() ?? null,
      completionRequestedAt: spk.completionRequestedAt?.toISOString() ?? null,
      completionApprovedBy: spk.completionApprovedBy ? { id: spk.completionApprovedBy, name: "" } : null,
      completedAt: spk.completedAt?.toISOString() ?? null,
      cancelledBy: spk.cancelledBy ? { id: spk.cancelledBy, name: "" } : null,
      cancelReason: spk.cancelReason ?? "",
      laborCost: Number(spk.laborCost),
      partsCost: Number(spk.partsCost),
      documentCost: Number(spk.documentCost),
      stooringCost: Number(spk.stooringCost),
      offDays: spk.offDays,
      assignments: [],
      approvals: [],
      costBreakdown: {
        parts: Number(spk.partsCost),
        services: Number(spk.laborCost),
        documents: Number(spk.documentCost),
        stooring: Number(spk.stooringCost),
        offUnit: spk.offDays * 0,
        total: Number(spk.partsCost) + Number(spk.laborCost) + Number(spk.documentCost) + Number(spk.stooringCost),
      },
      history: [],
      changeRequests: [],
      partLines: [],
      serviceLines: [],
      allowedActions: [],
    };

    return detail;
  }
}

export const spkGateways = (tx: DbTransaction): SpkGateways => ({
  spks: new DrizzleSpkGateway(tx),
  numbers: new DrizzleDocumentNumbers(tx),
  audit: new DrizzleAuditGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
  plannerApproval: new DrizzlePlannerApprovalGateway(tx),
});