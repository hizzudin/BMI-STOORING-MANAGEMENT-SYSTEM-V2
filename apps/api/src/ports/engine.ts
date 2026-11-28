import type { AsgStatus, Role, SpkStatus } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';
import type { FileStatus } from './files.js';
import type { IdempotencyGateway } from './idempotency.js';
import type { NotificationGateway } from './notifications.js';
import type { TxHandle } from './unit-of-work.js';

/** §9.6 spks: what the engine reads of the SPK it holds. */
export interface EngineSpkRow {
  id: number;
  spkNumber: string;
  status: SpkStatus;
  version: number;
  title: string;
  licensePlate: string;
}

/** §9.6 spk_assignments: one step as the engine moves it. */
export interface EngineStepRow {
  id: number;
  sequenceNo: number;
  module: string;
  /** assignment_modules.name, for the notices. */
  moduleName: string;
  status: AsgStatus;
  executorRoles: Role[];
  assignedTo: number | null;
  attemptNo: number;
  /** The frozen step options, handed to the module's hooks (DEC-149). */
  stepConfig: unknown;
}

/** §9.12 stored_files: what a submit checks of each file (8.1, DEC-139). */
export interface EngineFileRow {
  id: number;
  status: FileStatus;
  uploadedBy: number;
  attachedAt: Date | null;
  originalName: string | null;
  rejectReason: string | null;
}

/**
 * TASK-202 (specs/design.md 5.25): the rows a step submit locks, always in the order SPK, steps,
 * files, so two submits, an approval or a cancel on the same SPK queue instead of deadlocking.
 */
export interface StepGateway {
  /** The SPK held for update; null when absent or soft-deleted. */
  lockSpk(spkId: number): Promise<EngineSpkRow | null>;
  /** The SPK's steps held for update, by `sequence_no`. */
  lockSteps(spkId: number): Promise<EngineStepRow[]>;
  /** These files held for update, by id; an unknown id is left out. */
  lockFiles(fileIds: readonly number[]): Promise<EngineFileRow[]>;
  markSubmitted(stepId: number, submitted: { at: Date; by: number }): Promise<void>;
  open(stepId: number, at: Date): Promise<void>;
  /** REQ-FUP-009: attached files are never expired. */
  attachFiles(fileIds: readonly number[], at: Date): Promise<void>;
  /** NFR-03 on the version read under the lock; `startedAt` with T7. */
  moveSpk(spkId: number, version: number, status: SpkStatus, startedAt?: Date): Promise<void>;
}

export interface EngineGateways {
  /** DEC-149: the transaction itself, opaque, on which a module's own gateways are built. */
  tx: TxHandle;
  steps: StepGateway;
  audit: AuditGateway;
  notifications: NotificationGateway;
  idempotency: IdempotencyGateway;
}
