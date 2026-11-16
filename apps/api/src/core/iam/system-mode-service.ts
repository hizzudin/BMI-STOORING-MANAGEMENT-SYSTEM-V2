import {
  BACK_TO_SETUP_PHRASE,
  GO_LIVE_PHRASE,
  SETUP_SIGN_IN_ROLES,
  SYSTEM_MODE_MESSAGES,
  type SystemMode,
  type SystemModeAction,
  type SystemModeResponse,
  type SystemModeSwitchRequest,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { IdempotentRequest } from '../../ports/idempotency.js';
import type { SystemModeGateway, SystemModeGateways } from '../../ports/system-mode.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { runIdempotent, type IdempotentResponse } from '../idempotency/run-idempotent.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from './actions.js';

/** A switch the rules refuse: no reason, a wrong phrase, or the mode it already is. HTTP 400. */
export class SystemModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SystemModeError';
  }
}

const SWITCHES: Record<
  SystemModeAction,
  { from: SystemMode; to: SystemMode; phrase: string; wrongPhrase: string; already: string }
> = {
  go_live: {
    from: 'Setup',
    to: 'Live',
    phrase: GO_LIVE_PHRASE,
    wrongPhrase: SYSTEM_MODE_MESSAGES.goLivePhrase,
    already: SYSTEM_MODE_MESSAGES.alreadyLive,
  },
  back_to_setup: {
    from: 'Live',
    to: 'Setup',
    phrase: BACK_TO_SETUP_PHRASE,
    wrongPhrase: SYSTEM_MODE_MESSAGES.backToSetupPhrase,
    already: SYSTEM_MODE_MESSAGES.alreadySetup,
  },
};

/** REQ-IAM-010, DEC-55, DEC-56, DEC-132: Setup mode and Go live, both ways, each switch audited. */
export class SystemModeService {
  constructor(
    private readonly unitOfWork: UnitOfWork<SystemModeGateways>,
    private readonly clock: ClockPort,
  ) {}

  status(actor: Actor): Promise<SystemModeResponse> {
    this.require(actor);
    return this.unitOfWork.run(({ systemMode }) => this.view(systemMode));
  }

  /** DEC-132: in Setup, a reason and GO LIVE typed switch to Live. */
  goLive(
    actor: Actor,
    request: SystemModeSwitchRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return this.switch(actor, 'go_live', request, key);
  }

  /** DEC-132: in Live, a reason and BACK TO SETUP typed switch back and end the other sessions. */
  backToSetup(
    actor: Actor,
    request: SystemModeSwitchRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return this.switch(actor, 'back_to_setup', request, key);
  }

  private switch(
    actor: Actor,
    action: SystemModeAction,
    request: SystemModeSwitchRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    this.require(actor);
    const rule = SWITCHES[action];
    const reason = request.reason.trim();
    if (!reason) throw new SystemModeError(SYSTEM_MODE_MESSAGES.reasonRequired);
    if (request.confirmation.trim() !== rule.phrase) throw new SystemModeError(rule.wrongPhrase);
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async (gateways) => {
      const { mode } = await gateways.systemMode.read();
      if (mode !== rule.from) throw new SystemModeError(rule.already);
      const now = this.clock.now();
      if (rule.to === 'Live') await gateways.systemMode.write('Live', now);
      else {
        await gateways.systemMode.write('Setup');
        await gateways.systemMode.revokeSessionsExceptRoles(SETUP_SIGN_IN_ROLES, now);
      }
      await gateways.audit.write({
        entity: 'system_mode',
        entityId: 0,
        action,
        before: { mode: rule.from },
        after: { mode: rule.to },
        reason,
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return { status: 200, body: await this.view(gateways.systemMode) };
    });
  }

  private async view(systemMode: SystemModeGateway): Promise<SystemModeResponse> {
    const { mode, wentLiveAt } = await systemMode.read();
    const counts = await systemMode.counts();
    return {
      mode,
      wentLiveAt: wentLiveAt?.toISOString() ?? null,
      checklist: [
        { key: 'accounts', label: 'Accounts', count: counts.accounts },
        { key: 'master_data', label: 'Master data', count: counts.masterData },
        { key: 'vehicles', label: 'Vehicles and documents', count: counts.vehicles },
      ],
      allowedActions: [mode === 'Setup' ? 'go_live' : 'back_to_setup'],
    };
  }

  private require(actor: Actor): void {
    if (!actor.capabilities.has('setup.golive')) {
      throw new ActionRefusedError('system_mode', NOT_ALLOWED);
    }
  }
}
