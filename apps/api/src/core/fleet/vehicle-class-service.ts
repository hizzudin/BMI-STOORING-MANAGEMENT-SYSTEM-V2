import {
  generatePositions,
  layoutCounts,
  type ChassisDefinition,
  type LayoutVersionRequest,
  type VehicleClass,
  type VehicleClassListResponse,
  type VehicleClassRequest,
} from '@bmi/shared';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { VehicleClassGateways, VehicleClassRow } from '../../ports/vehicle-classes.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../iam/actions.js';

export const VEHICLE_CLASS_MESSAGES = {
  codeTaken: 'Another class already uses this code.',
  notFound: 'This vehicle class does not exist.',
} as const;

/** 404: the class does not exist. */
export class VehicleClassNotFoundError extends Error {
  constructor() {
    super(VEHICLE_CLASS_MESSAGES.notFound);
    this.name = 'VehicleClassNotFoundError';
  }
}

/** 409: the class code is taken (unique, case-insensitive). */
export class VehicleClassConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleClassConflictError';
  }
}

const view = (row: VehicleClassRow): VehicleClass => ({
  id: row.id,
  code: row.code,
  name: row.name,
  unitKind: row.unitKind,
  layout: { ...row.layout },
});

/** REQ-PLC-013, REQ-PLC-017, REQ-PLC-019, DEC-68, DEC-120: classes and their layout versions. */
export class VehicleClassService {
  constructor(private readonly unitOfWork: UnitOfWork<VehicleClassGateways>) {}

  list(actor: Actor): Promise<VehicleClassListResponse> {
    this.requireManager(actor);
    return this.unitOfWork.run(async ({ vehicleClasses }) => ({
      classes: (await vehicleClasses.list()).map(view),
      allowedActions: ['create', 'new_layout_version'],
    }));
  }

  /** New class: its first layout carries the class code, version 1, and generates its positions. */
  create(actor: Actor, request: VehicleClassRequest): Promise<VehicleClass> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      if (await gateways.vehicleClasses.codeTaken(request.code)) {
        throw new VehicleClassConflictError(VEHICLE_CLASS_MESSAGES.codeTaken);
      }
      const layoutId = await this.saveLayout(
        gateways,
        request.code,
        request.name,
        1,
        request.definition,
      );
      const id = await gateways.vehicleClasses.insertClass({
        code: request.code,
        name: request.name,
        unitKind: request.unitKind,
        layoutId,
      });
      const row = await this.load(gateways, id);
      await gateways.audit.write({
        entity: 'vehicle_class',
        entityId: id,
        action: 'create',
        after: { code: row.code, name: row.name, unitKind: row.unitKind, layout: row.layout },
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return view(row);
    });
  }

  /** Save as new layout version: the next version of the same code; vehicles keep theirs (DEC-120). */
  newLayoutVersion(
    actor: Actor,
    classId: number,
    request: LayoutVersionRequest,
  ): Promise<VehicleClass> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const before = await gateways.vehicleClasses.findById(classId, { forUpdate: true });
      if (!before) throw new VehicleClassNotFoundError();
      const version = (await gateways.vehicleClasses.latestVersion(before.layout.code)) + 1;
      const layoutId = await this.saveLayout(
        gateways,
        before.layout.code,
        before.name,
        version,
        request.definition,
      );
      await gateways.vehicleClasses.setDefaultLayout(classId, layoutId);
      const after = await this.load(gateways, classId);
      await gateways.audit.write({
        entity: 'vehicle_class',
        entityId: classId,
        action: 'new_layout_version',
        before: { layout: before.layout },
        after: { layout: after.layout },
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return view(after);
    });
  }

  /** REQ-PLC-013: saving a layout generates its positions (A<n>_L/R, A<n>_LO/LI/RI/RO, SP<n>). */
  private async saveLayout(
    gateways: VehicleClassGateways,
    code: string,
    name: string,
    version: number,
    definition: ChassisDefinition,
  ): Promise<number> {
    const layoutId = await gateways.vehicleClasses.insertLayout({
      code,
      name,
      version,
      definition,
      ...layoutCounts(definition),
    });
    await gateways.vehicleClasses.insertPositions(layoutId, generatePositions(definition));
    return layoutId;
  }

  private async load(gateways: VehicleClassGateways, id: number): Promise<VehicleClassRow> {
    const row = await gateways.vehicleClasses.findById(id);
    if (!row) throw new VehicleClassNotFoundError();
    return row;
  }

  private requireManager(actor: Actor): void {
    if (!actor.capabilities.has('masterdata.manage')) {
      throw new ActionRefusedError('vehicle_classes', NOT_ALLOWED);
    }
  }
}
