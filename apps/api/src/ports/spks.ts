import type {
  ApprovalAction,
  ApprovalStage,
  AsgStatus,
  Role,
  SpkCategory,
  SpkSource,
  SpkStatus,
  UnitKind,
  VehicleStatus,
} from '@bmi/shared';
import type { AuditGateway } from './accounts.js';
import type { IdempotencyGateway } from './idempotency.js';
import type { NotificationGateway } from './notifications.js';
import type { DocumentNumberGateway } from './numbering.js';
import type { PlannerApprovalState } from './planner-approval.js';
import type { SpkCancelSteps } from './spk-cancel-steps.js';

/** The fields a new SPK row is written with (§9.6); later tasks add the steps, parts and sources. */
export interface NewSpk {
  vehicleId: number;
  title: string;
  category: SpkCategory;
  requestSource: SpkSource;
  description: string;
  createdBy: number;
  requiresDowntime?: boolean;
  priority?: string;
  presetId?: number | null;
  breakdownReportId?: number | null;
  findingNote?: string | null;
}

/** The common fields Create SPK edits while the SPK is Draft or Rejected (REQ-SPK-001, DEC-126). */
export interface SpkFields {
  vehicleId: number;
  title: string;
  category: SpkCategory;
  priority: string;
  requiresDowntime: boolean;
  description: string;
}

/** §9.6 spks: the header of one SPK, with its vehicle and the number of its steps. */
export interface SpkRow {
  id: number;
  spkNumber: string;
  vehicleId: number;
  vehicle: { id: number; licensePlate: string; className: string };
  title: string;
  category: SpkCategory;
  requiresDowntime: boolean;
  requestSource: SpkSource;
  priority: string;
  description: string;
  status: SpkStatus;
  createdBy: number;
  stepCount: number;
  version: number;
}

/** A vehicle Create SPK may offer, with its status (REQ-SPK-013). */
export interface SpkVehicleRow {
  id: number;
  licensePlate: string;
  className: string;
  status: VehicleStatus;
}

export interface SpkGateway {
  /** A Draft SPK with a number already taken from the sequence (TX-01 adds its steps). */
  insert(spk: NewSpk & { spkNumber: string }): Promise<number>;
  /** Not soft-deleted; `forUpdate` holds the SPK until the transaction ends. */
  findById(id: number, options?: { forUpdate?: boolean }): Promise<SpkRow | null>;
  /** REQ-SCH-001: the numbers of the open SPKs of each vehicle, oldest first; no entry when none. */
  openNumbersByVehicle(vehicleIds: readonly number[]): Promise<Map<number, string[]>>;
  /** NFR-03: refused with ConcurrentUpdateError when `version` is no longer current. */
  update(id: number, version: number, fields: SpkFields): Promise<void>;
  setStatus(id: number, version: number, status: SpkStatus): Promise<void>;
  /** spk_approvals is append-only: one row per decision or submit. */
  insertApproval(row: {
    spkId: number;
    stage: ApprovalStage;
    action: ApprovalAction;
    actedBy: number;
    approverRole: Role;
    note?: string | null;
    /** BR-03: the System Admin deciding its own work. */
    selfApproved?: boolean;
    /** Defaults to now; a decision takes the clock of the service. */
    actedAt?: Date;
  }): Promise<void>;
  /** TX-02, T3: step 1 Open from `at`, every other step Locked. */
  openFirstStep(spkId: number, at: Date): Promise<void>;
  /** T6, DEC-129: Cancelled with who and why, at the version on screen (NFR-03). */
  cancel(id: number, version: number, cancelled: { reason: string; by: number }): Promise<void>;
  vehicle(id: number): Promise<SpkVehicleRow | null>;
  /** Not Inactive and not soft-deleted, by plate. */
  vehiclesForNewSpk(): Promise<SpkVehicleRow[]>;

  /** REQ-SPK-010, REQ-SPK-015, DEC-127: one page, Urgent and High first, then newest first. */
  listPage(filter: SpkListFilter, page: { offset: number; limit: number }): Promise<SpkListRow[]>;
  countMatching(filter: SpkListFilter): Promise<number>;
  /** The vehicles that have an SPK that is not soft-deleted: the vehicle filter. */
  vehiclesWithSpks(): Promise<{ id: number; licensePlate: string }[]>;
  /** REQ-SPK-011: the steps, approval rows, vehicle and creator of one SPK. */
  detail(id: number): Promise<SpkDetailRow | null>;
}

/** Plain filters for SPKList (no SQL here: the gateway turns them into a query). */
export interface SpkListFilter {
  /** The statuses of the tab; absent for All and My steps. */
  statuses?: readonly SpkStatus[];
  /** My steps: an Open or In_Progress step assigned to the user, or unassigned for one of its roles. */
  mineOf?: { userId: number; roles: readonly Role[] };
  /** Contains, any case, in the SPK number, the title or the plate. */
  search?: string;
  category?: SpkCategory;
  vehicleId?: number;
}

/** A person as the SPK pages name them (users.name and the role of user_roles). */
export interface PersonRow {
  name: string;
  role: Role | null;
}

/** One step as SPKList and SPKDetail need it. */
export interface SpkStepRow {
  id: number;
  sequenceNo: number;
  name: string;
  status: AsgStatus;
  executorRoles: Role[];
  verifierRole: Role;
  assignee: PersonRow | null;
  openedAt: Date | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: PersonRow | null;
}

/** SPKList: the SPK, its creator and its current step (the first not Verified or Skipped). */
export interface SpkListRow extends SpkRow {
  creator: PersonRow;
  currentStep: SpkStepRow | null;
}

export interface SpkApprovalRow {
  stage: ApprovalStage;
  action: ApprovalAction;
  by: PersonRow;
  actedAt: Date;
  note: string | null;
  selfApproved: boolean;
}

/** SPKDetail: the SPK with everything phase 1 shows (DEC-127). */
export interface SpkDetailRow extends SpkRow {
  vehicleUnitKind: UnitKind;
  vehicleOdometer: number;
  creator: PersonRow;
  steps: SpkStepRow[];
  approvals: SpkApprovalRow[];
  /** NUMERIC(14,2) as decimal strings. */
  costs: { labor: string; parts: string; document: string; stooring: string };
}

export interface SpkGateways {
  spks: SpkGateway;
  numbers: DocumentNumberGateway;
  audit: AuditGateway;
  notifications: NotificationGateway;
  /** REQ-NTF-005: Planners hear of a submitted SPK only while the switch covers its kind. */
  plannerApproval: { read(): Promise<PlannerApprovalState> };
  /** NFR-01, TX-22: a retried cancel replays its answer. */
  idempotency: IdempotencyGateway;
  /** TX-14, DEC-140: the approver cancel's steps before Cancelled. */
  cancelSteps: SpkCancelSteps;
}
