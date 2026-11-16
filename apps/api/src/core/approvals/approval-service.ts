import type {
  ApprovalCountResponse,
  ApprovalDecision,
  ApprovalDecisionRequest,
  ApprovalHistoryQuery,
  ApprovalHistoryResponse,
  ApprovalInboxItem,
  ApprovalInboxQuery,
  ApprovalInboxResponse,
  ApprovalKind,
  ApprovalReview,
  ApprovalReviewResponse,
  SpkPriority,
} from '@bmi/shared';
import type { ApprovalGateways, DecisionRow, WaitingSpkRow } from '../../ports/approvals.js';
import type { ClockPort } from '../../ports/clock.js';
import type { IdempotentRequest } from '../../ports/idempotency.js';
import type { PersonRow } from '../../ports/spks.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { runIdempotent, type IdempotentResponse } from '../idempotency/run-idempotent.js';
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  isSelfDecision,
  NOT_ALLOWED,
  type Actor,
} from '../iam/actions.js';
import { plannerApprovalOn } from '../iam/capabilities.js';
import { SpkInvalidError, SpkNotFoundError } from '../spk/spk-service.js';
import { APPROVAL_MESSAGES, APPROVAL_POLICIES, inInbox, type ApprovalItem } from './can-approve.js';

/** DEC-127, DEC-128: Urgent and High first. */
const URGENCY_RANK: Readonly<Record<string, number>> = { Urgent: 0, High: 1, Normal: 2 };
const rankOf = (priority: string) => URGENCY_RANK[priority] ?? 3;

const person = (row: PersonRow) => ({ name: row.name, role: row.role });

/**
 * REQ-SPK-005 to REQ-SPK-007, REQ-APR-001 to REQ-APR-007, T3, T4, TX-02, DEC-128: the Approvals
 * inbox, the review and its decision, and History. Phase 1 decides SPK creation; the other kinds
 * reuse APPROVAL_POLICIES when their tasks come.
 */
export class ApprovalService {
  constructor(
    private readonly unitOfWork: UnitOfWork<ApprovalGateways>,
    private readonly clock: ClockPort,
  ) {}

  inbox(actor: Actor, query: ApprovalInboxQuery): Promise<ApprovalInboxResponse> {
    return this.unitOfWork.run(async (gateways) => ({
      items: await this.waitingItems(gateways, actor, query.search),
    }));
  }

  /** REQ-APR-001: the badge counts what the inbox lists. */
  count(actor: Actor): Promise<ApprovalCountResponse> {
    return this.unitOfWork.run(async (gateways) => ({
      count: actor.capabilities.has('spk.approve')
        ? (await this.waitingItems(gateways, actor)).length
        : 0,
    }));
  }

  review(actor: Actor, spkId: number): Promise<ApprovalReviewResponse> {
    return this.unitOfWork.run(async (gateways) => ({
      review: await this.reviewOf(gateways, actor, spkId),
    }));
  }

  /** T3, TX-02, C-24: Active, step 1 Open, the stamp; a retry with the same key replays (NFR-01). */
  approve(
    actor: Actor,
    spkId: number,
    request: ApprovalDecisionRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async (gateways) => {
      const { row, item } = await this.decidable(gateways, actor, spkId);
      assertAllowed(APPROVAL_POLICIES, actor, item, 'approve');
      const role = actor.user.role;
      if (!role) throw new ActionRefusedError('approve', NOT_ALLOWED);
      const now = this.clock.now();
      const selfApproved = isSelfDecision(actor, row.createdBy);
      await gateways.spks.setStatus(spkId, request.version, 'Active');
      await gateways.spks.openFirstStep(spkId, now);
      await gateways.spks.insertApproval({
        spkId,
        stage: 'Creation',
        action: 'Approve',
        actedBy: actor.user.id,
        approverRole: role,
        selfApproved,
        actedAt: now,
      });
      await gateways.audit.write({
        entity: 'spk',
        entityId: spkId,
        action: 'approve',
        before: { status: row.status },
        after: { status: 'Active' },
        selfDecision: selfApproved,
        userId: actor.user.id,
        userRole: role,
      });
      await this.notifyFirstStep(gateways, row);
      return { status: 200, body: { review: await this.reviewOf(gateways, actor, spkId) } };
    });
  }

  /** T4, C-25: Rejected with the reason; the creator is notified (REQ-SPK-007). */
  reject(
    actor: Actor,
    spkId: number,
    request: ApprovalDecisionRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async (gateways) => {
      const { row, item } = await this.decidable(gateways, actor, spkId);
      assertAllowed(APPROVAL_POLICIES, actor, item, 'reject');
      const reason = request.reason;
      if (!reason) throw new SpkInvalidError(APPROVAL_MESSAGES.reasonRequired);
      const role = actor.user.role;
      if (!role) throw new ActionRefusedError('reject', NOT_ALLOWED);
      await gateways.spks.setStatus(spkId, request.version, 'Rejected');
      await gateways.spks.insertApproval({
        spkId,
        stage: 'Creation',
        action: 'Reject',
        actedBy: actor.user.id,
        approverRole: role,
        note: reason,
        selfApproved: isSelfDecision(actor, row.createdBy),
        actedAt: this.clock.now(),
      });
      await gateways.audit.write({
        entity: 'spk',
        entityId: spkId,
        action: 'reject',
        before: { status: row.status },
        after: { status: 'Rejected' },
        reason,
        selfDecision: isSelfDecision(actor, row.createdBy),
        userId: actor.user.id,
        userRole: role,
      });
      await gateways.notifications.send([row.createdBy], {
        kind: 'Approval',
        title: `${row.spkNumber} was rejected`,
        body: `Reason: ${reason}`,
        linkRecord: `/spk/${spkId}`,
        dedupeKey: `spk:${spkId}:creation-reject:v${request.version}`,
      });
      return { status: 200, body: { review: await this.reviewOf(gateways, actor, spkId) } };
    });
  }

  /** REQ-APR-007, DEC-128: every Approver's decisions, newest first. */
  history(_actor: Actor, query: ApprovalHistoryQuery): Promise<ApprovalHistoryResponse> {
    return this.unitOfWork.run(async (gateways) => {
      const rows = await gateways.approvals.decisions(
        query.decision ? { action: query.decision } : {},
      );
      return {
        items: rows
          .filter((row) => row.stage === 'Creation')
          .map((row) => ({
            spkId: row.spkId,
            spkNumber: row.spkNumber,
            vehicle: row.vehicle,
            kind: 'Creation' as const,
            decision: decisionOf(row),
            requestedBy: person(row.requestedBy),
          })),
      };
    });
  }

  private async waitingItems(
    gateways: ApprovalGateways,
    actor: Actor,
    search?: string,
  ): Promise<ApprovalInboxItem[]> {
    const plannerKinds = await this.plannerKinds(gateways);
    const now = this.clock.now();
    const rows = await gateways.approvals.waitingCreation(search ? { search } : {});
    return rows
      .filter((row) => inInbox(actor, itemOf(row, plannerKinds)))
      .sort(
        (a, b) =>
          rankOf(a.priority) - rankOf(b.priority) ||
          a.submittedAt.getTime() - b.submittedAt.getTime() ||
          a.id - b.id,
      )
      .map((row) => this.itemView(actor, row, now));
  }

  private async reviewOf(
    gateways: ApprovalGateways,
    actor: Actor,
    spkId: number,
  ): Promise<ApprovalReview> {
    const [row] = await gateways.approvals.waitingCreation({ spkId });
    if (!row) throw new SpkNotFoundError();
    const item = itemOf(row, await this.plannerKinds(gateways));
    const [latest] = item.waiting ? [] : await gateways.approvals.decisions({ spkId });
    return {
      ...this.itemView(actor, row, this.clock.now()),
      status: row.status,
      version: row.version,
      decision: latest && latest.stage === 'Creation' ? decisionOf(latest) : null,
      allowedActions: allowedActions(APPROVAL_POLICIES, actor, item),
    };
  }

  /** The SPK held for the decision, as one approval item. */
  private async decidable(gateways: ApprovalGateways, _actor: Actor, spkId: number) {
    const held = await gateways.spks.findById(spkId, { forUpdate: true });
    if (!held) throw new SpkNotFoundError();
    const [row] = await gateways.approvals.waitingCreation({ spkId });
    if (!row) throw new SpkNotFoundError();
    return { row, item: itemOf(row, await this.plannerKinds(gateways)) };
  }

  /** BR-04: read inside the transaction, so a switch that ends meanwhile counts as off. */
  private async plannerKinds(gateways: ApprovalGateways): Promise<readonly ApprovalKind[]> {
    const state = await gateways.plannerApproval.read();
    return plannerApprovalOn(state, this.clock.now()) ? state.kinds : [];
  }

  /** TX-02: the executor of step 1 (its assignee, or the users of its roles) is told it is open. */
  private async notifyFirstStep(gateways: ApprovalGateways, row: WaitingSpkRow): Promise<void> {
    const first = row.steps.find((step) => step.sequenceNo === 1);
    if (!first) return;
    const recipients = await gateways.notifications.activeUsersWithRoles(first.executorRoles);
    await gateways.notifications.send(recipients, {
      kind: 'Step',
      title: `${row.spkNumber} step 1 is open`,
      body: `${first.name} · ${row.vehicle.licensePlate} · ${row.title}`,
      linkRecord: `/spk/${row.id}`,
      dedupeKey: `spk:${row.id}:step-1-open`,
    });
  }

  private itemView(actor: Actor, row: WaitingSpkRow, now: Date): ApprovalInboxItem {
    return {
      spkId: row.id,
      spkNumber: row.spkNumber,
      priority: row.priority as SpkPriority,
      vehicle: { ...row.vehicle },
      title: row.title,
      category: row.category,
      description: row.description,
      kind: 'Creation',
      requestedBy: person(row.requestedBy),
      submittedAt: row.submittedAt.toISOString(),
      waitingSeconds: Math.max(0, Math.floor((now.getTime() - row.submittedAt.getTime()) / 1000)),
      yours: row.createdBy === actor.user.id,
      steps: row.steps.map((step) => ({
        sequenceNo: step.sequenceNo,
        name: step.name,
        executorRoles: step.executorRoles,
      })),
    };
  }
}

function itemOf(row: WaitingSpkRow, plannerKinds: readonly ApprovalKind[]): ApprovalItem {
  return {
    kind: 'spk_creation',
    ownerId: row.createdBy,
    waiting: row.status === 'Pending_Approval',
    plannerKinds,
  };
}

function decisionOf(row: DecisionRow): ApprovalDecision {
  return {
    action: row.action,
    by: person(row.by),
    at: row.at.toISOString(),
    selfApproved: row.selfApproved,
    reason: row.reason,
  };
}
