import {
  VENDOR_MESSAGES,
  type Vendor,
  type VendorListResponse,
  type VendorOptionsQuery,
  type VendorOptionsResponse,
  type VendorRequest,
  type VendorUpdateRequest,
} from '@bmi/shared';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import type { VendorFields, VendorGateways, VendorRow } from '../../ports/vendors.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../iam/actions.js';

/** 404: no vendor with this id. */
export class VendorNotFoundError extends Error {
  constructor() {
    super(VENDOR_MESSAGES.notFound);
    this.name = 'VendorNotFoundError';
  }
}

/** 409: the code is taken. */
export class VendorConflictError extends Error {
  constructor() {
    super(VENDOR_MESSAGES.codeTaken);
    this.name = 'VendorConflictError';
  }
}

const view = (row: VendorRow): Vendor => ({ ...row });

const fieldsOf = (request: VendorUpdateRequest): VendorFields => ({
  name: request.name,
  kind: request.kind,
  phone: request.phone || null,
  address: request.address || null,
});

/** REQ-INV-014, DEC-134: the vendor master of the System Admin, and the pick list of later screens. */
export class VendorService {
  constructor(private readonly unitOfWork: UnitOfWork<VendorGateways>) {}

  list(actor: Actor): Promise<VendorListResponse> {
    this.requireManager(actor);
    return this.unitOfWork.run(async ({ vendors }) => ({
      vendors: (await vendors.list()).map(view),
      allowedActions: ['create', 'edit', 'deactivate', 'activate'],
    }));
  }

  /** REQ-INV-014: the active vendors to pick from, of one kind when asked. */
  options(query: VendorOptionsQuery): Promise<VendorOptionsResponse> {
    return this.unitOfWork.run(async ({ vendors }) => ({
      vendors: (await vendors.listActive(query.kind)).map(({ id, code, name, kind }) => ({
        id,
        code,
        name,
        kind,
      })),
    }));
  }

  /** C-31: a new vendor with a typed code (unique without regard to case). */
  create(actor: Actor, request: VendorRequest): Promise<Vendor> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      if (await gateways.vendors.codeTaken(request.code)) throw new VendorConflictError();
      const id = await gateways.vendors.insert(request.code, fieldsOf(request));
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, 'create', null, after);
      return view(after);
    });
  }

  /** C-17: one save of the fields, one audit record; the code is fixed once saved (DEC-134). */
  update(actor: Actor, id: number, request: VendorUpdateRequest): Promise<Vendor> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      await gateways.vendors.update(id, fieldsOf(request));
      const after = await this.load(gateways, id);
      await this.audit(gateways, actor, 'update', before, after);
      return view(after);
    });
  }

  /** C-32: no longer offered for picking; it stays listed as Inactive (DEC-134). */
  deactivate(actor: Actor, id: number): Promise<void> {
    return this.setActive(actor, id, false);
  }

  /** DEC-134: an inactive vendor is offered again. */
  activate(actor: Actor, id: number): Promise<void> {
    return this.setActive(actor, id, true);
  }

  private setActive(actor: Actor, id: number, active: boolean): Promise<void> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id, true);
      await gateways.vendors.setActive(id, active);
      const action = active ? 'activate' : 'deactivate';
      await this.audit(gateways, actor, action, before, { ...before, isActive: active });
    });
  }

  private async load(gateways: VendorGateways, id: number, forUpdate = false): Promise<VendorRow> {
    const row = await gateways.vendors.findById(id, { forUpdate });
    if (!row) throw new VendorNotFoundError();
    return row;
  }

  private audit(
    gateways: VendorGateways,
    actor: Actor,
    action: string,
    before: VendorRow | null,
    after: VendorRow,
  ): Promise<void> {
    return gateways.audit.write({
      entity: 'vendor',
      entityId: after.id,
      action,
      ...(before ? { before } : {}),
      after,
      userId: actor.user.id,
      userRole: actor.user.role,
    });
  }

  private requireManager(actor: Actor): void {
    if (!actor.capabilities.has('masterdata.manage')) {
      throw new ActionRefusedError('vendors', NOT_ALLOWED);
    }
  }
}
