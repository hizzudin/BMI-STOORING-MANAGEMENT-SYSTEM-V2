import {
  isSwitchableCell,
  type PermissionCode,
  type Role,
  type RolePermissionCell,
  type RolePermissionsChangeRequest,
  type RolePermissionsResponse,
} from '@bmi/shared';
import type { RolePermissionGateways, RolePermissionRow } from '../../ports/role-permissions.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import { ActionRefusedError, NOT_ALLOWED, type Actor } from './actions.js';

export const ROLE_PERMISSION_MESSAGES = {
  locked: 'A locked cell is fixed by a business rule and cannot change.',
  switchable: 'Planner approval changes only with the Planner approval switch.',
} as const;

/** The changed cells of one save, as `{ role: { code: allowed } }` (DEC-117 audit record). */
type CellsByRole = Partial<Record<Role, Partial<Record<PermissionCode, boolean>>>>;

const keyOf = (role: Role, code: PermissionCode) => `${role}|${code}`;

/** The matrix is one record: its audit rows carry entity_id 0 (DEC-117). */
const MATRIX_ID = 0;

/** REQ-IAM-005, REQ-IAM-012, DEC-115, DEC-117: the Access Manager's permission matrix. */
export class RolePermissionService {
  constructor(private readonly unitOfWork: UnitOfWork<RolePermissionGateways>) {}

  matrix(actor: Actor): Promise<RolePermissionsResponse> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) =>
      this.view(actor, await gateways.rolePermissions.list()),
    );
  }

  /** Every staged cell in one transaction, or none; one audit record of what really changed. */
  change(actor: Actor, request: RolePermissionsChangeRequest): Promise<RolePermissionsResponse> {
    this.requireManager(actor);
    return this.unitOfWork.run(async (gateways) => {
      const rows = await gateways.rolePermissions.list({ forUpdate: true });
      const byKey = new Map(rows.map((row) => [keyOf(row.role, row.permissionCode), row]));
      const before: CellsByRole = {};
      const after: CellsByRole = {};
      for (const change of request.changes) {
        if (isSwitchableCell(change.role, change.permissionCode)) {
          throw new ActionRefusedError('edit', ROLE_PERMISSION_MESSAGES.switchable);
        }
        const row = byKey.get(keyOf(change.role, change.permissionCode));
        // A cell outside the catalogue × roles does not exist, so it is fixed like a locked one.
        if (!row || row.isLocked)
          throw new ActionRefusedError('edit', ROLE_PERMISSION_MESSAGES.locked);
        if (row.allowed === change.allowed) continue;
        (before[row.role] ??= {})[row.permissionCode] = row.allowed;
        (after[row.role] ??= {})[row.permissionCode] = change.allowed;
        await gateways.rolePermissions.setAllowed(row.role, row.permissionCode, change.allowed);
        row.allowed = change.allowed;
      }
      if (Object.keys(after).length > 0) {
        await gateways.audit.write({
          entity: 'role_permissions',
          entityId: MATRIX_ID,
          action: 'change',
          before,
          after,
          userId: actor.user.id,
          userRole: actor.user.role,
        });
      }
      return this.view(actor, rows);
    });
  }

  private view(actor: Actor, rows: RolePermissionRow[]): RolePermissionsResponse {
    const cells: RolePermissionCell[] = rows.map((row) => ({
      ...row,
      switchable: isSwitchableCell(row.role, row.permissionCode),
    }));
    return { cells, allowedActions: actor.capabilities.has('accounts.manage') ? ['edit'] : [] };
  }

  private requireManager(actor: Actor): void {
    if (!actor.capabilities.has('accounts.manage')) {
      throw new ActionRefusedError('role_permissions', NOT_ALLOWED);
    }
  }
}
