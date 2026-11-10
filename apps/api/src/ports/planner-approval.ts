import type { ApprovalKind } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';

/** app_settings planner_approval_kinds and planner_approval_until (REQ-IAM-008, TX-20). */
export interface PlannerApprovalState {
  kinds: ApprovalKind[];
  until: Date | null;
}

export interface PlannerApprovalGateway {
  /** Holds the switch until the transaction ends, so a change and the end job never interleave. */
  lock(): Promise<void>;
  read(): Promise<PlannerApprovalState>;
  write(state: PlannerApprovalState): Promise<void>;
}

export interface PlannerApprovalGateways {
  plannerApproval: PlannerApprovalGateway;
  audit: AuditGateway;
}

/** DEC-118: runs `endIfDue` at the end time (a delayed job; the same end time is scheduled once). */
export interface PlannerApprovalEndScheduler {
  scheduleEnd(until: Date): Promise<void>;
}
