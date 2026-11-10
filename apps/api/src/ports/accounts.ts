import type { Role } from '@bmi/shared';
import type { IamGateways } from './iam.js';

/** One row of Users and roles (§9.2 users, user_roles; last sign-in from auth_sessions). */
export interface AccountRow {
  id: number;
  name: string;
  email: string;
  role: Role | null;
  isActive: boolean;
  lockedUntil: Date | null;
  lastSignInAt: Date | null;
}

export interface AccountGateway {
  list(): Promise<AccountRow[]>;
  findById(id: number): Promise<AccountRow | null>;
  /** Case-insensitive; `exceptId` skips the account being edited. */
  emailTaken(email: string, exceptId?: number): Promise<boolean>;
  create(account: { name: string; email: string; passwordHash: string }): Promise<number>;
  rename(id: number, account: { name: string; email: string }): Promise<void>;
  /** RL-1: the one role row of the account; null leaves it without a role. */
  setRole(id: number, role: Role | null): Promise<void>;
  setActive(id: number, active: boolean): Promise<void>;
  countActiveAccessManagers(): Promise<number>;
  /** BR-14: the account holding System Admin, if any. */
  systemAdminId(): Promise<number | null>;
}

/** §9.2 audit_logs: append only. */
export interface AuditEntry {
  entity: string;
  entityId: number;
  action: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  /** Null when the system itself acts, e.g. a switch that ends at its end time (DEC-118). */
  userId: number | null;
  userRole: Role | null;
}

export interface AuditGateway {
  write(entry: AuditEntry): Promise<void>;
}

export interface AccountGateways extends IamGateways {
  accounts: AccountGateway;
  audit: AuditGateway;
}
