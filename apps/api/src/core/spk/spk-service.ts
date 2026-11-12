import type {
  Role,
  Spk,
  SpkFormOptionsResponse,
  SpkPriority,
  SpkRequest,
  SpkSubmitRequest,
  SpkUpdateRequest,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { SpkGateways, SpkRow } from '../../ports/spks.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  inState,
  NOT_ALLOWED,
  onlyOwner,
  type Actor,
  type Policies,
} from '../iam/actions.js';
import { plannerApprovalOn } from '../iam/capabilities.js';

export const SPK_MESSAGES = {
  notFound: 'This SPK does not exist.',
  inactiveVehicle: 'This vehicle is Inactive: no new SPK can be made for it.',
  unknownVehicle: 'Choose the vehicle from the list.',
  notDraft: 'This SPK is no longer a draft.',
  onlyCreator: 'Only the creator of this SPK can change or submit it.',
  /** DEC-126: until the step composer (TASK-207). */
  noStep: 'Add at least one step before submitting.',
} as const;

/** 404: no SPK with this id. */
export class SpkNotFoundError extends Error {
  constructor() {
    super(SPK_MESSAGES.notFound);
    this.name = 'SpkNotFoundError';
  }
}

/** 400: a vehicle that does not exist or is Inactive (REQ-SPK-013). */
export class SpkInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpkInvalidError';
  }
}

/** T2, T5: the creator edits and submits a Draft or Rejected SPK (DEC-126). */
const SPK_POLICIES: Policies<SpkRow, 'edit' | 'submit'> = {
  edit: {
    anyOf: ['spk.create'],
    rules: [
      inState((spk: SpkRow) => spk.status, ['Draft', 'Rejected'], SPK_MESSAGES.notDraft),
      onlyOwner((spk: SpkRow) => spk.createdBy, SPK_MESSAGES.onlyCreator),
    ],
  },
  submit: {
    anyOf: ['spk.create'],
    rules: [
      inState((spk: SpkRow) => spk.status, ['Draft', 'Rejected'], SPK_MESSAGES.notDraft),
      onlyOwner((spk: SpkRow) => spk.createdBy, SPK_MESSAGES.onlyCreator),
    ],
  },
};

/** REQ-NTF-005: an SPK submitted for approval goes to these roles. */
const APPROVER_ROLES: readonly Role[] = ['Supervisor', 'GM', 'System_Admin'];

const fieldsOf = (request: SpkRequest) => ({
  vehicleId: request.vehicleId,
  title: request.title,
  category: request.category,
  priority: request.priority,
  requiresDowntime: request.requiresDowntime,
  description: request.description,
});

/** REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015, T1, T2, T5, DEC-126: Create SPK. */
export class SpkService {
  constructor(
    private readonly unitOfWork: UnitOfWork<SpkGateways>,
    private readonly clock: ClockPort,
  ) {}

  /** The vehicles Create SPK offers (never an Inactive one) and the page action. */
  options(actor: Actor): Promise<SpkFormOptionsResponse> {
    this.requireCreate(actor);
    return this.unitOfWork.run(async ({ spks }) => ({
      vehicles: await spks.vehiclesForNewSpk(),
      allowedActions: ['create'],
    }));
  }

  get(actor: Actor, id: number): Promise<Spk> {
    if (!actor.capabilities.has('spk.view') && !actor.capabilities.has('spk.create')) {
      throw new ActionRefusedError('view', NOT_ALLOWED);
    }
    return this.unitOfWork.run(async (gateways) => this.view(actor, await this.load(gateways, id)));
  }

  /** T1: a Draft with its number; the source follows the creator (REQ-SPK-002). */
  create(actor: Actor, request: SpkRequest): Promise<Spk> {
    this.requireCreate(actor);
    return this.unitOfWork.run(async (gateways) => {
      await this.checkVehicle(gateways, request.vehicleId);
      const spkNumber = await gateways.numbers.next('SPK', this.clock.now());
      const id = await gateways.spks.insert({
        ...fieldsOf(request),
        requestSource: actor.user.role === 'Planner' ? 'Manual_Planner' : 'Manual_Admin',
        createdBy: actor.user.id,
        spkNumber,
      });
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, 'create', null, after);
      return this.view(actor, after);
    });
  }

  /** C-15 Save draft: the common fields again, at the version on screen (NFR-03). */
  update(actor: Actor, id: number, request: SpkUpdateRequest): Promise<Spk> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      assertAllowed(SPK_POLICIES, actor, before, 'edit');
      await this.checkVehicle(gateways, request.vehicleId);
      await gateways.spks.update(id, request.version, fieldsOf(request));
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, 'update', before, after);
      return this.view(actor, after);
    });
  }

  /** T2 (Draft) and T5 (Rejected): Pending approval, one Submit row, the Approvers notified. */
  submit(actor: Actor, id: number, request: SpkSubmitRequest): Promise<Spk> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      assertAllowed(SPK_POLICIES, actor, before, 'submit');
      if (before.stepCount === 0) throw new ActionRefusedError('submit', SPK_MESSAGES.noStep);
      const role = actor.user.role;
      if (!role) throw new ActionRefusedError('submit', NOT_ALLOWED);
      await this.checkVehicle(gateways, before.vehicleId);
      await gateways.spks.setStatus(id, request.version, 'Pending_Approval');
      await gateways.spks.insertApproval({
        spkId: id,
        stage: 'Creation',
        action: 'Submit',
        actedBy: actor.user.id,
        approverRole: role,
      });
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, 'submit', before, after);
      await this.notifyApprovers(gateways, after, request.version);
      return this.view(actor, after);
    });
  }

  private async notifyApprovers(gateways: SpkGateways, spk: SpkRow, version: number) {
    const roles = [...APPROVER_ROLES];
    const switchState = await gateways.plannerApproval.read();
    if (
      plannerApprovalOn(switchState, this.clock.now()) &&
      switchState.kinds.includes('spk_creation')
    ) {
      roles.push('Planner');
    }
    const recipients = await gateways.notifications.activeUsersWithRoles(roles);
    await gateways.notifications.send(recipients, {
      kind: 'Approval',
      title: `${spk.spkNumber} waits for your approval`,
      body: `${spk.priority === 'Normal' ? '' : `${spk.priority} · `}Creation approval · ${spk.vehicle.licensePlate} · ${spk.title}`,
      linkRecord: `/spk/${spk.id}`,
      // One notice per submission: a resubmit after a rejection (T5) is a new event.
      dedupeKey: `spk:${spk.id}:creation-submit:v${version}`,
    });
  }

  private view(actor: Actor, row: SpkRow): Spk {
    return {
      id: row.id,
      spkNumber: row.spkNumber,
      vehicle: { ...row.vehicle },
      title: row.title,
      category: row.category,
      priority: row.priority as SpkPriority,
      requiresDowntime: row.requiresDowntime,
      description: row.description,
      requestSource: row.requestSource,
      status: row.status,
      stepCount: row.stepCount,
      version: row.version,
      allowedActions: allowedActions(SPK_POLICIES, actor, row),
    };
  }

  private async load(gateways: SpkGateways, id: number, forUpdate = false): Promise<SpkRow> {
    const row = await gateways.spks.findById(id, { forUpdate });
    if (!row) throw new SpkNotFoundError();
    return row;
  }

  /** REQ-SPK-013, T1: never for an Inactive vehicle. */
  private async checkVehicle(gateways: SpkGateways, vehicleId: number): Promise<void> {
    const vehicle = await gateways.spks.vehicle(vehicleId);
    if (!vehicle) throw new SpkInvalidError(SPK_MESSAGES.unknownVehicle);
    if (vehicle.status === 'Inactive') throw new SpkInvalidError(SPK_MESSAGES.inactiveVehicle);
  }

  private audit(
    gateways: SpkGateways,
    actor: Actor,
    id: number,
    action: string,
    before: SpkRow | null,
    after: SpkRow,
  ): Promise<void> {
    return gateways.audit.write({
      entity: 'spk',
      entityId: id,
      action,
      ...(before ? { before } : {}),
      after,
      userId: actor.user.id,
      userRole: actor.user.role,
    });
  }

  private requireCreate(actor: Actor): void {
    if (!actor.capabilities.has('spk.create')) {
      throw new ActionRefusedError('create', NOT_ALLOWED);
    }
  }
}
