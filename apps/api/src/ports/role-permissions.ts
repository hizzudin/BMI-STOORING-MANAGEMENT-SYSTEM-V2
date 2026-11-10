import type { PermissionCode, Role } from '@bmi/shared';
import type { AuditGateway } from './accounts.js';

/** §9.2 role_permissions: one cell of the matrix. */
export interface RolePermissionRow {
  role: Role;
  permissionCode: PermissionCode;
  allowed: boolean;
  isLocked: boolean;
}

export interface RolePermissionGateway {
  /** Every cell; `forUpdate` holds the rows until the transaction ends, so two saves do not interleave. */
  list(options?: { forUpdate?: boolean }): Promise<RolePermissionRow[]>;
  setAllowed(role: Role, permissionCode: PermissionCode, allowed: boolean): Promise<void>;
}

export interface RolePermissionGateways {
  rolePermissions: RolePermissionGateway;
  audit: AuditGateway;
}
