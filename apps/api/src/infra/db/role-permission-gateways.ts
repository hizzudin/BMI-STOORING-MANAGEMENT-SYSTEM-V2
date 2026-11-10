import type { PermissionCode, Role } from '@bmi/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import type {
  RolePermissionGateway,
  RolePermissionGateways,
  RolePermissionRow,
} from '../../ports/role-permissions.js';
import { DrizzleAuditGateway } from './account-gateways.js';
import { rolePermissions } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleRolePermissionGateway implements RolePermissionGateway {
  constructor(private readonly tx: DbTransaction) {}

  async list(options: { forUpdate?: boolean } = {}): Promise<RolePermissionRow[]> {
    const query = this.tx
      .select({
        role: rolePermissions.role,
        permissionCode: rolePermissions.permissionCode,
        allowed: rolePermissions.allowed,
        isLocked: rolePermissions.isLocked,
      })
      .from(rolePermissions)
      .orderBy(asc(rolePermissions.role), asc(rolePermissions.permissionCode));
    const rows = options.forUpdate ? await query.for('update') : await query;
    return rows.map((row) => ({
      ...row,
      role: row.role as Role,
      permissionCode: row.permissionCode as PermissionCode,
    }));
  }

  async setAllowed(role: Role, permissionCode: PermissionCode, allowed: boolean): Promise<void> {
    await this.tx
      .update(rolePermissions)
      .set({ allowed, updatedAt: sql`now()` })
      .where(
        and(eq(rolePermissions.role, role), eq(rolePermissions.permissionCode, permissionCode)),
      );
  }
}

export const rolePermissionGateways = (tx: DbTransaction): RolePermissionGateways => ({
  rolePermissions: new DrizzleRolePermissionGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
