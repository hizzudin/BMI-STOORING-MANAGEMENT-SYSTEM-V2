import type { ApprovalDecisionAction, ApprovalStage, Role } from '@bmi/shared';
import { and, desc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type {
  ApprovalGateway,
  ApprovalGateways,
  DecisionRow,
  WaitingSpkRow,
} from '../../ports/approvals.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import { DrizzleSpkGateway, spkGateways, toSpkRow, UNKNOWN_PERSON } from './spk-gateways.js';
import { spkApprovals, spks, vehicleClasses, vehicles } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

const DECISIONS: readonly ApprovalDecisionAction[] = ['Approve', 'Reject'];

/** REQ-APR-002, REQ-APR-007: the Approvals inbox and History queries. */
export class DrizzleApprovalGateway implements ApprovalGateway {
  private readonly spkRows: DrizzleSpkGateway;

  constructor(private readonly db: DbTransaction) {
    this.spkRows = new DrizzleSpkGateway(db);
  }

  async waitingCreation(filter: { search?: string; spkId?: number }): Promise<WaitingSpkRow[]> {
    // One SPK by id in any status (the review page of a decided item); the inbox: the waiting ones.
    const conditions: (SQL | undefined)[] = [
      isNull(spks.deletedAt),
      filter.spkId === undefined ? eq(spks.status, 'Pending_Approval') : eq(spks.id, filter.spkId),
    ];
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
    const headers = (await this.spkRows.headers(and(...conditions))).map(toSpkRow);
    if (headers.length === 0) return [];
    const ids = headers.map((row) => row.id);
    // The last Submit of each SPK: who asked, and since when it waits.
    const submits = await this.db
      .selectDistinctOn([spkApprovals.spkId], {
        spkId: spkApprovals.spkId,
        actedBy: spkApprovals.actedBy,
        actedAt: spkApprovals.actedAt,
      })
      .from(spkApprovals)
      .where(
        and(
          inArray(spkApprovals.spkId, ids),
          eq(spkApprovals.stage, 'Creation'),
          eq(spkApprovals.action, 'Submit'),
        ),
      )
      .orderBy(spkApprovals.spkId, desc(spkApprovals.actedAt), desc(spkApprovals.id));
    const submitOf = new Map(submits.map((row) => [row.spkId, row]));
    const people = await this.spkRows.people([
      ...headers.map((row) => row.createdBy),
      ...submits.map((row) => row.actedBy),
    ]);
    const steps = await this.spkRows.stepsOf(ids);
    return headers.map((row) => {
      const submit = submitOf.get(row.id);
      const requester = submit?.actedBy ?? row.createdBy;
      return {
        ...row,
        requestedBy: people.get(requester) ?? UNKNOWN_PERSON,
        submittedAt: submit?.actedAt ?? new Date(0),
        steps: steps.get(row.id) ?? [],
      };
    });
  }

  async decisions(filter: {
    action?: ApprovalDecisionAction;
    spkId?: number;
  }): Promise<DecisionRow[]> {
    const rows = await this.db
      .select({
        spkId: spks.id,
        spkNumber: spks.spkNumber,
        vehicleId: vehicles.id,
        licensePlate: vehicles.licensePlate,
        className: vehicleClasses.name,
        createdBy: spks.createdBy,
        stage: spkApprovals.stage,
        action: spkApprovals.action,
        actedBy: spkApprovals.actedBy,
        approverRole: spkApprovals.approverRole,
        actedAt: spkApprovals.actedAt,
        selfApproved: spkApprovals.selfApproved,
        note: spkApprovals.note,
      })
      .from(spkApprovals)
      .innerJoin(spks, eq(spks.id, spkApprovals.spkId))
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .innerJoin(vehicleClasses, eq(vehicleClasses.id, vehicles.vehicleClassId))
      .where(
        and(
          isNull(spks.deletedAt),
          inArray(spkApprovals.action, filter.action ? [filter.action] : [...DECISIONS]),
          filter.spkId === undefined ? undefined : eq(spks.id, filter.spkId),
        ),
      )
      .orderBy(desc(spkApprovals.actedAt), desc(spkApprovals.id));
    const people = await this.spkRows.people(rows.flatMap((row) => [row.actedBy, row.createdBy]));
    return rows.map((row) => ({
      spkId: row.spkId,
      spkNumber: row.spkNumber,
      vehicle: { id: row.vehicleId, licensePlate: row.licensePlate, className: row.className },
      stage: row.stage as ApprovalStage,
      action: row.action as ApprovalDecisionAction,
      // The role the decision was taken in, as the stamp shows it (DEC-03).
      by: {
        name: people.get(row.actedBy)?.name ?? UNKNOWN_PERSON.name,
        role: row.approverRole as Role,
      },
      at: row.actedAt,
      selfApproved: row.selfApproved,
      reason: row.note,
      requestedBy: people.get(row.createdBy) ?? UNKNOWN_PERSON,
    }));
  }
}

export const approvalGateways = (tx: DbTransaction): ApprovalGateways => ({
  ...spkGateways(tx),
  approvals: new DrizzleApprovalGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
