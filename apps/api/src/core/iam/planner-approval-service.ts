import type {
  PlannerApprovalAction,
  PlannerApprovalRequest,
  PlannerApprovalResponse,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type {
  PlannerApprovalEndScheduler,
  PlannerApprovalGateways,
  PlannerApprovalState,
} from '../../ports/planner-approval.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from './actions.js';
import { plannerApprovalOn } from './capabilities.js';

export const PLANNER_APPROVAL_MESSAGES = {
  endInPast: 'The end time must be later than now.',
  alreadyOff: 'Planner approval is already off.',
  ended: 'Ended at its end time.',
} as const;

/** 400: the request is well formed but cannot be used now (an end time already passed). */
export class PlannerApprovalInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlannerApprovalInvalidError';
  }
}

const OFF: PlannerApprovalState = { kinds: [], until: null };

/** The switch is one record: its audit rows carry entity_id 0 (DEC-118). */
const SWITCH_ID = 0;

const auditView = (state: PlannerApprovalState) => ({
  kinds: state.kinds,
  until: state.until?.toISOString() ?? null,
});

/** REQ-IAM-008, RL-7, TX-20, DEC-118: the Planner approval switch of the Access Manager. */
export class PlannerApprovalService {
  constructor(
    private readonly unitOfWork: UnitOfWork<PlannerApprovalGateways>,
    private readonly clock: ClockPort,
    private readonly scheduler: PlannerApprovalEndScheduler,
  ) {}

  /** The card: the switch as it stands now; a switch whose end time passed is ended first. */
  state(actor: Actor): Promise<PlannerApprovalResponse> {
    this.requireSwitch(actor);
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      await gateways.plannerApproval.lock();
      return this.view(actor, await this.endDue(gateways, now), now);
    });
  }

  /** Switch on, or Change while on: the ticked kinds, an optional end time, a reason (TX-20). */
  async set(actor: Actor, request: PlannerApprovalRequest): Promise<PlannerApprovalResponse> {
    this.requireSwitch(actor);
    const now = this.clock.now();
    const until = request.until === null ? null : new Date(request.until);
    if (until && until <= now) {
      throw new PlannerApprovalInvalidError(PLANNER_APPROVAL_MESSAGES.endInPast);
    }
    const next: PlannerApprovalState = { kinds: [...request.kinds], until };
    const response = await this.unitOfWork.run(async (gateways) => {
      await gateways.plannerApproval.lock();
      const before = await this.endDue(gateways, now);
      const action: PlannerApprovalAction = plannerApprovalOn(before, now) ? 'change' : 'switch_on';
      await gateways.plannerApproval.write(next);
      await this.audit(gateways, actor, action, before, next, request.reason);
      return this.view(actor, next, now);
    });
    // After the commit: the job ends the switch at its end time; it does nothing if it changed since.
    if (until) await this.scheduler.scheduleEnd(until);
    return response;
  }

  switchOff(actor: Actor, reason: string): Promise<PlannerApprovalResponse> {
    this.requireSwitch(actor);
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      await gateways.plannerApproval.lock();
      const before = await this.endDue(gateways, now);
      if (!plannerApprovalOn(before, now)) {
        throw new ActionRefusedError('switch_off', PLANNER_APPROVAL_MESSAGES.alreadyOff);
      }
      await gateways.plannerApproval.write(OFF);
      await this.audit(gateways, actor, 'switch_off', before, OFF, reason);
      return this.view(actor, OFF, now);
    });
  }

  /** The end job (DEC-118): idempotent, so a repeated or late run writes nothing more. */
  endIfDue(): Promise<void> {
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      await gateways.plannerApproval.lock();
      await this.endDue(gateways, now);
    });
  }

  /** Clears a switch whose end time passed and writes its one "end" audit record. */
  private async endDue(
    gateways: PlannerApprovalGateways,
    now: Date,
  ): Promise<PlannerApprovalState> {
    const state = await gateways.plannerApproval.read();
    const due = state.kinds.length > 0 && state.until !== null && state.until <= now;
    if (!due) return state;
    await gateways.plannerApproval.write(OFF);
    await gateways.audit.write({
      entity: 'planner_approval',
      entityId: SWITCH_ID,
      action: 'end',
      before: auditView(state),
      after: auditView(OFF),
      reason: PLANNER_APPROVAL_MESSAGES.ended,
      userId: null,
      userRole: null,
    });
    return OFF;
  }

  private audit(
    gateways: PlannerApprovalGateways,
    actor: Actor,
    action: PlannerApprovalAction,
    before: PlannerApprovalState,
    after: PlannerApprovalState,
    reason: string,
  ): Promise<void> {
    return gateways.audit.write({
      entity: 'planner_approval',
      entityId: SWITCH_ID,
      action,
      before: auditView(before),
      after: auditView(after),
      reason,
      userId: actor.user.id,
      userRole: actor.user.role,
    });
  }

  private view(actor: Actor, state: PlannerApprovalState, now: Date): PlannerApprovalResponse {
    const on = plannerApprovalOn(state, now);
    const actions: PlannerApprovalAction[] = on ? ['change', 'switch_off'] : ['switch_on'];
    return {
      on,
      kinds: on ? state.kinds : [],
      until: on ? (state.until?.toISOString() ?? null) : null,
      allowedActions: actor.capabilities.has('iam.planner_approval_switch') ? actions : [],
    };
  }

  private requireSwitch(actor: Actor): void {
    if (!actor.capabilities.has('iam.planner_approval_switch')) {
      throw new ActionRefusedError('planner_approval', NOT_ALLOWED);
    }
  }
}
