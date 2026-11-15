import type { ApprovalKind, ApprovalReviewAction, PermissionCode } from '@bmi/shared';
import { notOwnWork, refusalOf, type Actor, type Policies, type Rule } from '../iam/actions.js';

export const APPROVAL_MESSAGES = {
  ownWork: 'You cannot decide an item you created.',
  notWaiting: 'This item is no longer waiting for approval.',
  plannerKind: 'Planner approval does not cover this kind of item now.',
  noKindCapability: 'You do not have permission to decide this kind of item.',
  reasonRequired: 'Give a reason to reject.',
} as const;

/** The capability each approval kind needs (PRD 2.4: one row per kind group). */
const CAPABILITY_OF: Readonly<Record<ApprovalKind, PermissionCode>> = {
  spk_creation: 'spk.approve',
  spk_amendment: 'spk.approve',
  spk_completion: 'spk.approve',
  stock_opname: 'count.approve',
  tyre_count: 'count.approve',
};

/** One item waiting for a decision, whatever its kind (§8.3: one canApprove). */
export interface ApprovalItem {
  kind: ApprovalKind;
  /** The creator of the SPK, or the person who counted (BR-03). */
  ownerId: number | null;
  /** Still in the state that waits for this decision. */
  waiting: boolean;
  /** BR-04: the kinds a Planner may decide now (ticked on a switch that is on); empty otherwise. */
  plannerKinds: readonly ApprovalKind[];
}

const kindCapability: Rule<ApprovalItem> = (actor, item) =>
  actor.capabilities.has(CAPABILITY_OF[item.kind]) ? null : APPROVAL_MESSAGES.noKindCapability;

/** BR-04, REQ-IAM-008: a Planner decides only the kinds ticked on the switch, while it is on. */
const plannerKind: Rule<ApprovalItem> = (actor, item) =>
  actor.user.role !== 'Planner' || item.plannerKinds.includes(item.kind)
    ? null
    : APPROVAL_MESSAGES.plannerKind;

const waiting: Rule<ApprovalItem> = (_actor, item) =>
  item.waiting ? null : APPROVAL_MESSAGES.notWaiting;

const decision = {
  anyOf: ['spk.approve', 'count.approve'] as PermissionCode[],
  rules: [
    kindCapability,
    plannerKind,
    waiting,
    // BR-03: the System Admin is the one exception; its decision is marked Self-approved.
    notOwnWork((item: ApprovalItem) => item.ownerId, APPROVAL_MESSAGES.ownWork),
  ],
};

/**
 * §8.3, BR-03, BR-04, DEC-02: canApprove for every approval kind. Approve and Reject follow the same
 * rules; Reject also needs a reason, which the service checks on the payload.
 */
export const APPROVAL_POLICIES: Policies<ApprovalItem, ApprovalReviewAction> = {
  approve: decision,
  reject: decision,
};

/** True when this actor may see the item in its inbox: it may decide it now (REQ-APR-006). */
export function inInbox(actor: Actor, item: ApprovalItem): boolean {
  return refusalOf(APPROVAL_POLICIES, actor, item, 'approve') === null;
}
