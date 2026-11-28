import type { AsgStatus, Role, SpkStatus } from '@bmi/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type {
  EngineFileRow,
  EngineGateways,
  EngineSpkRow,
  EngineStepRow,
  StepGateway,
} from '../../ports/engine.js';
import type { FileStatus } from '../../ports/files.js';
import type { TxHandle } from '../../ports/unit-of-work.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { DrizzleIdempotencyGateway } from './idempotency-gateway.js';
import { DrizzleNotificationGateway } from './notification-gateways.js';
import { updateWithVersion } from './optimistic-lock.js';
import { assignmentModules, spkAssignments, spks, storedFiles, vehicles } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

/**
 * TASK-202: the engine's rows, locked in one order (the SPK, its steps, the files) as approve and
 * cancel lock the SPK first (specs/design.md 5.25).
 */
export class DrizzleStepGateway implements StepGateway {
  constructor(private readonly db: DbTransaction) {}

  async lockSpk(spkId: number): Promise<EngineSpkRow | null> {
    const [row] = await this.db
      .select({
        id: spks.id,
        spkNumber: spks.spkNumber,
        status: spks.status,
        version: spks.version,
        title: spks.title,
        licensePlate: vehicles.licensePlate,
      })
      .from(spks)
      .innerJoin(vehicles, eq(vehicles.id, spks.vehicleId))
      .where(and(eq(spks.id, spkId), isNull(spks.deletedAt)))
      .for('update', { of: spks });
    return row ? { ...row, status: row.status as SpkStatus } : null;
  }

  async lockSteps(spkId: number): Promise<EngineStepRow[]> {
    const rows = await this.db
      .select({
        id: spkAssignments.id,
        sequenceNo: spkAssignments.sequenceNo,
        module: spkAssignments.module,
        moduleName: assignmentModules.name,
        status: spkAssignments.status,
        executorRoles: spkAssignments.executorRoles,
        assignedTo: spkAssignments.assignedTo,
        attemptNo: spkAssignments.attemptNo,
        stepConfig: spkAssignments.stepConfig,
      })
      .from(spkAssignments)
      .innerJoin(assignmentModules, eq(assignmentModules.code, spkAssignments.module))
      .where(eq(spkAssignments.spkId, spkId))
      .orderBy(asc(spkAssignments.sequenceNo))
      .for('update', { of: spkAssignments });
    return rows.map((row) => ({
      ...row,
      status: row.status as AsgStatus,
      executorRoles: row.executorRoles as Role[],
    }));
  }

  async lockFiles(fileIds: readonly number[]): Promise<EngineFileRow[]> {
    if (fileIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: storedFiles.id,
        status: storedFiles.status,
        uploadedBy: storedFiles.uploadedBy,
        attachedAt: storedFiles.attachedAt,
        originalName: storedFiles.originalName,
        rejectReason: storedFiles.rejectReason,
      })
      .from(storedFiles)
      .where(inArray(storedFiles.id, [...fileIds]))
      .orderBy(asc(storedFiles.id))
      .for('update');
    return rows.map((row) => ({ ...row, status: row.status as FileStatus }));
  }

  async markSubmitted(stepId: number, submitted: { at: Date; by: number }): Promise<void> {
    await this.db
      .update(spkAssignments)
      .set({
        status: 'Submitted',
        submittedAt: submitted.at,
        executedBy: submitted.by,
        updatedAt: submitted.at,
      })
      .where(eq(spkAssignments.id, stepId));
  }

  async open(stepId: number, at: Date): Promise<void> {
    await this.db
      .update(spkAssignments)
      .set({ status: 'Open', openedAt: at, updatedAt: at })
      .where(eq(spkAssignments.id, stepId));
  }

  async attachFiles(fileIds: readonly number[], at: Date): Promise<void> {
    await this.db
      .update(storedFiles)
      .set({ attachedAt: at, updatedAt: at })
      .where(inArray(storedFiles.id, [...fileIds]));
  }

  moveSpk(spkId: number, version: number, status: SpkStatus, startedAt?: Date): Promise<void> {
    return updateWithVersion(this.db, spks, spkId, version, {
      status,
      ...(startedAt ? { startedAt } : {}),
    });
  }
}

export const engineGateways = (tx: DbTransaction): EngineGateways => ({
  // DEC-149: only infra turns its transaction into the opaque handle and back.
  tx: tx as unknown as TxHandle,
  steps: new DrizzleStepGateway(tx),
  audit: new DrizzleAuditGateway(tx),
  notifications: new DrizzleNotificationGateway(tx),
  idempotency: new DrizzleIdempotencyGateway(tx),
});
