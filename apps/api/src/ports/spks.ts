import type {
  ApprovalAction,
  ApprovalStage,
  Role,
  SpkCategory,
  SpkSource,
  SpkStatus,
  VehicleStatus,
  SpkPriority,
  SpkListAction,
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

/** SPK list item (REQ-SPK-010). */
export interface SpkListItem {
  id: number;
  spkNumber: string;
  vehicle: { id: number; licensePlate: string; className: string };
  category: SpkCategory;
  priority: SpkPriority;
  status: SpkStatus;
  currentStep: string | null;
  waitingOn: string | null;
  allowedActions: SpkListAction[];
  isMine: boolean;
}

/** SPK list tab counts. */
export interface SpkTabCounts {
  active: number;
  mine: number;
  draft: number;
  pending: number;
  rejected: number;
  completed: number;
  cancelled: number;
  all: number;
}

/** SPK list response. */
export interface SpkListResult {
  items: SpkListItem[];
  tabCounts: SpkTabCounts;
  allowedActions: string[];
}

/** SPK detail: step assignment. */
export interface SpkAssignmentRow {
  id: number;
  sequenceNo: number;
  module: string;
  moduleName: string;
  moduleIcon: string;
  status: string;
  executorRoles: Role[];
  verifierRole: Role;
  assignedTo: { id: number; name: string } | null;
  executedBy: { id: number; name: string } | null;
  verifiedBy: { id: number; name: string } | null;
  openedAt: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  returnNote: string | null;
  skipReason: string | null;
  isOptional: boolean;
  allowedActions: string[];
  stooringFee: number | null;
}

/** SPK detail: approval. */
export interface SpkApprovalRow {
  id: number;
  stage: ApprovalStage;
  action: ApprovalAction;
  actedBy: { id: number; name: string; role: Role };
  actedAt: string;
  note: string | null;
  selfApproved: boolean;
}

/** SPK detail: cost breakdown. */
export interface SpkCostBreakdown {
  parts: number;
  services: number;
  documents: number;
  stooring: number;
  offUnit: number;
  total: number;
}

/** SPK detail: history entry. */
export interface SpkHistoryEntry {
  when: string;
  who: { id: number; name: string; role: Role };
  what: string;
}

/** SPK detail: change request summary. */
export interface SpkChangeRequestSummary {
  id: number;
  crNumber: string;
  raisedBy: { id: number; name: string };
  reason: string;
  status: string;
  raisedAt: string;
}

/** SPK detail: part line. */
export interface SpkPartLine {
  partName: string;
  source: string;
  plannedQty: number;
  usedQty: number | null;
  unitPrice: number;
  total: number;
  step: string;
}

/** SPK detail: service line. */
export interface SpkServiceLine {
  service: string;
  code: string;
  team: string;
  price: number;
  step: string;
}

/** Full SPK detail row (REQ-SPK-011). */
export interface SpkDetailRow {
  id: number;
  spkNumber: string;
  vehicleId: number;
  vehicle: { id: number; licensePlate: string; className: string };
  title: string;
  category: SpkCategory;
  priority: SpkPriority;
  requiresDowntime: boolean;
  description: string;
  requestSource: SpkSource;
  status: SpkStatus;
  stepCount: number;
  version: number;
  findingNote: string;
  approvedBy: { id: number; name: string } | null;
  approvedAt: string | null;
  activatedAt: string | null;
  startedAt: string | null;
  completionRequestedAt: string | null;
  completionApprovedBy: { id: number; name: string } | null;
  completedAt: string | null;
  cancelledBy: { id: number; name: string } | null;
  cancelReason: string;
  laborCost: number;
  partsCost: number;
  documentCost: number;
  stooringCost: number;
  offDays: number;
  assignments: SpkAssignmentRow[];
  approvals: SpkApprovalRow[];
  costBreakdown: SpkCostBreakdown;
  history: SpkHistoryEntry[];
  changeRequests: SpkChangeRequestSummary[];
  partLines: SpkPartLine[];
  serviceLines: SpkServiceLine[];
  allowedActions: string[];
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
  /** SPK list with tabs, filters and counts (REQ-SPK-010). */
  list(actorId: number, actorRole: Role, tab: string, search?: string, type?: string, vehicleId?: number): Promise<SpkListResult>;
  /** Full SPK detail with steps, costs, approvals, history (REQ-SPK-011). */
  detail(actorId: number, actorRole: Role, id: number): Promise<SpkDetailRow | null>;
}

export interface SpkGateways {
  spks: SpkGateway;
  numbers: DocumentNumberGateway;
  audit: AuditGateway;
  notifications: NotificationGateway;
  /** REQ-NTF-005: Planners hear of a submitted SPK only while the switch covers its kind. */
  plannerApproval: { read(): Promise<PlannerApprovalState> };
}