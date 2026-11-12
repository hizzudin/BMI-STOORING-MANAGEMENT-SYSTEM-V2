import type {
  Role,
  Spk,
  SpkFormOptionsResponse,
  SpkPriority,
  SpkRequest,
  SpkSubmitRequest,
  SpkUpdateRequest,
  SpkListResponse,
  SpkDetailResponse,
  SpkListTab,
  SpkDetail,
  SpkListResult,
} from "@bmi/shared";
import type { ClockPort } from "../../ports/clock.js";
import type { SpkGateways, SpkRow } from "../../ports/spks.js";
import type { UnitOfWork } from "../../ports/unit-of-work.js";
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  inState,
  NOT_ALLOWED,
  onlyOwner,
  type Actor,
  type Policies,
} from "../iam/actions.js";
import { plannerApprovalOn } from "../iam/capabilities.js";

export const SPK_MESSAGES = {
  notFound: "This SPK does not exist.",
  inactiveVehicle: "This vehicle is Inactive: no new SPK can be made for it.",
  unknownVehicle: "Choose the vehicle from the list.",
  notDraft: "This SPK is no longer a draft.",
  onlyCreator: "Only the creator of this SPK can change or submit it.",
  noStep: "Add at least one step before submitting.",
} as const;

export class SpkNotFoundError extends Error {
  constructor() {
    super(SPK_MESSAGES.notFound);
    this.name = "SpkNotFoundError";
  }
}

export class SpkInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpkInvalidError";
  }
}

const SPK_POLICIES: Policies<SpkRow, "edit" | "submit"> = {
  edit: {
    anyOf: ["spk.create"],
    rules: [
      inState((spk: SpkRow) => spk.status, ["Draft", "Rejected"], SPK_MESSAGES.notDraft),
      onlyOwner((spk: SpkRow) => spk.createdBy, SPK_MESSAGES.onlyCreator),
    ],
  },
  submit: {
    anyOf: ["spk.create"],
    rules: [
      inState((spk: SpkRow) => spk.status, ["Draft", "Rejected"], SPK_MESSAGES.notDraft),
      onlyOwner((spk: SpkRow) => spk.createdBy, SPK_MESSAGES.onlyCreator),
    ],
  },
};

const APPROVER_ROLES: readonly Role[] = ["Supervisor", "GM", "System_Admin"];

const fieldsOf = (request: SpkRequest) => ({
  vehicleId: request.vehicleId,
  title: request.title,
  category: request.category,
  priority: request.priority,
  requiresDowntime: request.requiresDowntime,
  description: request.description,
});

export class SpkService {
  constructor(
    private readonly unitOfWork: UnitOfWork<SpkGateways>,
    private readonly clock: ClockPort,
  ) {}

  options(actor: Actor): Promise<SpkFormOptionsResponse> {
    this.requireCreate(actor);
    return this.unitOfWork.run(async ({ spks }) => ({
      vehicles: await spks.vehiclesForNewSpk(),
      allowedActions: ["create"],
    }));
  }

  get(actor: Actor, id: number): Promise<Spk> {
    if (!actor.capabilities.has("spk.view") && !actor.capabilities.has("spk.create")) {
      throw new ActionRefusedError("view", NOT_ALLOWED);
    }
    return this.unitOfWork.run(async (gateways) => this.view(actor, await this.load(gateways, id)));
  }

  list(actor: Actor, tab: SpkListTab = "active", search?: string, type?: string, vehicleId?: number): Promise<SpkListResponse> {
    if (!actor.capabilities.has("spk.view") && !actor.capabilities.has("spk.create")) {
      throw new ActionRefusedError("list", NOT_ALLOWED);
    }
    return this.unitOfWork.run(async (gateways) => {
      const role = actor.user.role ?? "Planner";
      const spkListResult = await gateways.spks.list(actor.user.id, role, tab, search, type, vehicleId);
      return { spkList: spkListResult };
    });
  }

  detail(actor: Actor, id: number): Promise<SpkDetailResponse> {
    if (!actor.capabilities.has("spk.view") && !actor.capabilities.has("spk.create")) {
      throw new ActionRefusedError("detail", NOT_ALLOWED);
    }
    return this.unitOfWork.run(async (gateways) => {
      const role = actor.user.role ?? "Planner";
      const spk = await gateways.spks.detail(actor.user.id, role, id);
      if (!spk) throw new SpkNotFoundError();
      return { spk: this.mapDetailRowToDetail(spk) };
    });
  }

  private mapDetailRowToDetail(row: any): SpkDetail {
    return {
      id: row.id,
      spkNumber: row.spkNumber,
      vehicle: row.vehicle,
      title: row.title,
      category: row.category,
      priority: row.priority as SpkPriority,
      requiresDowntime: row.requiresDowntime,
      description: row.description,
      requestSource: row.requestSource,
      status: row.status,
      stepCount: row.stepCount,
      version: row.version,
      findingNote: row.findingNote ?? "",
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      activatedAt: row.activatedAt,
      startedAt: row.startedAt,
      completionRequestedAt: row.completionRequestedAt,
      completionApprovedBy: row.completionApprovedBy,
      completedAt: row.completedAt,
      cancelledBy: row.cancelledBy,
      cancelReason: row.cancelReason ?? "",
      laborCost: row.laborCost,
      partsCost: row.partsCost,
      documentCost: row.documentCost,
      stooringCost: row.stooringCost,
      offDays: row.offDays,
      createdByName: row.createdByName ?? "",
      approvedByName: row.approvedByName ?? "",
      plannedDay: row.plannedDay ?? "",
      assignments: row.assignments ?? [],
      approvals: row.approvals ?? [],
      costBreakdown: row.costBreakdown ?? { parts: 0, services: 0, documents: 0, stooring: 0, offUnit: 0, total: 0 },
      history: row.history ?? [],
      changeRequests: row.changeRequests ?? [],
      partLines: row.partLines ?? [],
      serviceLines: row.serviceLines ?? [],
      allowedActions: row.allowedActions ?? [],
    };
  }

  create(actor: Actor, request: SpkRequest): Promise<Spk> {
    this.requireCreate(actor);
    return this.unitOfWork.run(async (gateways) => {
      await this.checkVehicle(gateways, request.vehicleId);
      const spkNumber = await gateways.numbers.next("SPK", this.clock.now());
      const id = await gateways.spks.insert({
        ...fieldsOf(request),
        requestSource: actor.user.role === "Planner" ? "Manual_Planner" : "Manual_Admin",
        createdBy: actor.user.id,
        spkNumber,
      });
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, "create", null, after);
      return this.view(actor, after);
    });
  }

  update(actor: Actor, id: number, request: SpkUpdateRequest): Promise<Spk> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      assertAllowed(SPK_POLICIES, actor, before, "edit");
      await this.checkVehicle(gateways, request.vehicleId);
      await gateways.spks.update(id, request.version, fieldsOf(request));
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, "update", before, after);
      return this.view(actor, after);
    });
  }

  submit(actor: Actor, id: number, request: SpkSubmitRequest): Promise<Spk> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      assertAllowed(SPK_POLICIES, actor, before, "submit");
      if (before.stepCount === 0) throw new ActionRefusedError("submit", SPK_MESSAGES.noStep);
      const role = actor.user.role;
      if (!role) throw new ActionRefusedError("submit", NOT_ALLOWED);
      await this.checkVehicle(gateways, before.vehicleId);
      await gateways.spks.setStatus(id, request.version, "Pending_Approval");
      await gateways.spks.insertApproval({
        spkId: id,
        stage: "Creation",
        action: "Submit",
        actedBy: actor.user.id,
        approverRole: role,
      });
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, id, "submit", before, after);
      await this.notifyApprovers(gateways, after, request.version);
      return this.view(actor, after);
    });
  }

  private async notifyApprovers(gateways: SpkGateways, spk: SpkRow, version: number) {
    const roles = [...APPROVER_ROLES];
    const switchState = await gateways.plannerApproval.read();
    if (
      plannerApprovalOn(switchState, this.clock.now()) &&
      switchState.kinds.includes("spk_creation")
    ) {
      roles.push("Planner");
    }
    const recipients = await gateways.notifications.activeUsersWithRoles(roles);
    await gateways.notifications.send(recipients, {
      kind: "Approval",
      title: spk.spkNumber + " waits for your approval",
      body: (spk.priority === "Normal" ? "" : spk.priority + " \u00b7 ") + "Creation approval \u00b7 " + spk.vehicle.licensePlate + " \u00b7 " + spk.title,
      linkRecord: "/spk/" + spk.id,
      dedupeKey: "spk:" + spk.id + ":creation-submit:v" + version,
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

  private async checkVehicle(gateways: SpkGateways, vehicleId: number): Promise<void> {
    const vehicle = await gateways.spks.vehicle(vehicleId);
    if (!vehicle) throw new SpkInvalidError(SPK_MESSAGES.unknownVehicle);
    if (vehicle.status === "Inactive") throw new SpkInvalidError(SPK_MESSAGES.inactiveVehicle);
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
      entity: "spk",
      entityId: id,
      action,
      ...(before ? { before } : {}),
      after,
      userId: actor.user.id,
      userRole: actor.user.role,
    });
  }

  private requireCreate(actor: Actor): void {
    if (!actor.capabilities.has("spk.create")) {
      throw new ActionRefusedError("create", NOT_ALLOWED);
    }
  }
}