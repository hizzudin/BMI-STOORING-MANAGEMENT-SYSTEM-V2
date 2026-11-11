import {
  blankToNull,
  type Vehicle,
  type VehicleClassOption,
  type VehicleDeactivateRequest,
  type VehicleListResponse,
  type VehicleRequest,
  type VehicleUpdateRequest,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { VehicleClassRow } from '../../ports/vehicle-classes.js';
import type {
  VehicleActivity,
  VehicleActivityGateway,
  VehicleFields,
  VehicleGateways,
  VehicleRow,
} from '../../ports/vehicles.js';
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  NOT_ALLOWED,
  type Actor,
  type Policies,
  type Rule,
} from '../iam/actions.js';

const joinAnd = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;

export const VEHICLE_MESSAGES = {
  notFound: 'This vehicle does not exist.',
  plateTaken: 'Another vehicle already uses this plate.',
  vinTaken: 'Another vehicle already uses this VIN.',
  unknownClass: 'Choose the class from the list.',
  towedOdometer: 'A towed unit has no odometer: leave it empty.',
  inactive: 'This vehicle is Inactive; its history stays readable.',
  /** REQ-VEH-004: a vehicle with an open SPK stays active. */
  openSpk: (numbers: readonly string[]) =>
    `${joinAnd(numbers)} ${numbers.length === 1 ? 'is' : 'are'} open: close ${
      numbers.length === 1 ? 'it' : 'them'
    } before deactivating the vehicle.`,
} as const;

/** REQ-VEH-003, DEC-17: why the class and layout cannot change now, or null. */
export function classLockOf(activity: VehicleActivity): string | null {
  const parts: string[] = [];
  if (activity.mountedTyres > 0) {
    parts.push(
      `${activity.mountedTyres} ${activity.mountedTyres === 1 ? 'tyre is' : 'tyres are'} mounted`,
    );
  }
  if (activity.openSpks.length > 0) {
    parts.push(
      `${joinAnd(activity.openSpks)} ${activity.openSpks.length === 1 ? 'is' : 'are'} open`,
    );
  }
  return parts.length === 0 ? null : `Class is locked: ${parts.join(' and ')}.`;
}

/** 404: no vehicle with this id. */
export class VehicleNotFoundError extends Error {
  constructor() {
    super(VEHICLE_MESSAGES.notFound);
    this.name = 'VehicleNotFoundError';
  }
}

/** 409: the plate or VIN is taken (TX-18). */
export class VehicleConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleConflictError';
  }
}

/** 400: an unknown class, or an odometer for a towed unit. */
export class VehicleInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VehicleInvalidError';
  }
}

interface VehicleRecord {
  row: VehicleRow;
  activity: VehicleActivity;
}

const NONE: VehicleActivity = { mountedTyres: 0, openSpks: [] };

const notInactive: Rule<VehicleRecord> = (_actor, record) =>
  record.row.status === 'Inactive' ? VEHICLE_MESSAGES.inactive : null;

/** REQ-VEH-003, REQ-VEH-004, DEC-17: one table answers "may I?" and the allowedActions list. */
const VEHICLE_POLICIES: Policies<VehicleRecord, 'edit' | 'change_class' | 'deactivate'> = {
  edit: { anyOf: ['vehicle.manage'], rules: [notInactive] },
  change_class: {
    anyOf: ['vehicle.manage'],
    rules: [notInactive, (_actor, record) => classLockOf(record.activity)],
  },
  deactivate: {
    anyOf: ['vehicle.manage'],
    rules: [
      notInactive,
      (_actor, record) =>
        record.activity.openSpks.length > 0
          ? VEHICLE_MESSAGES.openSpk(record.activity.openSpks)
          : null,
    ],
  },
};

const layoutOf = (layout: VehicleRow['layout']) => ({
  id: layout.id,
  version: layout.version,
  definition: layout.definition,
  axleCount: layout.axleCount,
  tyreCount: layout.tyreCount,
});

const option = (row: VehicleClassRow): VehicleClassOption => ({
  id: row.id,
  name: row.name,
  unitKind: row.unitKind,
  layout: layoutOf(row.layout),
});

const fieldsOf = (request: VehicleRequest | VehicleUpdateRequest): VehicleFields => ({
  licensePlate: request.licensePlate,
  vin: blankToNull(request.vin),
  engineNumber: blankToNull(request.engineNumber),
  brand: blankToNull(request.brand),
  model: blankToNull(request.model),
  year: request.year,
  fuelType: blankToNull(request.fuelType),
});

/** REQ-VEH-001 to REQ-VEH-004, REQ-PLC-018, DEC-17, DEC-122: the vehicle master. */
export class VehicleService {
  constructor(
    private readonly unitOfWork: UnitOfWork<VehicleGateways>,
    private readonly activity: VehicleActivityGateway,
    private readonly clock: ClockPort,
  ) {}

  /** REQ-VEH-001: every vehicle with its actions; the form classes only for vehicle.manage. */
  list(actor: Actor): Promise<VehicleListResponse> {
    this.requireViewer(actor);
    return this.unitOfWork.run(async ({ vehicles, vehicleClasses }) => {
      const rows = await vehicles.list();
      const activity = await this.activity.of(rows.map((row) => row.id));
      const manager = actor.capabilities.has('vehicle.manage');
      return {
        vehicles: rows.map((row) =>
          this.view(actor, { row, activity: activity.get(row.id) ?? NONE }),
        ),
        classes: manager ? (await vehicleClasses.list()).map(option) : [],
        allowedActions: manager ? ['create'] : [],
      };
    });
  }

  get(actor: Actor, id: number): Promise<Vehicle> {
    this.requireViewer(actor);
    return this.unitOfWork.run(async (gateways) =>
      this.view(actor, await this.record(gateways, id)),
    );
  }

  /** REQ-VEH-002: the counts come from the class layout; the odometer only for a Powered unit. */
  create(actor: Actor, request: VehicleRequest): Promise<Vehicle> {
    if (!actor.capabilities.has('vehicle.manage')) {
      throw new ActionRefusedError('create', NOT_ALLOWED);
    }
    return this.unitOfWork.run(async (gateways) => {
      const vehicleClass = await this.activeClass(gateways, request.vehicleClassId);
      if (vehicleClass.unitKind === 'Towed' && (request.odometer ?? 0) > 0) {
        throw new VehicleInvalidError(VEHICLE_MESSAGES.towedOdometer);
      }
      await this.checkUnique(gateways, request);
      const id = await gateways.vehicles.insert({
        ...fieldsOf(request),
        vehicleClassId: vehicleClass.id,
        chassisLayoutId: vehicleClass.layout.id,
        currentOdometer: vehicleClass.unitKind === 'Towed' ? 0 : (request.odometer ?? 0),
      });
      const after = await this.record(gateways, id);
      await gateways.audit.write({
        entity: 'vehicle',
        entityId: id,
        action: 'create',
        after: after.row,
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return this.view(actor, after);
    });
  }

  /** REQ-VEH-003: an edit with a reason; a new class takes its layout unless DEC-17 locks it. */
  update(actor: Actor, id: number, request: VehicleUpdateRequest): Promise<Vehicle> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.record(gateways, id, true);
      assertAllowed(VEHICLE_POLICIES, actor, before, 'edit');
      const values: Parameters<VehicleGateways['vehicles']['update']>[2] = fieldsOf(request);
      if (request.vehicleClassId !== before.row.vehicleClass.id) {
        assertAllowed(VEHICLE_POLICIES, actor, before, 'change_class');
        const vehicleClass = await this.activeClass(gateways, request.vehicleClassId);
        values.vehicleClassId = vehicleClass.id;
        values.chassisLayoutId = vehicleClass.layout.id;
        // REQ-PLC-018: a towed unit has no odometer.
        if (vehicleClass.unitKind === 'Towed') values.currentOdometer = 0;
      }
      await this.checkUnique(gateways, request, id);
      await gateways.vehicles.update(id, request.version, values);
      const after = await this.record(gateways, id);
      await gateways.audit.write({
        entity: 'vehicle',
        entityId: id,
        action: 'update',
        before: before.row,
        after: after.row,
        reason: request.reason,
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return this.view(actor, after);
    });
  }

  /** REQ-VEH-004, BR-10: Inactive with a reason, never deleted; refused while an SPK is open. */
  deactivate(actor: Actor, id: number, request: VehicleDeactivateRequest): Promise<Vehicle> {
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.record(gateways, id, true);
      assertAllowed(VEHICLE_POLICIES, actor, before, 'deactivate');
      await gateways.vehicles.update(id, before.row.version, {
        status: 'Inactive',
        deactivateReason: request.reason,
        deactivatedAt: this.clock.now(),
      });
      const after = await this.record(gateways, id);
      await gateways.audit.write({
        entity: 'vehicle',
        entityId: id,
        action: 'deactivate',
        before: before.row,
        after: after.row,
        reason: request.reason,
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return this.view(actor, after);
    });
  }

  private view(actor: Actor, record: VehicleRecord): Vehicle {
    const { row } = record;
    return {
      id: row.id,
      licensePlate: row.licensePlate,
      vin: row.vin,
      engineNumber: row.engineNumber,
      brand: row.brand,
      model: row.model,
      year: row.year,
      fuelType: row.fuelType,
      vehicleClass: { ...row.vehicleClass },
      layout: layoutOf(row.layout),
      currentOdometer: row.currentOdometer,
      status: row.status,
      deactivateReason: row.deactivateReason,
      version: row.version,
      classLock: classLockOf(record.activity),
      allowedActions: allowedActions(VEHICLE_POLICIES, actor, record),
    };
  }

  private async record(
    gateways: VehicleGateways,
    id: number,
    forUpdate = false,
  ): Promise<VehicleRecord> {
    const row = await gateways.vehicles.findById(id, { forUpdate });
    if (!row) throw new VehicleNotFoundError();
    const activity = await this.activity.of([id]);
    return { row, activity: activity.get(id) ?? NONE };
  }

  private async activeClass(gateways: VehicleGateways, id: number): Promise<VehicleClassRow> {
    const found = (await gateways.vehicleClasses.list()).find((c) => c.id === id);
    if (!found) throw new VehicleInvalidError(VEHICLE_MESSAGES.unknownClass);
    return found;
  }

  private async checkUnique(
    gateways: VehicleGateways,
    request: VehicleRequest | VehicleUpdateRequest,
    exceptId?: number,
  ): Promise<void> {
    if (await gateways.vehicles.plateTaken(request.licensePlate, exceptId)) {
      throw new VehicleConflictError(VEHICLE_MESSAGES.plateTaken);
    }
    if (request.vin && (await gateways.vehicles.vinTaken(request.vin, exceptId))) {
      throw new VehicleConflictError(VEHICLE_MESSAGES.vinTaken);
    }
  }

  private requireViewer(actor: Actor): void {
    if (!actor.capabilities.has('vehicle.view') && !actor.capabilities.has('vehicle.manage')) {
      throw new ActionRefusedError('view', NOT_ALLOWED);
    }
  }
}
