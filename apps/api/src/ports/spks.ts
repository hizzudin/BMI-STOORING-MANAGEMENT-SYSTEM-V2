import type {
  ApprovalAction,
  ApprovalStage,
  Role,
  SpkCategory,
  SpkSource,
  SpkStatus,
  VehicleStatus,
} from '@bmi/shared';
import type { AuditGateway } from './accounts.js';
import type { NotificationGateway } from './notifications.js';
import type { DocumentNumberGateway } from './numbering.js';
import type { PlannerApprovalState } from './planner-approval.js';

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
  }): Promise<void>;
  vehicle(id: number): Promise<SpkVehicleRow | null>;
  /** Not Inactive and not soft-deleted, by plate. */
  vehiclesForNewSpk(): Promise<SpkVehicleRow[]>;
}

export interface SpkGateways {
  spks: SpkGateway;
  numbers: DocumentNumberGateway;
  audit: AuditGateway;
  notifications: NotificationGateway;
  /** REQ-NTF-005: Planners hear of a submitted SPK only while the switch covers its kind. */
  plannerApproval: { read(): Promise<PlannerApprovalState> };
}
