import type { Role } from '@bmi/shared';
import { and, asc, eq, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type {
  AccountGateway,
  AccountGateways,
  AccountRow,
  AuditEntry,
  AuditGateway,
} from '../../ports/accounts.js';
import { iamGateways } from './iam-gateways.js';
import { auditLogs, authSessions, userRoles, users } from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleAccountGateway implements AccountGateway {
  constructor(private readonly tx: DbTransaction) {}

  list(): Promise<AccountRow[]> {
    return this.select(isNull(users.deletedAt));
  }

  async findById(id: number): Promise<AccountRow | null> {
    const [row] = await this.select(and(eq(users.id, id), isNull(users.deletedAt)) as SQL);
    return row ?? null;
  }

  async emailTaken(email: string, exceptId?: number): Promise<boolean> {
    const sameEmail = sql`lower(${users.email}) = ${email.toLowerCase()}`;
    const [row] = await this.tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          sameEmail,
          isNull(users.deletedAt),
          exceptId === undefined ? undefined : ne(users.id, exceptId),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async create(account: { name: string; email: string; passwordHash: string }): Promise<number> {
    const [row] = await this.tx
      .insert(users)
      .values({ ...account, mustChangePassword: true })
      .returning({ id: users.id });
    if (!row) throw new Error('users insert returned no row');
    return row.id;
  }

  async rename(id: number, account: { name: string; email: string }): Promise<void> {
    await this.tx
      .update(users)
      .set({ ...account, updatedAt: sql`now()` })
      .where(eq(users.id, id));
  }

  async setRole(id: number, role: Role | null): Promise<void> {
    await this.tx.delete(userRoles).where(eq(userRoles.userId, id));
    if (role) await this.tx.insert(userRoles).values({ userId: id, role });
  }

  async setActive(id: number, active: boolean): Promise<void> {
    await this.tx
      .update(users)
      .set({ isActive: active, updatedAt: sql`now()` })
      .where(eq(users.id, id));
  }

  async countActiveAccessManagers(): Promise<number> {
    const [row] = await this.tx
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .where(
        and(
          eq(userRoles.role, 'Access_Manager'),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    return row?.count ?? 0;
  }

  async systemAdminId(): Promise<number | null> {
    const [row] = await this.tx
      .select({ id: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.role, 'System_Admin'))
      .for('update');
    return row?.id ?? null;
  }

  private async select(condition: SQL | undefined): Promise<AccountRow[]> {
    const lastSignIn =
      sql`(SELECT max(${authSessions.createdAt}) FROM ${authSessions} WHERE ${authSessions.userId} = ${users.id})`.mapWith(
        authSessions.createdAt,
      );
    const rows = await this.tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: userRoles.role,
        isActive: users.isActive,
        lockedUntil: users.lockedUntil,
        lastSignInAt: lastSignIn,
      })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .where(condition)
      .orderBy(asc(users.name), asc(users.id));
    return rows.map((row) => ({
      ...row,
      role: (row.role as Role | null) ?? null,
      lastSignInAt: (row.lastSignInAt as Date | null) ?? null,
    }));
  }
}

export class DrizzleAuditGateway implements AuditGateway {
  constructor(private readonly tx: DbTransaction) {}

  async write(entry: AuditEntry): Promise<void> {
    await this.tx.insert(auditLogs).values({
      entity: entry.entity,
      entityId: entry.entityId,
      action: entry.action,
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason ?? null,
      userId: entry.userId,
      userRole: entry.userRole,
    });
  }
}

export const accountGateways = (tx: DbTransaction): AccountGateways => ({
  ...iamGateways(tx),
  accounts: new DrizzleAccountGateway(tx),
  audit: new DrizzleAuditGateway(tx),
});
