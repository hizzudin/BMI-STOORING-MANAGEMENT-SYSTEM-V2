import type {
  Account,
  AccountAction,
  AccountRequest,
  AccountUpdateRequest,
  AccountsPageAction,
  AccountStatus,
  Role,
} from '@bmi/shared';
import type { ClockPort } from '../../ports/clock.js';
import type { AccountGateways, AccountRow } from '../../ports/accounts.js';
import type { PasswordHasher } from '../../ports/iam.js';
import type { UnitOfWork } from '../../ports/unit-of-work.js';
import {
  ActionRefusedError,
  allowedActions,
  assertAllowed,
  NOT_ALLOWED,
  type Actor,
  type Policies,
} from './actions.js';
import { temporaryPassword } from './auth-service.js';

/** 404: the account does not exist. */
export class AccountNotFoundError extends Error {
  constructor() {
    super('This account does not exist.');
    this.name = 'AccountNotFoundError';
  }
}

/** 409: another account already uses this email (TX-18: unique among live accounts). */
export class AccountConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountConflictError';
  }
}

export const ACCOUNT_MESSAGES = {
  emailTaken: 'Another account already uses this email.',
  systemAdminByMove: 'System Admin is given only with Move System Admin role.',
  systemAdminRoleLocked: 'Move the System Admin role to another account first.',
  ownRole: 'You cannot change your own role.',
  ownAccount: 'You cannot deactivate your own account.',
  lastAccessManager: 'The last active Access Manager must stay active and keep its role.',
  notLocked: 'This account is not locked.',
  inactive: 'Activate this account first.',
  alreadyActive: 'This account is already active.',
  moveTarget: 'Choose another active account for the System Admin role.',
} as const;

/** The record the account policies read: the row plus what the service knows around it. */
interface AccountRecord extends AccountRow {
  locked: boolean;
  lastActiveAccessManager: boolean;
}

const refuseWhen =
  (refused: (actor: Actor, record: AccountRecord) => boolean, message: string) =>
  (actor: Actor, record: AccountRecord) => (refused(actor, record) ? message : null);

/** REQ-IAM-002, BR-14, DEC-116: one policy per action; the list and the check share it. */
const ACCOUNT_POLICIES: Policies<AccountRecord, AccountAction> = {
  edit: { anyOf: ['accounts.manage'] },
  unlock: {
    anyOf: ['accounts.manage'],
    rules: [refuseWhen((_a, r) => !r.locked, ACCOUNT_MESSAGES.notLocked)],
  },
  reset_password: {
    anyOf: ['accounts.manage'],
    rules: [refuseWhen((_a, r) => !r.isActive, ACCOUNT_MESSAGES.inactive)],
  },
  deactivate: {
    anyOf: ['accounts.manage'],
    rules: [
      refuseWhen((_a, r) => !r.isActive, ACCOUNT_MESSAGES.inactive),
      refuseWhen((_a, r) => r.role === 'System_Admin', ACCOUNT_MESSAGES.systemAdminRoleLocked),
      refuseWhen((a, r) => a.user.id === r.id, ACCOUNT_MESSAGES.ownAccount),
      refuseWhen((_a, r) => r.lastActiveAccessManager, ACCOUNT_MESSAGES.lastAccessManager),
    ],
  },
  activate: {
    anyOf: ['accounts.manage'],
    rules: [refuseWhen((_a, r) => r.isActive, ACCOUNT_MESSAGES.alreadyActive)],
  },
};

function statusOf(row: AccountRow, now: Date): AccountStatus {
  if (!row.isActive) return 'Inactive';
  return row.lockedUntil && row.lockedUntil > now ? 'Locked' : 'Active';
}

const auditView = (row: AccountRow) => ({
  name: row.name,
  email: row.email,
  role: row.role,
  isActive: row.isActive,
});

/** REQ-IAM-002 to REQ-IAM-004, REQ-IAM-009, BR-14, RL-1, RL-4, DEC-116. */
export class AccountService {
  constructor(
    private readonly unitOfWork: UnitOfWork<AccountGateways>,
    private readonly hasher: PasswordHasher,
    private readonly clock: ClockPort,
  ) {}

  /** Users and roles: every account with its own allowed actions, and the page actions. */
  list(actor: Actor): Promise<{ accounts: Account[]; allowedActions: AccountsPageAction[] }> {
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      const managers = await gateways.accounts.countActiveAccessManagers();
      const rows = await gateways.accounts.list();
      return {
        accounts: rows.map((row) => this.view(actor, this.record(row, managers, now), now)),
        allowedActions: actor.capabilities.has('accounts.manage')
          ? ['create', 'move_system_admin']
          : [],
      };
    });
  }

  /** FLW-AM-01: a new account with one role and a temporary password (REQ-IAM-009). */
  async create(
    actor: Actor,
    request: AccountRequest,
  ): Promise<{ account: Account; temporaryPassword: string }> {
    this.requireManager(actor);
    const role = this.assignable(request.role);
    const temporary = temporaryPassword();
    const passwordHash = await this.hasher.hash(temporary);
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      if (await gateways.accounts.emailTaken(request.email)) {
        throw new AccountConflictError(ACCOUNT_MESSAGES.emailTaken);
      }
      const id = await gateways.accounts.create({
        name: request.name,
        email: request.email,
        passwordHash,
      });
      await gateways.accounts.setRole(id, role);
      const row = await this.load(gateways, id);
      await gateways.audit.write({
        ...this.by(actor),
        entity: 'user',
        entityId: id,
        action: 'create',
        after: auditView(row),
      });
      return {
        account: await this.viewOf(gateways, actor, row, now),
        temporaryPassword: temporary,
      };
    });
  }

  /** Edit name, email and the one role (RL-1, AC-IAM-004, BR-14, DEC-116). */
  update(actor: Actor, id: number, request: AccountUpdateRequest): Promise<Account> {
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id);
      await this.check(gateways, actor, before, 'edit', now);
      const role = request.role;
      if (role !== before.role) {
        if (role === 'System_Admin') this.refuse('edit', ACCOUNT_MESSAGES.systemAdminByMove);
        if (before.role === 'System_Admin')
          this.refuse('edit', ACCOUNT_MESSAGES.systemAdminRoleLocked);
        if (actor.user.id === id) this.refuse('edit', ACCOUNT_MESSAGES.ownRole);
        if (before.role === 'Access_Manager' && before.isActive) {
          if ((await gateways.accounts.countActiveAccessManagers()) <= 1) {
            this.refuse('edit', ACCOUNT_MESSAGES.lastAccessManager);
          }
        }
      }
      if (await gateways.accounts.emailTaken(request.email, id)) {
        throw new AccountConflictError(ACCOUNT_MESSAGES.emailTaken);
      }
      await gateways.accounts.rename(id, { name: request.name, email: request.email });
      if (role !== before.role) await gateways.accounts.setRole(id, role);
      const after = await this.load(gateways, id);
      await gateways.audit.write({
        ...this.by(actor),
        entity: 'user',
        entityId: id,
        action: role !== before.role ? 'role_change' : 'edit',
        before: auditView(before),
        after: auditView(after),
      });
      return this.viewOf(gateways, actor, after, now);
    });
  }

  /** REQ-IAM-001: the Access Manager unlocks after 5 failed sign-ins. */
  unlock(actor: Actor, id: number): Promise<Account> {
    return this.act(actor, id, 'unlock', async (gateways) => {
      await gateways.users.saveSignInState(id, { failedLogins: 0, lockedUntil: null });
    });
  }

  /** DEC-116: deactivating also ends every open session of the account. */
  deactivate(actor: Actor, id: number): Promise<Account> {
    return this.act(actor, id, 'deactivate', async (gateways, now) => {
      await gateways.accounts.setActive(id, false);
      await gateways.sessions.revokeAllForUser(id, now);
    });
  }

  activate(actor: Actor, id: number): Promise<Account> {
    return this.act(actor, id, 'activate', async (gateways) => {
      await gateways.accounts.setActive(id, true);
    });
  }

  /** REQ-IAM-009: a new temporary password, changed at the next sign-in; old sessions end. */
  async resetPassword(
    actor: Actor,
    id: number,
  ): Promise<{ account: Account; temporaryPassword: string }> {
    const temporary = temporaryPassword();
    const hash = await this.hasher.hash(temporary);
    const account = await this.act(actor, id, 'reset_password', async (gateways, now) => {
      await gateways.users.setPassword(id, hash, true);
      await gateways.resets.voidOpen(id, now);
      await gateways.sessions.revokeAllForUser(id, now);
    });
    return { account, temporaryPassword: temporary };
  }

  /**
   * REQ-IAM-004, BR-14, TX of §9.2: in one transaction the new holder's role row becomes System_Admin,
   * the old holder's row is deleted (it keeps no role, DEC-116), and one audit record is written.
   */
  moveSystemAdmin(actor: Actor, toUserId: number, reason: string): Promise<Account[]> {
    this.requireManager(actor);
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      const fromId = await gateways.accounts.systemAdminId();
      const target = await gateways.accounts.findById(toUserId);
      if (!target || !target.isActive || target.id === fromId) {
        this.refuse('move_system_admin', ACCOUNT_MESSAGES.moveTarget);
      }
      if (
        target.role === 'Access_Manager' &&
        (await gateways.accounts.countActiveAccessManagers()) <= 1
      ) {
        this.refuse('move_system_admin', ACCOUNT_MESSAGES.lastAccessManager);
      }
      if (fromId !== null) await gateways.accounts.setRole(fromId, null);
      await gateways.accounts.setRole(toUserId, 'System_Admin');
      await gateways.audit.write({
        ...this.by(actor),
        entity: 'user',
        entityId: toUserId,
        action: 'move_system_admin',
        before: { systemAdminId: fromId, role: target.role },
        after: { systemAdminId: toUserId },
        reason,
      });
      const managers = await gateways.accounts.countActiveAccessManagers();
      const changed = [fromId, toUserId].filter((id): id is number => id !== null);
      const rows = await Promise.all(changed.map((id) => this.load(gateways, id)));
      return rows.map((row) => this.view(actor, this.record(row, managers, now), now));
    });
  }

  private act(
    actor: Actor,
    id: number,
    action: Exclude<AccountAction, 'edit'>,
    change: (gateways: AccountGateways, now: Date) => Promise<void>,
  ): Promise<Account> {
    const now = this.clock.now();
    return this.unitOfWork.run(async (gateways) => {
      const before = await this.load(gateways, id);
      await this.check(gateways, actor, before, action, now);
      await change(gateways, now);
      const after = await this.load(gateways, id);
      await gateways.audit.write({
        ...this.by(actor),
        entity: 'user',
        entityId: id,
        action,
        before: auditView(before),
        after: auditView(after),
      });
      return this.viewOf(gateways, actor, after, now);
    });
  }

  private async check(
    gateways: AccountGateways,
    actor: Actor,
    row: AccountRow,
    action: AccountAction,
    now: Date,
  ): Promise<void> {
    const managers = await gateways.accounts.countActiveAccessManagers();
    assertAllowed(ACCOUNT_POLICIES, actor, this.record(row, managers, now), action);
  }

  private async viewOf(
    gateways: AccountGateways,
    actor: Actor,
    row: AccountRow,
    now: Date,
  ): Promise<Account> {
    const managers = await gateways.accounts.countActiveAccessManagers();
    return this.view(actor, this.record(row, managers, now), now);
  }

  private record(row: AccountRow, activeManagers: number, now: Date): AccountRecord {
    return {
      ...row,
      locked: row.isActive && row.lockedUntil !== null && row.lockedUntil > now,
      lastActiveAccessManager: row.role === 'Access_Manager' && row.isActive && activeManagers <= 1,
    };
  }

  private view(actor: Actor, record: AccountRecord, now: Date): Account {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      status: statusOf(record, now),
      lastSignInAt: record.lastSignInAt?.toISOString() ?? null,
      allowedActions: allowedActions(ACCOUNT_POLICIES, actor, record),
    };
  }

  private async load(gateways: AccountGateways, id: number): Promise<AccountRow> {
    const row = await gateways.accounts.findById(id);
    if (!row) throw new AccountNotFoundError();
    return row;
  }

  private assignable(role: string): Role {
    if (role === 'System_Admin') this.refuse('edit', ACCOUNT_MESSAGES.systemAdminByMove);
    return role as Role;
  }

  private requireManager(actor: Actor): void {
    if (!actor.capabilities.has('accounts.manage')) this.refuse('accounts', NOT_ALLOWED);
  }

  private refuse(action: string, message: string): never {
    throw new ActionRefusedError(action, message);
  }

  private by(actor: Actor): { userId: number; userRole: Role | null } {
    return { userId: actor.user.id, userRole: actor.user.role };
  }
}
