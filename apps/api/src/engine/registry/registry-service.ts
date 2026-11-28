import type { AssignmentModule, ModuleStatusChangeRequest } from '@bmi/shared';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from '../../core/iam/actions.js';
import { runIdempotent, type IdempotentResponse } from '../../core/idempotency/run-idempotent.js';
import type { ClockPort } from '../../ports/clock.js';
import type { IdempotentRequest } from '../../ports/idempotency.js';
import type { ModuleCatalog, RegistryGateways, StoredModuleRow } from '../../ports/registry.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';

export const REGISTRY_MESSAGES = {
  notFound: 'This module was not found.',
  unavailable: 'This module is not available for new steps.',
  alreadyActive: 'This module is already active.',
  alreadyInactive: 'This module is already inactive.',
} as const;

/** HTTP 404. */
export class ModuleNotFoundError extends Error {
  constructor() {
    super(REGISTRY_MESSAGES.notFound);
    this.name = 'ModuleNotFoundError';
  }
}

/** HTTP 409: deactivating an inactive module or activating an active one. */
export class ModuleStateConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModuleStateConflictError';
  }
}

/** HTTP 409 (REQ-REG-005): a new step of an inactive or unimplemented module. */
export class ModuleUnavailableError extends Error {
  constructor() {
    super(REGISTRY_MESSAGES.unavailable);
    this.name = 'ModuleUnavailableError';
  }
}

/**
 * TASK-203 (specs/design.md 5.26, REQ-REG-002, REQ-REG-005, DEC-148): the registry rows with
 * whether each is offered, and their deactivation and activation by `registry.manage`.
 */
export class RegistryService {
  constructor(
    private readonly unitOfWork: UnitOfWork<RegistryGateways>,
    private readonly catalog: ModuleCatalog,
    private readonly clock: ClockPort,
  ) {}

  /** REQ-REG-002: every row by `sort_order`, then name; offered = active and implemented. */
  async list(): Promise<AssignmentModule[]> {
    const rows = await this.unitOfWork.run(({ modules }) => modules.list());
    return rows
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((row) => this.toItem(row));
  }

  /**
   * REQ-REG-005, DEC-149: the check of every way a step is added (Create SPK, presets, change
   * requests, system drafts); an inactive or unimplemented module stops new use. It runs on the
   * caller's own transaction and holds the module row, so a deactivation cannot slip in between
   * (ADR-0002 merge review 5).
   */
  async assertOfferable(gateways: Pick<RegistryGateways, 'modules'>, code: string): Promise<void> {
    const row = await gateways.modules.lock(code);
    if (!row) throw new ModuleNotFoundError();
    if (!this.toItem(row).offered) throw new ModuleUnavailableError();
  }

  deactivate(
    actor: Actor,
    code: string,
    request: ModuleStatusChangeRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return this.setActive(actor, code, false, request, key);
  }

  activate(
    actor: Actor,
    code: string,
    request: ModuleStatusChangeRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    return this.setActive(actor, code, true, request, key);
  }

  private async setActive(
    actor: Actor,
    code: string,
    isActive: boolean,
    request: ModuleStatusChangeRequest,
    key: Omit<IdempotentRequest, 'userId'>,
  ): Promise<IdempotentResponse> {
    const action = isActive ? 'activate' : 'deactivate';
    if (!actor.capabilities.has('registry.manage')) {
      throw new ActionRefusedError(action, NOT_ALLOWED);
    }
    return runIdempotent(this.unitOfWork, { ...key, userId: actor.user.id }, async (gateways) => {
      const row = await gateways.modules.lock(code);
      if (!row) throw new ModuleNotFoundError();
      // The row as it was, before the write.
      const before = { ...row };
      if (before.isActive === isActive) {
        throw new ModuleStateConflictError(
          isActive ? REGISTRY_MESSAGES.alreadyActive : REGISTRY_MESSAGES.alreadyInactive,
        );
      }
      await gateways.modules.setActive(code, isActive, this.clock.now());
      await gateways.audit.write({
        entity: 'assignment_module',
        entityId: row.id,
        action,
        before: { isActive: before.isActive },
        after: { isActive },
        reason: request.reason,
        userId: actor.user.id,
        userRole: actor.user.role,
      });
      return { status: 200, body: this.toItem({ ...before, isActive }) };
    });
  }

  private toItem(row: StoredModuleRow): AssignmentModule {
    const implemented = this.catalog.isImplemented(row.code);
    return {
      code: row.code,
      name: row.name,
      uiComponent: row.uiComponent,
      configSchema: row.configSchema,
      creationSchema: row.creationSchema,
      executorRoles: row.executorRoles,
      costKind: row.costKind,
      tracksWorkTime: row.tracksWorkTime,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      implemented,
      offered: implemented && row.isActive,
    };
  }
}
