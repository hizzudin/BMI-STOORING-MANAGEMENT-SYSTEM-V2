import type { ApprovalDecisionAction, ApprovalStage } from '@bmi/shared';
import type { IdempotencyGateway } from './idempotency.js';
import type { PersonRow, SpkGateways, SpkRow, SpkStepRow } from './spks.js';

/** REQ-APR-002, DEC-128: an SPK waiting for creation approval, with its last Submit. */
export interface WaitingSpkRow extends SpkRow {
  requestedBy: PersonRow;
  submittedAt: Date;
  steps: SpkStepRow[];
}

/** REQ-APR-007, DEC-03: one Approve or Reject row of spk_approvals with its SPK. */
export interface DecisionRow {
  spkId: number;
  spkNumber: string;
  vehicle: { id: number; licensePlate: string; className: string };
  stage: ApprovalStage;
  action: ApprovalDecisionAction;
  /** The person, in the role the decision was taken in. */
  by: PersonRow;
  at: Date;
  selfApproved: boolean;
  reason: string | null;
  requestedBy: PersonRow;
}

/** Plain filters (no SQL here: the gateway turns them into a query). */
export interface ApprovalGateway {
  /**
   * SPKs in Pending_Approval, not soft-deleted; search: contains, any case, in number, title or plate.
   * With `spkId`: that SPK in any status, for the review page of a decided item.
   */
  waitingCreation(filter: { search?: string; spkId?: number }): Promise<WaitingSpkRow[]>;
  /** The decisions, newest first. */
  decisions(filter: { action?: ApprovalDecisionAction; spkId?: number }): Promise<DecisionRow[]>;
}

export interface ApprovalGateways extends SpkGateways {
  approvals: ApprovalGateway;
  idempotency: IdempotencyGateway;
}
