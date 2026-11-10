import type { Client, Role } from '@bmi/shared';
import { and, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type {
  AuthSession,
  AuthSessionGateway,
  AuthUser,
  CapabilityGateway,
  IamGateways,
  PasswordResetGateway,
  PasswordResetToken,
  UserGateway,
} from '../../ports/iam.js';
import {
  appSettings,
  authSessions,
  passwordResetTokens,
  rolePermissions,
  userRoles,
  users,
} from './schema/index.js';
import type { DbTransaction } from './unit-of-work.js';

export class DrizzleUserGateway implements UserGateway {
  constructor(private readonly tx: DbTransaction) {}

  findByEmail(email: string): Promise<AuthUser | null> {
    return this.findOne(sql`lower(${users.email}) = ${email.toLowerCase()}`);
  }

  findById(id: number): Promise<AuthUser | null> {
    return this.findOne(eq(users.id, id));
  }

  async saveSignInState(
    id: number,
    state: { failedLogins: number; lockedUntil: Date | null },
  ): Promise<void> {
    await this.tx
      .update(users)
      .set({
        failedLogins: state.failedLogins,
        lockedUntil: state.lockedUntil,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, id));
  }

  async setPassword(id: number, passwordHash: string, mustChange: boolean): Promise<void> {
    await this.tx
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: mustChange,
        failedLogins: 0,
        lockedUntil: null,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, id));
  }

  private async findOne(condition: SQL): Promise<AuthUser | null> {
    const [row] = await this.tx
      .select({ user: users, role: userRoles.role })
      .from(users)
      .leftJoin(userRoles, eq(userRoles.userId, users.id))
      .where(condition)
      .limit(1);
    if (!row) return null;
    const { user, role } = row;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive,
      deleted: user.deletedAt !== null,
      failedLogins: user.failedLogins,
      mustChangePassword: user.mustChangePassword,
      lockedUntil: user.lockedUntil,
      role: (role as Role | null) ?? null,
    };
  }
}

const toSession = (row: typeof authSessions.$inferSelect): AuthSession => ({
  id: row.id,
  userId: row.userId,
  client: row.client as Client,
  lastSeenAt: row.lastSeenAt,
  expiresAt: row.expiresAt,
  revokedAt: row.revokedAt,
});

export class DrizzleAuthSessionGateway implements AuthSessionGateway {
  constructor(private readonly tx: DbTransaction) {}

  async create(session: {
    userId: number;
    client: Client;
    refreshTokenHash: string;
    lastSeenAt: Date;
    expiresAt: Date;
  }): Promise<number> {
    const [row] = await this.tx
      .insert(authSessions)
      .values(session)
      .returning({ id: authSessions.id });
    if (!row) throw new Error('auth_sessions insert returned no row');
    return row.id;
  }

  async findById(id: number): Promise<AuthSession | null> {
    const [row] = await this.tx.select().from(authSessions).where(eq(authSessions.id, id));
    return row ? toSession(row) : null;
  }

  async findByRefreshHash(hash: string): Promise<AuthSession | null> {
    // FOR UPDATE: two refreshes with the same token cannot both rotate it.
    const [row] = await this.tx
      .select()
      .from(authSessions)
      .where(eq(authSessions.refreshTokenHash, hash))
      .for('update');
    return row ? toSession(row) : null;
  }

  async rotate(id: number, refreshTokenHash: string, at: Date): Promise<void> {
    await this.tx
      .update(authSessions)
      .set({ refreshTokenHash, lastSeenAt: at, updatedAt: sql`now()` })
      .where(eq(authSessions.id, id));
  }

  async touch(id: number, at: Date): Promise<void> {
    await this.tx
      .update(authSessions)
      .set({ lastSeenAt: at, updatedAt: sql`now()` })
      .where(eq(authSessions.id, id));
  }

  async revoke(id: number, at: Date): Promise<void> {
    await this.tx
      .update(authSessions)
      .set({ revokedAt: at, updatedAt: sql`now()` })
      .where(and(eq(authSessions.id, id), isNull(authSessions.revokedAt)));
  }

  async revokeAllForUser(userId: number, at: Date, keepSessionId?: number): Promise<void> {
    const open = and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt));
    await this.tx
      .update(authSessions)
      .set({ revokedAt: at, updatedAt: sql`now()` })
      .where(keepSessionId === undefined ? open : and(open, ne(authSessions.id, keepSessionId)));
  }
}

export class DrizzlePasswordResetGateway implements PasswordResetGateway {
  constructor(private readonly tx: DbTransaction) {}

  async voidOpen(userId: number, at: Date): Promise<void> {
    await this.tx
      .update(passwordResetTokens)
      .set({ usedAt: at, updatedAt: sql`now()` })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  }

  async create(token: { userId: number; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.tx.insert(passwordResetTokens).values(token);
  }

  async findByHash(hash: string): Promise<PasswordResetToken | null> {
    const [row] = await this.tx
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, hash))
      .for('update');
    return row
      ? { id: row.id, userId: row.userId, expiresAt: row.expiresAt, usedAt: row.usedAt }
      : null;
  }

  async markUsed(id: number, at: Date): Promise<void> {
    await this.tx
      .update(passwordResetTokens)
      .set({ usedAt: at, updatedAt: sql`now()` })
      .where(eq(passwordResetTokens.id, id));
  }
}

const PLANNER_APPROVAL_KINDS = 'planner_approval_kinds';
const PLANNER_APPROVAL_UNTIL = 'planner_approval_until';
const SYSTEM_MODE = 'system_mode';

/** role_permissions and the app_settings keys of 2.4 (REQ-IAM-008, REQ-IAM-010). */
export class DrizzleCapabilityGateway implements CapabilityGateway {
  constructor(private readonly tx: DbTransaction) {}

  async allowedCodes(role: Role): Promise<string[]> {
    const rows = await this.tx
      .select({ code: rolePermissions.permissionCode })
      .from(rolePermissions)
      .where(and(eq(rolePermissions.role, role), eq(rolePermissions.allowed, true)));
    return rows.map((row) => row.code);
  }

  async plannerApproval(): Promise<{ kinds: string[]; until: Date | null }> {
    const settings = await this.settings([PLANNER_APPROVAL_KINDS, PLANNER_APPROVAL_UNTIL]);
    const kinds = settings.get(PLANNER_APPROVAL_KINDS);
    const until = settings.get(PLANNER_APPROVAL_UNTIL);
    return {
      kinds: Array.isArray(kinds)
        ? kinds.filter((kind): kind is string => typeof kind === 'string')
        : [],
      until: typeof until === 'string' ? new Date(until) : null,
    };
  }

  async systemMode(): Promise<'Setup' | 'Live'> {
    const mode = (await this.settings([SYSTEM_MODE])).get(SYSTEM_MODE);
    // REQ-IAM-010: the system starts in Setup mode until Go live writes Live.
    return mode === 'Live' ? 'Live' : 'Setup';
  }

  private async settings(keys: string[]): Promise<Map<string, unknown>> {
    const rows = await this.tx
      .select({ key: appSettings.settingKey, value: appSettings.settingValue })
      .from(appSettings)
      .where(inArray(appSettings.settingKey, keys));
    return new Map(rows.map((row) => [row.key, row.value]));
  }
}

export const iamGateways = (tx: DbTransaction): IamGateways => ({
  users: new DrizzleUserGateway(tx),
  sessions: new DrizzleAuthSessionGateway(tx),
  resets: new DrizzlePasswordResetGateway(tx),
  capabilities: new DrizzleCapabilityGateway(tx),
});
